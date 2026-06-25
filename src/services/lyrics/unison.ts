import { LyricData } from './index';

export const fetchUnisonLyrics = async (
    trackName: string,
    artistName: string,
    videoId?: string,
    duration?: number,
    albumName?: string
): Promise<LyricData | null> => {
    const cleanTrack = trackName.trim();
    const cleanArtist = artistName.trim();
    if (!cleanTrack || !cleanArtist) return null;

    try {
        let entry: any = null;

                                            
        if (videoId) {
            const urlById = `https://unison.boidu.dev/lyrics?v=${videoId}`;
            const resById = await fetch(urlById);
            if (resById.ok) {
                const dataById = await resById.json();
                if (dataById.success && dataById.data && dataById.data.lyrics) {
                    entry = dataById.data;
                }
            }
        }

                                         
        if (!entry) {
            const params = new URLSearchParams();
            params.append('song', cleanTrack);
            params.append('artist', cleanArtist);
            if (albumName) params.append('album', albumName);
            if (duration && duration > 0) params.append('duration', Math.floor(duration).toString());

            const urlByMeta = `https://unison.boidu.dev/lyrics?${params.toString()}`;
            const resByMeta = await fetch(urlByMeta);
            if (resByMeta.ok) {
                const dataByMeta = await resByMeta.json();
                if (dataByMeta.success && dataByMeta.data && dataByMeta.data.lyrics) {
                    entry = dataByMeta.data;
                }
            }
        }

        if (!entry) return null;

        const isSynced = entry.syncType === "LINE_SYNCED" || entry.format === "lrc";
        
        return {
            id: Date.now(),
            name: entry.song || cleanTrack,
            trackName: entry.song || cleanTrack,
            artistName: entry.artist || cleanArtist,
            albumName: albumName || "",
            duration: duration || 0,
            instrumental: false,
            plainLyrics: isSynced ? "" : entry.lyrics,
            syncedLyrics: isSynced ? entry.lyrics : "",
        };

    } catch (e) {
        console.warn(`[Lyrics] Unison endpoint failed:`, e);
        return null;
    }
};
