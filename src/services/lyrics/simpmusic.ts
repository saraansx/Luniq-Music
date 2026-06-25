import { LyricData } from './index';

export const fetchSimpMusicLyrics = async (
    trackName: string,
    artistName: string,
    videoId?: string,
    duration?: number,
    albumName?: string
): Promise<LyricData | null> => {
    if (!videoId) return null;

    try {
        const url = `https://api-lyrics.simpmusic.org/v1/${videoId}`;
        const res = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36', 
                'Content-Type': 'application/json'
            }
        });

        if (!res.ok) return null;

        const data = await res.json();
        
        if (data.type !== 'success' || !data.data || !Array.isArray(data.data) || data.data.length === 0) {
            return null;
        }

        const tracks = data.data;
        
        let bestMatch = tracks[0];
        if (duration && duration > 0 && tracks.length > 1) {
            bestMatch = tracks.reduce((prev: any, curr: any) => {
                const prevDiff = Math.abs((prev.durationSeconds || 0) - duration);
                const currDiff = Math.abs((curr.durationSeconds || 0) - duration);
                return currDiff < prevDiff ? curr : prev;
            });
        }

        const synced = bestMatch.syncedLyrics || "";
        const plain = bestMatch.plainLyric || "";                                           

        if (!synced && !plain) return null;

        const cleanTrack = trackName.trim() || bestMatch.songTitle || "Unknown Track";
        const cleanArtist = artistName.trim() || bestMatch.artistName || "Unknown Artist";

        return {
            id: Date.now(),
            name: cleanTrack,
            trackName: cleanTrack,
            artistName: cleanArtist,
            albumName: albumName || bestMatch.albumName || "",
            duration: duration || bestMatch.durationSeconds || 0,
            instrumental: false,
            plainLyrics: plain,
            syncedLyrics: synced,
        };

    } catch (e) {
        console.warn(`[Lyrics] SimpMusic endpoint failed:`, e);
        return null;
    }
};
