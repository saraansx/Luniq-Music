import { LyricData } from './index';

export const fetchSpotifyLyrics = async (
    trackName: string,
    artistName: string,
    duration?: number,
    albumName?: string,
    providedTrackId?: string
): Promise<LyricData | null> => {
    const cleanTrack = trackName.trim();
    const cleanArtist = artistName.trim();
    if (!cleanTrack || !cleanArtist) return null;

    try {
        // 1. Securely grab the Spotify Token from Lune's internal IPC
        if (!(window as any).ipcRenderer) return null;
        const creds = await (window as any).ipcRenderer.invoke('get-spotify-credentials', false);
        if (!creds || !creds.accessToken) {
            console.log("[Lyrics] Native Spotify provider skipped: No Spotify Token found in credentials.");
            return null;
        }

        const token = creds.accessToken;
        let trackId = providedTrackId;

        if (!trackId || trackId.length !== 22) {
            const query = `${cleanTrack} ${cleanArtist}`;
            const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`;
            const searchRes = await fetch(searchUrl, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });

            if (!searchRes.ok) {
                console.warn(`[Lyrics] Spotify API search failed with status: ${searchRes.status}`);

                return null;
            }

            const searchData = await searchRes.json();
            const trackItems = searchData?.tracks?.items;
            if (!trackItems || trackItems.length === 0) return null;

            let bestMatch = trackItems[0];
            if (duration && duration > 0 && trackItems.length > 1) {
                const durationMs = duration * 1000;
                bestMatch = trackItems.reduce((prev: any, curr: any) => {
                    const prevDiff = Math.abs((prev.duration_ms || 0) - durationMs);
                    const currDiff = Math.abs((curr.duration_ms || 0) - durationMs);
                    return currDiff < prevDiff ? curr : prev;
                });
            }
            trackId = bestMatch.id;
        }

        if (!trackId) return null;

        // 3. Fetch native color-lyrics from spclient
        const lyricsUrl = `https://spclient.wg.spotify.com/color-lyrics/v2/track/${trackId}?format=json&vocalRemoval=false`;
        const lyricsRes = await fetch(lyricsUrl, {
            headers: {
                "App-Platform": "WebPlayer",
                "Authorization": `Bearer ${token}`,
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                "Accept": "application/json"
            }
        });

        if (!lyricsRes.ok) {
            console.log(`[Lyrics] Spotify spclient returned ${lyricsRes.status} (Track might not have lyrics).`);
            return null;
        }

        const lyricsData = await lyricsRes.json();
        const lines = lyricsData?.lyrics?.lines;
        if (!lines || !Array.isArray(lines) || lines.length === 0) return null;

        const isSynced = lyricsData?.lyrics?.syncType === "LINE_SYNCED";
        let lrcStr = "";
        let plainStr = "";

        lines.forEach((line: any) => {
            const text = line.words || "";
            plainStr += `${text}\n`;
            
            if (isSynced && line.startTimeMs) {
                const ms = parseInt(line.startTimeMs, 10);
                if (!isNaN(ms)) {
                    const m = Math.floor(ms / 60000);
                    const s = Math.floor((ms % 60000) / 1000);
                    const msPart = Math.floor((ms % 1000) / 10);
                    const pad = (n: number) => n.toString().padStart(2, '0');
                    lrcStr += `[${pad(m)}:${pad(s)}.${pad(msPart)}]${text}\n`;
                }
            }
        });

        return {
            id: Date.now(),
            name: cleanTrack,
            trackName: cleanTrack,
            artistName: cleanArtist,
            albumName: albumName || "",
            duration: duration || 0,
            instrumental: false,
            plainLyrics: plainStr.trim(),
            syncedLyrics: isSynced ? lrcStr.trim() : "",
        };

    } catch (e) {
        console.error(`[Lyrics] Native Spotify provider crashed:`, e);
        return null;
    }
};
