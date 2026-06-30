import { LyricData } from './lyrics/index';
import { fetchSpotifyLyrics } from './lyrics/spotify';
import { fetchBetterLyrics } from './lyrics/betterlyrics';
import { fetchYouLyPlusLyrics } from './lyrics/youlyplus';
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

const raceProviders = <T>(providers: (() => Promise<T | null>)[]): Promise<T | null> => {
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

    const startTime = performance.now();

    let data = await fetchSpotifyLyrics(cleanTrackName, primaryArtist, duration, albumName, videoId);
    if (data) {
        console.log(`[LyricsHelper] Resolved "${cleanTrackName}" via Spotify in ${Math.round(performance.now() - startTime)}ms`);
        data = ensureRomanized(data);
        localStorage.setItem(cacheKey, JSON.stringify(data));
        return data;
    }

    const fallbacks = [
        () => fetchBetterLyrics(cleanTrackName, primaryArtist, duration, albumName).then(d => d ? { provider: 'BetterLyrics', data: d } : null),
        () => fetchYouLyPlusLyrics(cleanTrackName, primaryArtist, duration, albumName).then(d => d ? { provider: 'YouLyPlus', data: d } : null),
        () => fetchPaxsenixLyrics(cleanTrackName, primaryArtist, duration, albumName).then(d => d ? { provider: 'Paxsenix', data: d } : null),
        () => fetchLrcLibLyrics(cleanTrackName, primaryArtist, duration).then(d => d ? { provider: 'LRCLib', data: d } : null),
        () => fetchKugouLyrics(cleanTrackName, primaryArtist, duration, albumName).then(d => d ? { provider: 'KuGou', data: d } : null),
        () => fetchUnisonLyrics(cleanTrackName, primaryArtist, videoId, duration, albumName).then(d => d ? { provider: 'Unison', data: d } : null),
        () => fetchSimpMusicLyrics(cleanTrackName, primaryArtist, videoId, duration, albumName).then(d => d ? { provider: 'SimpMusic', data: d } : null)
    ];

    const result = await raceProviders(fallbacks) as { provider: string; data: LyricData } | null;

    if (result) {
        console.log(`[LyricsHelper] Resolved "${cleanTrackName}" via ${result.provider} in ${Math.round(performance.now() - startTime)}ms`);
        let resolvedData = ensureRomanized(result.data);
        localStorage.setItem(cacheKey, JSON.stringify(resolvedData));
        return resolvedData;
    }

    console.log(`[LyricsHelper] No lyrics found for "${cleanTrackName}" by ${primaryArtist} (checked all 8 providers in ${Math.round(performance.now() - startTime)}ms)`);
    localStorage.setItem(cacheKey, 'NOT_FOUND');
    return null;
};
