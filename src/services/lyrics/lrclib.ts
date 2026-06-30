import { LyricData } from './index';

function levenshteinDistance(s1: string, s2: string): number {
  const len1 = s1.length;
  const len2 = s2.length;
  const matrix: number[][] = Array.from({ length: len1 + 1 }, () => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, 
        matrix[i][j - 1] + 1, 
        matrix[i - 1][j - 1] + cost 
      );
    }
  }
  return matrix[len1][len2];
}

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.trim().toLowerCase();
  const s2 = str2.trim().toLowerCase();

  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0.0;

  let containsScore = 0.0;
  if (s1.includes(s2) || s2.includes(s1)) {
    containsScore = 0.8;
  }

  const maxLength = Math.max(s1.length, s2.length);
  const distance = levenshteinDistance(s1, s2);
  const distanceScore = 1.0 - (distance / maxLength);

  return Math.max(containsScore, distanceScore);
}

function findBestMatch(tracks: any[], trackName: string, artistName: string): any | null {
  if (tracks.length === 0) return null;

  const scoredTracks = tracks.map(track => {
    const trackNameSimilarity = calculateSimilarity(trackName, track.trackName || "");
    const artistNameSimilarity = calculateSimilarity(artistName, track.artistName || "");
    let score = (trackNameSimilarity + artistNameSimilarity) / 2.0;
    if (track.syncedLyrics) score += 0.1;
    return { track, score, trackNameSimilarity, artistNameSimilarity };
  });

  scoredTracks.sort((a, b) => b.score - a.score);
  const best = scoredTracks[0];
  if (best && (best.trackNameSimilarity + best.artistNameSimilarity) / 2.0 > 0.6) {
    return best.track;
  }
  return null;
}

function bestMatchingFor(tracks: any[], duration: number, trackName: string, artistName: string): any | null {
  if (tracks.length === 0) return null;

  const durationSec = duration > 0 ? duration : -1;

  if (durationSec === -1) {
    return findBestMatch(tracks, trackName, artistName);
  }

  const sorted = [...tracks].sort((a, b) => {
    const aDiff = Math.abs((a.duration || 0) - durationSec);
    const bDiff = Math.abs((b.duration || 0) - durationSec);
    return aDiff - bDiff;
  });

  const best = sorted[0];
  if (best && Math.abs((best.duration || 0) - durationSec) <= 2) {
    return best;
  }
  return null;
}

export const fetchLrcLibLyrics = async (
  cleanTrackName: string,
  primaryArtist: string,
  duration?: number
): Promise<LyricData | null> => {
  const tryFetch = async (useDuration: boolean): Promise<any | null> => {
    try {
      const params = new URLSearchParams({
        track_name: cleanTrackName,
        artist_name: primaryArtist,
      });
      
      if (useDuration && duration && duration > 0) {
        params.append('duration', Math.round(duration).toString());
      }

      const response = await fetch(`https://lrclib.net/api/get?${params.toString()}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      // ignore get error
    }
    return null;
  };

  try {
    // 1. Try to fetch exact match via API get endpoint
    let data = await tryFetch(true);
    if (!data && duration && duration > 0) {
      data = await tryFetch(false);
    }
    if (data && (data.syncedLyrics || data.plainLyrics)) {
      return {
        id: Date.now(),
        name: cleanTrackName,
        trackName: data.trackName || cleanTrackName,
        artistName: data.artistName || primaryArtist,
        albumName: data.albumName || "",
        duration: data.duration || duration || 0,
        instrumental: data.instrumental || false,
        plainLyrics: data.plainLyrics || "",
        syncedLyrics: data.syncedLyrics || "",
      };
    }

    const searchParams = new URLSearchParams({
      q: `${cleanTrackName} ${primaryArtist}`
    });

    const searchResponse = await fetch(`https://lrclib.net/api/search?${searchParams.toString()}`);
    if (searchResponse.ok) {
      const results = await searchResponse.json();
      if (Array.isArray(results) && results.length > 0) {
        const usable = results.filter(r => (r.syncedLyrics && r.syncedLyrics.trim().length > 0) || (r.plainLyrics && r.plainLyrics.trim().length > 0));
        const matched = bestMatchingFor(usable, duration || -1, cleanTrackName, primaryArtist);
        if (matched) {
          return {
            id: Date.now(),
            name: cleanTrackName,
            trackName: matched.trackName || cleanTrackName,
            artistName: matched.artistName || primaryArtist,
            albumName: matched.albumName || "",
            duration: matched.duration || duration || 0,
            instrumental: matched.instrumental || false,
            plainLyrics: matched.plainLyrics || "",
            syncedLyrics: matched.syncedLyrics || "",
          };
        }
      }
    }
  } catch (e) {
    console.error('[Lyrics] Error fetching lyrics from LRCLib:', e);
  }
  return null;
};
