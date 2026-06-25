import { fetchBetterLyrics } from "./betterlyrics";
import { fetchPaxsenixLyrics } from "./paxsenix";
import { fetchSpotifyLyrics } from "./spotify";
import { fetchLrcLibLyrics } from "./lrclib";
import { fetchKugouLyrics } from "./kugou";
import { fetchSimpMusicLyrics } from "./simpmusic";
import { fetchUnisonLyrics } from "./unison";
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

  try {
                                           
    console.log(
      `[Lyrics] Trying Native Spotify for: ${cleanTrackName} by ${primaryArtist}`,
    );
    let data = await fetchSpotifyLyrics(
      cleanTrackName,
      primaryArtist,
      duration,
      albumName,
    );
    if (data) {
      console.log(`[Lyrics] Native Spotify matched successfully.`);
      data = ensureRomanized(data);
      try {
        localStorage.setItem(cacheKey, JSON.stringify(data));
      } catch (e) {
        console.warn("[Lyrics] Failed to save to cache:", e);
      }
      return data;
    }

    console.log(
      `[Lyrics] Native Spotify failed, trying BetterLyrics fallback for: ${cleanTrackName} by ${primaryArtist}`,
    );
    data = await fetchBetterLyrics(
      cleanTrackName,
      primaryArtist,
      duration,
      albumName,
    );
    if (data) {
      console.log(`[Lyrics] BetterLyrics matched successfully.`);
      data = ensureRomanized(data);
      try {
        localStorage.setItem(cacheKey, JSON.stringify(data));
      } catch (e) {
        console.warn("[Lyrics] Failed to save to cache:", e);
      }
      return data;
    }

    console.log(
      `[Lyrics] BetterLyrics failed, trying Paxsenix (Apple Music) fallback for: ${cleanTrackName} by ${primaryArtist}`,
    );
    data = await fetchPaxsenixLyrics(
      cleanTrackName,
      primaryArtist,
      duration,
      albumName,
    );
    if (data) {
      console.log(`[Lyrics] Paxsenix matched successfully.`);
      data = ensureRomanized(data);
      try {
        localStorage.setItem(cacheKey, JSON.stringify(data));
      } catch (e) {
        console.warn("[Lyrics] Failed to save to cache:", e);
      }
      return data;
    }

    console.log(
      `[Lyrics] Paxsenix (Apple Music) failed, trying LRCLib fallback for: ${cleanTrackName} by ${primaryArtist}`,
    );
    data = await fetchLrcLibLyrics(cleanTrackName, primaryArtist, duration);
    if (data) {
      console.log(`[Lyrics] LRCLib matched successfully.`);
      data = ensureRomanized(data);
      try {
        localStorage.setItem(cacheKey, JSON.stringify(data));
      } catch (e) {
        console.warn("[Lyrics] Failed to save to cache:", e);
      }
      return data;
    }

    console.log(
      `[Lyrics] LRCLib failed, trying KuGou fallback for: ${cleanTrackName} by ${primaryArtist}`,
    );
    data = await fetchKugouLyrics(
      cleanTrackName,
      primaryArtist,
      duration,
      albumName,
    );
    if (data) {
      console.log(`[Lyrics] KuGou matched successfully.`);
      data = ensureRomanized(data);
      try {
        localStorage.setItem(cacheKey, JSON.stringify(data));
      } catch (e) {
        console.warn("[Lyrics] Failed to save to cache:", e);
      }
    }

    console.log(
      `[Lyrics] KuGou failed, trying Unison fallback for: ${cleanTrackName} by ${primaryArtist}`,
    );
    data = await fetchUnisonLyrics(
      cleanTrackName,
      primaryArtist,
      videoId,
      duration,
      albumName,
    );
    if (data) {
      console.log(`[Lyrics] Unison matched successfully.`);
      data = ensureRomanized(data);
      try {
        localStorage.setItem(cacheKey, JSON.stringify(data));
      } catch (e) {
        console.warn("[Lyrics] Failed to save to cache:", e);
      }
      return data;
    }

    if (videoId) {
      console.log(
        `[Lyrics] Unison failed, trying SimpMusic fallback for: ${cleanTrackName} (Video ID: ${videoId})`,
      );
      data = await fetchSimpMusicLyrics(
        cleanTrackName,
        primaryArtist,
        videoId,
        duration,
        albumName,
      );
      if (data) {
        console.log(`[Lyrics] SimpMusic matched successfully.`);
        data = ensureRomanized(data);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(data));
        } catch (e) {
          console.warn("[Lyrics] Failed to save to cache:", e);
        }
        return data;
      }
    }

    try {
      localStorage.setItem(
        cacheKey,
        JSON.stringify({ empty: true, timestamp: Date.now() }),
      );
    } catch (e) {}

    return null;
  } catch (error) {
    console.error("[Lyrics] Error in fetchLyrics coordinator:", error);
    return null;
  }
};
