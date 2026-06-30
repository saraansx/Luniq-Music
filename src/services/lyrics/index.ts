import { fetchBetterLyrics } from "./betterlyrics";
import { fetchPaxsenixLyrics } from "./paxsenix";
import { fetchSpotifyLyrics } from "./spotify";
import { fetchLrcLibLyrics } from "./lrclib";
import { fetchKugouLyrics } from "./kugou";
import { fetchSimpMusicLyrics } from "./simpmusic";
import { fetchUnisonLyrics } from "./unison";
import { fetchYouLyPlusLyrics } from "./youlyplus";
import { transliterate } from "transliteration";

export interface LyricData {
  id: number;
  name: string;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics: string;
  syncedLyrics: string;
  romanizedLyrics?: string;
}

export * from "./parser";
export { fetchBetterLyrics } from "./betterlyrics";
export { fetchPaxsenixLyrics } from "./paxsenix";
export { fetchSpotifyLyrics } from "./spotify";
export { fetchLrcLibLyrics } from "./lrclib";
export { fetchKugouLyrics } from "./kugou";
export { fetchSimpMusicLyrics } from "./simpmusic";
export { fetchUnisonLyrics } from "./unison";
export { fetchYouLyPlusLyrics } from "./youlyplus";

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

export const fetchLyrics = async (
  trackName: string,
  artistName: string,
  duration?: number,
  albumName?: string,
  videoId?: string,
): Promise<LyricData | null> => {
                                                   
  const cleanTrackName = trackName
    .replace(/\(feat\..*?\)/gi, "")
    .replace(/\(with.*?\)/gi, "")
    .replace(/\(remastered.*?\)/gi, "")
    .replace(/\(deluxe.*?\)/gi, "")
    .replace(/\(explicit.*?\)/gi, "")
    .replace(/\[explicit\]/gi, "")
    .replace(/\(official.*?\)/gi, "")
    .replace(/\[official.*?\]/gi, "")
    .replace(/\(video.*?\)/gi, "")
    .replace(/\[video.*?\]/gi, "")
    .replace(/\(lyric.*?\)/gi, "")
    .replace(/\[lyric.*?\]/gi, "")
    .replace(/- Single Version/gi, "")
    .replace(/- Remastered/gi, "")
    .replace(/- Radio Edit/gi, "")
    .replace(/- Original Mix/gi, "")
    .replace(/- .*? Mix$/gi, "")
    .replace(/\s+-\s+.*$/i, "")
    .replace(
      /\([^)]*(slowed|reverb|sped\s*up|speed\s*up|nightcore|bass\s*boost|tiktok|tik\s*tok|distorted|pitched)[^)]*\)/gi,
      "",
    )
    .replace(
      /\[[^\]]*(slowed|reverb|sped\s*up|speed\s*up|nightcore|bass\s*boost|tiktok|tik\s*tok|distorted|pitched)[^\]]*\]/gi,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();

                                 
  const primaryArtist = artistName.split(",")[0].split("&")[0].trim();

  const cacheKey = `lune_lyrics_${cleanTrackName.toLowerCase()}_${primaryArtist.toLowerCase()}`;

                            
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed) {
        if (parsed.empty) {
          console.log(
            `[Lyrics] Cache hit (No lyrics found) for: ${cleanTrackName} by ${primaryArtist}`,
          );
          return null;
        }
        console.log(
          `[Lyrics] Cache hit for: ${cleanTrackName} by ${primaryArtist}`,
        );
        const hadRom = !!parsed.romanizedLyrics;
        const romanizedParsed = ensureRomanized(parsed);
        if (!hadRom && romanizedParsed.romanizedLyrics) {
          try {
            localStorage.setItem(cacheKey, JSON.stringify(romanizedParsed));
          } catch (e) {
            console.warn(
              "[Lyrics] Failed to update cache with romanized lyrics:",
              e,
            );
          }
        }
        return romanizedParsed;
      }
    }
  } catch (e) {
    console.warn("[Lyrics] Failed to read from localStorage cache:", e);
  }

  const startTime = performance.now();
  let data = null;

  try {
    data = await fetchSpotifyLyrics(cleanTrackName, primaryArtist, duration, albumName);
    if (data) {
      console.log(`[Lyrics] Resolved "${cleanTrackName}" via Spotify in ${Math.round(performance.now() - startTime)}ms`);
      data = ensureRomanized(data);
      try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch (e) {}
      return data;
    }

    data = await fetchBetterLyrics(cleanTrackName, primaryArtist, duration, albumName);
    if (data) {
      console.log(`[Lyrics] Resolved "${cleanTrackName}" via BetterLyrics in ${Math.round(performance.now() - startTime)}ms`);
      data = ensureRomanized(data);
      try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch (e) {}
      return data;
    }

    data = await fetchYouLyPlusLyrics(cleanTrackName, primaryArtist, duration, albumName);
    if (data) {
      console.log(`[Lyrics] Resolved "${cleanTrackName}" via YouLyPlus in ${Math.round(performance.now() - startTime)}ms`);
      data = ensureRomanized(data);
      try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch (e) {}
      return data;
    }

    data = await fetchPaxsenixLyrics(cleanTrackName, primaryArtist, duration, albumName);
    if (data) {
      console.log(`[Lyrics] Resolved "${cleanTrackName}" via Paxsenix in ${Math.round(performance.now() - startTime)}ms`);
      data = ensureRomanized(data);
      try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch (e) {}
      return data;
    }

    data = await fetchLrcLibLyrics(cleanTrackName, primaryArtist, duration);
    if (data) {
      console.log(`[Lyrics] Resolved "${cleanTrackName}" via LRCLib in ${Math.round(performance.now() - startTime)}ms`);
      data = ensureRomanized(data);
      try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch (e) {}
      return data;
    }

    data = await fetchKugouLyrics(cleanTrackName, primaryArtist, duration, albumName);
    if (data) {
      console.log(`[Lyrics] Resolved "${cleanTrackName}" via KuGou in ${Math.round(performance.now() - startTime)}ms`);
      data = ensureRomanized(data);
      try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch (e) {}
      return data;
    }

    data = await fetchUnisonLyrics(cleanTrackName, primaryArtist, videoId, duration, albumName);
    if (data) {
      console.log(`[Lyrics] Resolved "${cleanTrackName}" via Unison in ${Math.round(performance.now() - startTime)}ms`);
      data = ensureRomanized(data);
      try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch (e) {}
      return data;
    }

    if (videoId) {
      data = await fetchSimpMusicLyrics(cleanTrackName, primaryArtist, videoId, duration, albumName);
      if (data) {
        console.log(`[Lyrics] Resolved "${cleanTrackName}" via SimpMusic in ${Math.round(performance.now() - startTime)}ms`);
        data = ensureRomanized(data);
        try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch (e) {}
        return data;
      }
    }

    console.log(`[Lyrics] No lyrics found for "${cleanTrackName}" by ${primaryArtist} (checked all fallbacks in ${Math.round(performance.now() - startTime)}ms)`);
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ empty: true, timestamp: Date.now() }));
    } catch (e) {}
    return null;
  } catch (error) {
    console.error("[Lyrics] Error in fetchLyrics coordinator:", error);
    return null;
  }
};
