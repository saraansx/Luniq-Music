import { LyricData } from './index';
import { convertTTMLToLRC } from './parser';

const BASE_URLS = [
  "https://lyricsplus.binimum.org/",
  "https://lyricsplus.prjktla.my.id/",
  "https://lyricsplus.prjktla.workers.dev/",
  "https://lyricsplus.atomix.one/",
  "https://lyricsplus-seven.vercel.app/"
];

interface YouLyPlusSyllable {
  time?: number;
  duration?: number;
  text?: string;
  isBackground?: boolean;
}

interface YouLyPlusLine {
  time?: number;
  duration?: number;
  text?: string;
  syllabus?: YouLyPlusSyllable[];
}

interface YouLyPlusLyricsResponse {
  type?: string;
  lyrics?: YouLyPlusLine[];
}

function formatLrcTimestamp(timeMs: number, bracketed: boolean): string {
  const safeTime = Math.max(0, timeMs);
  const minutes = Math.floor(safeTime / 60000);
  const seconds = Math.floor((safeTime % 60000) / 1000);
  const millis = safeTime % 1000;
  
  const minStr = minutes.toString().padStart(2, '0');
  const secStr = seconds.toString().padStart(2, '0');
  const milStr = millis.toString().padStart(3, '0');
  const timestamp = `${minStr}:${secStr}.${milStr}`;
  return bracketed ? `[${timestamp}]` : `<${timestamp}>`;
}

function toLyricsText(response: YouLyPlusLyricsResponse): string | null {
  const lyrics = response.lyrics || [];
  if (lyrics.length === 0) return null;

  const timedLines = lyrics.filter(l => l.time !== undefined && l.time !== null);
  if (timedLines.length > 0) {
    return timedLines
      .map(line => {
        let lineText = '';
        lineText += formatLrcTimestamp(line.time || 0, true);
        
        const syllables = (line.syllabus || []).filter(
          s => s.text && s.text.trim().length > 0 && s.time !== undefined && s.time !== null
        );
        
        if (response.type?.toLowerCase() === 'word' && syllables.length > 0) {
          syllables.forEach(syllable => {
            lineText += formatLrcTimestamp(syllable.time || 0, false);
            lineText += syllable.text || '';
          });
        } else {
          lineText += line.text || '';
        }
        return lineText;
      })
      .join('\n');
  }

  return lyrics
    .map(l => l.text?.trim() || '')
    .filter(t => t.length > 0)
    .join('\n');
}

export const fetchYouLyPlusLyrics = async (
  trackName: string,
  artistName: string,
  duration?: number,
  albumName?: string
): Promise<LyricData | null> => {
  const cleanTrack = trackName.trim();
  const cleanArtist = artistName.trim();
  const cleanAlbum = albumName?.trim() || '';
  if (!cleanTrack || !cleanArtist) return null;

  const durationSec = duration ? Math.floor(duration) : -1;

  const fetchWithMirrors = async (path: string): Promise<string | null> => {
    for (const baseUrl of BASE_URLS) {
      try {
        const url = new URL(path, baseUrl);
        url.searchParams.append('title', cleanTrack);
        url.searchParams.append('artist', cleanArtist);
        if (cleanAlbum) url.searchParams.append('album', cleanAlbum);
        if (durationSec > 0) url.searchParams.append('duration', durationSec.toString());

        const res = await fetch(url.toString(), {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'ArchiveTune'
          }
        });

        if (res.ok) {
          const body = await res.text();
          if (body && body.trim().length > 0) {
            return body;
          }
        }
      } catch (e) {
        // try next mirror
      }
    }
    return null;
  };

  try {
    // 1. Try to fetch TTML first
    const ttmlBody = await fetchWithMirrors('v1/ttml/get');
    if (ttmlBody) {
      const trimmed = ttmlBody.trim();
      let ttmlText = '';
      if (trimmed.startsWith('<')) {
        ttmlText = trimmed;
      } else {
        try {
          const parsed = JSON.parse(trimmed);
          ttmlText = parsed.ttml?.trim() || '';
        } catch (e) {}
      }

      if (ttmlText && ttmlText.startsWith('<')) {
        const lrc = convertTTMLToLRC(ttmlText);
        return {
          id: Date.now(),
          name: cleanTrack,
          trackName: cleanTrack,
          artistName: cleanArtist,
          albumName: cleanAlbum,
          duration: duration || 0,
          instrumental: false,
          plainLyrics: lrc.plain || '',
          syncedLyrics: lrc.synced || '',
          romanizedLyrics: lrc.plainRom || lrc.syncedRom || undefined
        };
      }
    }

    // 2. Try to fetch LRC lyrics
    const lrcBody = await fetchWithMirrors('v2/lyrics/get');
    if (lrcBody) {
      try {
        const parsed: YouLyPlusLyricsResponse = JSON.parse(lrcBody);
        const lrcText = toLyricsText(parsed);
        if (lrcText) {
          const hasTimestamps = lrcText.includes('[');
          return {
            id: Date.now(),
            name: cleanTrack,
            trackName: cleanTrack,
            artistName: cleanArtist,
            albumName: cleanAlbum,
            duration: duration || 0,
            instrumental: false,
            plainLyrics: hasTimestamps ? '' : lrcText,
            syncedLyrics: hasTimestamps ? lrcText : ''
          };
        }
      } catch (e) {}
    }

    return null;
  } catch (e) {
    return null;
  }
};
