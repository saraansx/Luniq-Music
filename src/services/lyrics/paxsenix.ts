import { LyricData } from './index';
import { convertTTMLToLRC } from './parser';

const BASE_URL = "https://lyrics.paxsenix.org";

function extractLyrics(data: any): string | null {
  if (!data) return null;
  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        return extractLyrics(parsed);
      } catch (e) {}
    }
    return trimmed;
  }
  if (Array.isArray(data)) {
    return data.map(item => extractLyrics(item)).filter(Boolean).join('\n');
  }
  if (typeof data === 'object') {
    if (data.isError || (data.error && (typeof data.error === 'boolean' ? data.error : Object.keys(data.error).length > 0))) {
      return null;
    }
    const keys = ["lyrics", "lrc", "content", "text", "plainLyrics", "syncedLyrics", "line", "lyric", "words"];
    for (const key of keys) {
      if (data[key]) {
        const val = extractLyrics(data[key]);
        if (val) return val;
      }
    }
    if (data.metadata) {
      const val = extractLyrics(data.metadata);
      if (val) return val;
    }
  }
  return null;
}

// 1. Apple Music Backend
async function fetchAppleMusicLyrics(
  cleanTrack: string,
  cleanArtist: string,
  duration?: number
): Promise<string | null> {
  const query = `${cleanTrack} ${cleanArtist}`;
  const searchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=10`;
  
  const searchRes = await fetch(searchUrl);
  if (!searchRes.ok) return null;

  const searchData = await searchRes.json();
  const songs = searchData?.results;
  if (!songs || !Array.isArray(songs) || songs.length === 0) return null;

  let bestMatch = songs[0];
  if (duration && duration > 0 && songs.length > 1) {
    const durationMs = duration * 1000;
    bestMatch = songs.reduce((prev: any, curr: any) => {
      const prevDiff = Math.abs((prev.trackTimeMillis || 0) - durationMs);
      const currDiff = Math.abs((curr.trackTimeMillis || 0) - durationMs);
      return currDiff < prevDiff ? curr : prev;
    });
  }

  const songId = bestMatch.trackId;
  if (!songId) return null;

  // Try TTML first
  try {
    const ttmlUrl = `${BASE_URL}/apple-music/lyrics?id=${songId}&ttml=true`;
    const res = await fetch(ttmlUrl, { headers: { "User-Agent": "Lune-Music" } });
    if (res.ok) {
      const rawBody = await res.text();
      let ttmlContent = "";
      if (rawBody.startsWith("<tt") || rawBody.startsWith("<?xml")) {
        ttmlContent = rawBody;
      } else {
        const data = JSON.parse(rawBody);
        if (data.content && (data.content.includes("<tt") || data.content.includes("<?xml"))) {
          ttmlContent = data.content;
        }
      }
      if (ttmlContent) {
        return ttmlContent;
      }
    }
  } catch (e) {}

  // Try JSON LRC fallback
  try {
    const jsonUrl = `${BASE_URL}/apple-music/lyrics?id=${songId}`;
    const res = await fetch(jsonUrl, { headers: { "User-Agent": "Lune-Music" } });
    if (res.ok) {
      const data = await res.json();
      if (data.content && Array.isArray(data.content)) {
        return data.content
          .map((line: any) => {
            const minutes = Math.floor(line.timestamp / 60000);
            const seconds = Math.floor((line.timestamp % 60000) / 1000);
            const hundredths = Math.floor((line.timestamp % 1000) / 10);
            
            const minStr = minutes.toString().padStart(2, '0');
            const secStr = seconds.toString().padStart(2, '0');
            const hunStr = hundredths.toString().padStart(2, '0');
            
            const time = `[${minStr}:${secStr}.${hunStr}]`;
            const text = (line.text || []).map((t: any) => (t.text || '').trim()).join(' ');
            return `${time}${text}`;
          })
          .join('\n');
      }
    }
  } catch (e) {}

  return null;
}

async function fetchNetEaseLyrics(
  cleanTrack: string,
  cleanArtist: string,
  duration?: number
): Promise<string | null> {
  const query = `${cleanTrack} ${cleanArtist}`;
  const searchUrl = `${BASE_URL}/netease/search?q=${encodeURIComponent(query)}`;
  const res = await fetch(searchUrl, { headers: { "User-Agent": "Lune-Music" } });
  if (!res.ok) return null;

  const data = await res.json();
  const songs = data.result?.songs || [];
  if (songs.length === 0) return null;

  const durationMs = duration ? duration * 1000 : 0;
  const bestMatch = durationMs > 0
    ? songs.reduce((prev: any, curr: any) => {
        const prevDiff = Math.abs((prev.duration || 0) - durationMs);
        const currDiff = Math.abs((curr.duration || 0) - durationMs);
        return currDiff < prevDiff ? curr : prev;
      })
    : songs[0];

  const diff = durationMs > 0 ? Math.abs((bestMatch.duration || 0) - durationMs) : 0;
  if (durationMs > 0 && diff >= 10000) return null; 

  const lyricsUrl = `${BASE_URL}/netease/lyrics?id=${bestMatch.id}&word=true`;
  const lyricsRes = await fetch(lyricsUrl, { headers: { "User-Agent": "Lune-Music" } });
  if (!lyricsRes.ok) return null;

  const lyricsData = await lyricsRes.json();
  const klyric = lyricsData.klyric?.lyric;
  if (klyric && klyric.trim().length > 0) return klyric;

  const lrc = lyricsData.lrc?.lyric;
  if (lrc && lrc.trim().length > 0) return lrc;

  return null;
}

async function fetchSpotifyMirrorLyrics(
  cleanTrack: string,
  cleanArtist: string,
  duration?: number
): Promise<string | null> {
  const query = `${cleanTrack} ${cleanArtist}`;
  const searchUrl = `${BASE_URL}/spotify/search?q=${encodeURIComponent(query)}`;
  const res = await fetch(searchUrl, { headers: { "User-Agent": "Lune-Music" } });
  if (!res.ok) return null;

  const items = await res.json();
  if (!Array.isArray(items) || items.length === 0) return null;

  const durationMs = duration ? duration * 1000 : 0;
  const bestMatch = durationMs > 0
    ? items.reduce((prev: any, curr: any) => {
        const prevDiff = Math.abs((prev.durationMs || 0) - durationMs);
        const currDiff = Math.abs((curr.durationMs || 0) - durationMs);
        return currDiff < prevDiff ? curr : prev;
      })
    : items[0];

  const diff = durationMs > 0 ? Math.abs((bestMatch.durationMs || 0) - durationMs) : 0;
  if (durationMs > 0 && diff >= 10000) return null;

  const lyricsUrl = `${BASE_URL}/spotify/lyrics?id=${bestMatch.realId}`;
  const lyricsRes = await fetch(lyricsUrl, { headers: { "User-Agent": "Lune-Music" } });
  if (!lyricsRes.ok) return null;

  const raw = await lyricsRes.text();
  return extractLyrics(raw);
}

async function fetchMusixmatchMirrorLyrics(
  cleanTrack: string,
  cleanArtist: string,
  duration?: number
): Promise<string | null> {
  const query = `${cleanTrack} ${cleanArtist}`;
  const durationSec = duration ? Math.floor(duration) : 0;

  try {
    const url = new URL(`${BASE_URL}/musixmatch/lyrics`);
    url.searchParams.append('q', query);
    url.searchParams.append('t', cleanTrack);
    url.searchParams.append('a', cleanArtist);
    if (durationSec > 0) url.searchParams.append('d', durationSec.toString());
    url.searchParams.append('type', 'word');

    const res = await fetch(url.toString(), { headers: { "User-Agent": "Lune-Music" } });
    if (res.ok) {
      const raw = await res.text();
      const val = extractLyrics(raw);
      if (val) return val;
    }
  } catch (e) {}

  try {
    const url = new URL(`${BASE_URL}/musixmatch/lyrics`);
    url.searchParams.append('q', query);
    url.searchParams.append('t', cleanTrack);
    url.searchParams.append('a', cleanArtist);
    if (durationSec > 0) url.searchParams.append('d', durationSec.toString());

    const res = await fetch(url.toString(), { headers: { "User-Agent": "Lune-Music" } });
    if (res.ok) {
      const raw = await res.text();
      const val = extractLyrics(raw);
      if (val) return val;
    }
  } catch (e) {}

  return null;
}

async function fetchYouTubeMirrorLyrics(
  cleanTrack: string,
  cleanArtist: string,
  duration?: number
): Promise<string | null> {
  const query = `${cleanTrack} ${cleanArtist}`;
  const searchUrl = `${BASE_URL}/youtube/search?q=${encodeURIComponent(query)}`;
  const res = await fetch(searchUrl, { headers: { "User-Agent": "Lune-Music" } });
  if (!res.ok) return null;

  const items = await res.json();
  if (!Array.isArray(items) || items.length === 0) return null;

  const durationMs = duration ? duration * 1000 : 0;
  const bestMatch = durationMs > 0
    ? items.reduce((prev: any, curr: any) => {
        const prevDiff = Math.abs((prev.durationMs || 0) - durationMs);
        const currDiff = Math.abs((curr.durationMs || 0) - durationMs);
        return currDiff < prevDiff ? curr : prev;
      })
    : items[0];

  const diff = durationMs > 0 ? Math.abs((bestMatch.durationMs || 0) - durationMs) : 0;
  if (durationMs > 0 && diff >= 10000) return null;

  const lyricsUrl = `${BASE_URL}/youtube/lyrics?id=${bestMatch.realId}`;
  const lyricsRes = await fetch(lyricsUrl, { headers: { "User-Agent": "Lune-Music" } });
  if (!lyricsRes.ok) return null;

  const raw = await lyricsRes.text();
  return extractLyrics(raw);
}

export const fetchPaxsenixLyrics = async (
  trackName: string,
  artistName: string,
  duration?: number,
  albumName?: string
): Promise<LyricData | null> => {
  const cleanTrack = trackName.trim();
  const cleanArtist = artistName.trim();
  if (!cleanTrack || !cleanArtist) return null;

  const backends = [
    { name: "Apple Music", fetcher: () => fetchAppleMusicLyrics(cleanTrack, cleanArtist, duration) },
    { name: "NetEase", fetcher: () => fetchNetEaseLyrics(cleanTrack, cleanArtist, duration) },
    { name: "Spotify", fetcher: () => fetchSpotifyMirrorLyrics(cleanTrack, cleanArtist, duration) },
    { name: "Musixmatch", fetcher: () => fetchMusixmatchMirrorLyrics(cleanTrack, cleanArtist, duration) },
    { name: "YouTube", fetcher: () => fetchYouTubeMirrorLyrics(cleanTrack, cleanArtist, duration) }
  ];

  for (const backend of backends) {
    try {
      const rawLyrics = await backend.fetcher();
      if (rawLyrics && rawLyrics.trim().length > 0) {
        // If it was XML format (TTML), convert it to LRC
        if (rawLyrics.startsWith("<tt") || rawLyrics.startsWith("<?xml")) {
          const lrc = convertTTMLToLRC(rawLyrics);
          if (lrc.plain || lrc.synced) {
            return {
              id: Date.now(),
              name: cleanTrack,
              trackName: cleanTrack,
              artistName: cleanArtist,
              albumName: albumName || "",
              duration: duration || 0,
              instrumental: false,
              plainLyrics: lrc.plain || '',
              syncedLyrics: lrc.synced || '',
              romanizedLyrics: lrc.plainRom || lrc.syncedRom || undefined
            };
          }
        } else {
          const hasTimestamps = rawLyrics.includes('[');
          return {
            id: Date.now(),
            name: cleanTrack,
            trackName: cleanTrack,
            artistName: cleanArtist,
            albumName: albumName || "",
            duration: duration || 0,
            instrumental: false,
            plainLyrics: hasTimestamps ? '' : rawLyrics,
            syncedLyrics: hasTimestamps ? rawLyrics : ''
          };
        }
      }
    } catch (e) {
    }
  }

  return null;
};
