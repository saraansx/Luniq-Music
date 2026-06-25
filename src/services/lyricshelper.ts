import { LyricData } from './lyrics/index';
import { fetchSpotifyLyrics } from './lyrics/spotify';
import { fetchBetterLyrics } from './lyrics/betterlyrics';
import { fetchPaxsenixLyrics } from './lyrics/paxsenix';
import { fetchLrcLibLyrics } from './lyrics/lrclib';
import { fetchKugouLyrics } from './lyrics/kugou';
import { fetchUnisonLyrics } from './lyrics/unison';
import { fetchSimpMusicLyrics } from './lyrics/simpmusic';
import { transliterate } from 'transliteration';

                   
const ensureRomanized = (data: LyricData): LyricData => {
    if (!data.romanizedLyrics) {
        if (data.syncedLyrics) {
            data.romanizedLyrics = transliterate(data.syncedLyrics);
        } else if (data.plainLyrics) {
            data.romanizedLyrics = transliterate(data.plainLyrics);
        }
    }
    return data;
};

const raceProviders = (providers: (() => Promise<LyricData | null>)[]): Promise<LyricData | null> => {
    return new Promise((resolve) => {
        let failedCount = 0;
        let isResolved = false;

        if (providers.length === 0) return resolve(null);

        providers.forEach(provider => {
            provider()
                .then(data => {
                    if (isResolved) return;
                    if (data !== null) {
                        isResolved = true;
                        resolve(data);
                    } else {
                        failedCount++;
                        if (failedCount === providers.length) resolve(null);
                    }
                })
                .catch(() => {
                    if (isResolved) return;
                    failedCount++;
                    if (failedCount === providers.length) resolve(null);
                });
        });
    });
};

export const fetchLyricsSmart = async (
    trackName: string, 
    artistName: string, 
    duration?: number, 
    albumName?: string,
    videoId?: string
): Promise<LyricData | null> => {
    const cleanTrackName = trackName
        .replace(/\(feat\..*?\)/gi, '')
        .replace(/\(with.*?\)/gi, '')
        .replace(/\(remastered.*?\)/gi, '')
        .replace(/\(deluxe.*?\)/gi, '')
        .replace(/\(explicit.*?\)/gi, '')
        .replace(/\[explicit\]/gi, '')
        .replace(/\(official.*?\)/gi, '')
        .replace(/\[official.*?\]/gi, '')
        .replace(/\(video.*?\)/gi, '')
        .replace(/\[video.*?\]/gi, '')
        .trim();

    const primaryArtist = artistName.split(',')[0].trim();
    const cacheKey = `lyrics_${cleanTrackName}_${primaryArtist}`.replace(/\s+/g, '_').toLowerCase();

    try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            if (cached === 'NOT_FOUND') {
                console.log(`[LyricsHelper] Cache hit (No lyrics found) for: ${cleanTrackName}`);
                return null;
            }
            const parsed = JSON.parse(cached);
            if (parsed && (parsed.syncedLyrics || parsed.plainLyrics)) {
                console.log(`[LyricsHelper] Cache hit for: ${cleanTrackName}`);
                return ensureRomanized(parsed);
            }
        }
    } catch (e) {
        console.warn("[LyricsHelper] Cache read error:", e);
    }

    console.log(`[LyricsHelper] Fetching lyrics for: ${cleanTrackName} by ${primaryArtist}`);

    console.log(`[LyricsHelper] Step 1: Requesting from Primary Provider (Native Spotify)...`);
    let data = await fetchSpotifyLyrics(cleanTrackName, primaryArtist, duration, albumName, videoId);
    
    if (data) {
        console.log(`[LyricsHelper] Native Spotify matched successfully!`);
        data = ensureRomanized(data);
        localStorage.setItem(cacheKey, JSON.stringify(data));
        return data;
    }

    console.log(`[LyricsHelper] Spotify failed. Step 2: Launching Parallel Race for fallbacks!`);

    const fallbacks = [
        () => fetchBetterLyrics(cleanTrackName, primaryArtist, duration, albumName).then(d => { if(d) console.log('[LyricsHelper] BetterLyrics won the race!'); return d; }),
        () => fetchPaxsenixLyrics(cleanTrackName, primaryArtist, duration, albumName).then(d => { if(d) console.log('[LyricsHelper] Paxsenix won the race!'); return d; }),
        () => fetchLrcLibLyrics(cleanTrackName, primaryArtist, duration).then(d => { if(d) console.log('[LyricsHelper] LRCLib won the race!'); return d; }),
        () => fetchKugouLyrics(cleanTrackName, primaryArtist, duration, albumName).then(d => { if(d) console.log('[LyricsHelper] KuGou won the race!'); return d; }),
        () => fetchUnisonLyrics(cleanTrackName, primaryArtist, videoId, duration, albumName).then(d => { if(d) console.log('[LyricsHelper] Unison won the race!'); return d; }),
        () => fetchSimpMusicLyrics(cleanTrackName, primaryArtist, videoId, duration, albumName).then(d => { if(d) console.log('[LyricsHelper] SimpMusic won the race!'); return d; })
    ];

    data = await raceProviders(fallbacks);

    if (data) {
        data = ensureRomanized(data);
        localStorage.setItem(cacheKey, JSON.stringify(data));
        return data;
    }

                          
    console.log(`[LyricsHelper] All 8 providers failed to find lyrics for: ${cleanTrackName}`);
    localStorage.setItem(cacheKey, 'NOT_FOUND');
    return null;
};
