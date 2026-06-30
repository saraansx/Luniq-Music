import { LyricData } from './index';

const API_BASE_URL = "https://unison.boidu.dev";

async function fetchById(id: number): Promise<any | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/lyrics/${id}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.data && data.data.lyrics) {
        return data.data;
      }
    }
  } catch (e) {}
  return null;
}

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

    const durationSec = duration ? Math.floor(duration) : -1;

    try {
        let entry: any = null;

        // 1. Try fetching by videoId first
        if (videoId) {
            try {
                const urlById = `${API_BASE_URL}/lyrics?v=${videoId}`;
                const resById = await fetch(urlById);
                if (resById.ok) {
                    const dataById = await resById.json();
                    if (dataById.success && dataById.data && dataById.data.lyrics) {
                        entry = dataById.data;
                    }
                }
            } catch (e) {}
        }

        // 2. Try fetching by exact metadata lookup
        if (!entry) {
            try {
                const params = new URLSearchParams();
                params.append('song', cleanTrack);
                params.append('artist', cleanArtist);
                if (albumName) params.append('album', albumName);
                if (durationSec > 0) params.append('duration', durationSec.toString());

                const urlByMeta = `${API_BASE_URL}/lyrics?${params.toString()}`;
                const resByMeta = await fetch(urlByMeta);
                if (resByMeta.ok) {
                    const dataByMeta = await resByMeta.json();
                    if (dataByMeta.success && dataByMeta.data && dataByMeta.data.lyrics) {
                        entry = dataByMeta.data;
                    }
                }
            } catch (e) {}
        }

        // 3. Fallback to searching the Unison database
        if (!entry) {
            try {
                const params = new URLSearchParams();
                params.append('song', cleanTrack);
                params.append('artist', cleanArtist);
                if (albumName) params.append('album', albumName);
                if (durationSec > 0) params.append('duration', durationSec.toString());

                const searchUrl = `${API_BASE_URL}/lyrics/search?${params.toString()}`;
                const searchRes = await fetch(searchUrl);
                if (searchRes.ok) {
                    const searchData = await searchRes.json();
                    if (searchData.success && Array.isArray(searchData.data) && searchData.data.length > 0) {
                        const summaries = searchData.data;
                        // Fetch the first matching search summary by ID
                        for (const summary of summaries.slice(0, 3)) {
                            if (summary.lyrics) {
                                entry = summary;
                                break;
                            } else if (summary.id) {
                                const fullEntry = await fetchById(summary.id);
                                if (fullEntry) {
                                    entry = fullEntry;
                                    break;
                                }
                            }
                        }
                    }
                }
            } catch (e) {}
        }

        if (!entry) return null;

        const isSynced = entry.syncType === "LINE_SYNCED" || entry.format === "lrc" || entry.lyrics.includes('[');
        
        return {
            id: Date.now(),
            name: entry.song || cleanTrack,
            trackName: entry.song || cleanTrack,
            artistName: entry.artist || cleanArtist,
            albumName: albumName || entry.album || "",
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
