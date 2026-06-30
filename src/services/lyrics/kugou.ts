import { LyricData } from './index';

const decodeBase64Utf8 = (base64: string): string => {
    const binString = atob(base64);
    const bytes = new Uint8Array(binString.length);
    for (let i = 0; i < binString.length; i++) {
        bytes[i] = binString.charCodeAt(i);
    }
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(bytes);
};

export const fetchKugouLyrics = async (
    trackName: string,
    artistName: string,
    duration?: number,
    albumName?: string
): Promise<LyricData | null> => {
    const cleanTrack = trackName.trim();
    const cleanArtist = artistName.trim();
    if (!cleanTrack || !cleanArtist) return null;

    try {
        const keyword = `${cleanTrack} - ${cleanArtist}`;
        let candidate: any = null;

        try {
            const searchUrl = `https://mobileservice.kugou.com/api/v3/search/song?version=9108&plat=0&pagesize=8&showtype=0&keyword=${encodeURIComponent(keyword)}`;
            const searchRes = await fetch(searchUrl);
            if (searchRes.ok) {
                const searchData = await searchRes.json();
                const songs = searchData.data?.info || [];

                const durationMs = duration ? duration * 1000 : 0;
                for (const song of songs) {
                    const songDurMs = (song.duration || 0) * 1000;
                    if (durationMs === 0 || Math.abs(songDurMs - durationMs) <= 10000) {
                        const lyricsSearchUrl = `https://lyrics.kugou.com/search?ver=1&man=yes&client=pc&hash=${song.hash}`;
                        const lyricsSearchRes = await fetch(lyricsSearchUrl);
                        if (lyricsSearchRes.ok) {
                            const lyricsSearchData = await lyricsSearchRes.json();
                            if (lyricsSearchData.candidates && lyricsSearchData.candidates.length > 0) {
                                candidate = lyricsSearchData.candidates[0];
                                break;
                            }
                        }
                    }
                }
            }
        } catch (e) {}

        if (!candidate) {
            try {
                let keywordUrl = `https://lyrics.kugou.com/search?ver=1&man=yes&client=pc&keyword=${encodeURIComponent(keyword)}`;
                if (duration && duration > 0) {
                    keywordUrl += `&duration=${Math.floor(duration * 1000)}`;
                }
                const res = await fetch(keywordUrl);
                if (res.ok) {
                    const data = await res.json();
                    if (data.candidates && data.candidates.length > 0) {
                        candidate = data.candidates[0];
                    }
                }
            } catch (e) {}
        }

        if (!candidate) return null;

        const downloadUrl = `https://lyrics.kugou.com/download?fmt=lrc&charset=utf8&client=pc&ver=1&id=${candidate.id}&accesskey=${candidate.accesskey}`;
        const downloadRes = await fetch(downloadUrl);
        if (!downloadRes.ok) return null;
        const downloadData = await downloadRes.json();

        if (!downloadData.content) return null;

        const decoded = decodeBase64Utf8(downloadData.content);
        const hasTimestamps = /\[\d{2}:\d{2}\.\d{2,3}\]/.test(decoded);

        return {
            id: Date.now(),
            name: cleanTrack,
            trackName: cleanTrack,
            artistName: cleanArtist,
            albumName: albumName || "",
            duration: duration || 0,
            instrumental: false,
            plainLyrics: hasTimestamps ? "" : decoded,
            syncedLyrics: hasTimestamps ? decoded : "",
        };

    } catch (e) {
        console.warn(`[Lyrics] KuGou endpoint failed:`, e);
        return null;
    }
};
