import { Innertube, Platform } from "youtubei.js";
import fs from "fs";
import { Readable } from "stream";

Platform.shim.eval = async (data: any) => {
  return new Function(data.output)();
};

interface CacheEntry {
  url: string;
  expiresAt: number;
}

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_SIZE = 200;
const STREAM_URL_EXPIRY_SAFETY_MS = 60 * 1000;

const STREAM_CLIENTS = [
  "TV",
  "TV_EMBEDDED",
  "IOS",
  "ANDROID_VR",
  "ANDROID",
  "WEB_REMIX",
  "WEB",
  "WEB_EMBEDDED",
  "WEB_CREATOR",
  "MWEB",
  "YTMUSIC_ANDROID",
  "DEFAULT",
] as const;

type StreamClient = (typeof STREAM_CLIENTS)[number];

export interface YoutubeiAudioConfig {
  useAlternativeCipher?: boolean;
}

function matchTokens(str: string): Set<string> {
  return new Set(
    (str || "")
      .toLowerCase()
      .replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((t) => t.length > 0),
  );
}

function tokenOverlap(left: string, right: string): number {
  const leftTokens = Array.from(matchTokens(left));
  if (leftTokens.length === 0) return 0;
  const rightTokens = matchTokens(right);
  return leftTokens.filter((t) => rightTokens.has(t)).length;
}

function matchesDuration(
  candidateDurationSeconds: number,
  expectedDurationSeconds: number,
): boolean {
  if (expectedDurationSeconds <= 0) return true;
  if (candidateDurationSeconds <= 0) return true;
  const tolerance = Math.max(15, (expectedDurationSeconds * 10) / 100);
  return (
    Math.abs(candidateDurationSeconds - expectedDurationSeconds) <= tolerance
  );
}

function extractExpireTimestampMsFromUrl(url: string): number | null {
  try {
    const match = url.match(/[?&]expire=(\d+)/);
    if (match && match[1]) {
      const seconds = parseInt(match[1], 10);
      if (!isNaN(seconds)) {
        return seconds * 1000;
      }
    }
  } catch {}
  return null;
}

function calculateCacheExpiry(url: string): number {
  const expireMs = extractExpireTimestampMsFromUrl(url);
  if (expireMs) {
    return Math.max(0, expireMs - STREAM_URL_EXPIRY_SAFETY_MS);
  }
  return Date.now() + DEFAULT_CACHE_TTL_MS;
}

function extractCodec(mimeType: string): string {
  const match = (mimeType || "").match(/codecs="([^"]+)"/);
  return match ? match[1] : "";
}

function codecRank(codec: string): number {
  const c = (codec || "").toLowerCase();
  if (c.includes("opus")) return 3;
  if (c.includes("mp4a")) return 2;
  return 1;
}

function calculateScore(
  candidate: any,
  expectedTitle: string,
  expectedArtist: string,
  expectedDurationSeconds: number,
): number {
  const cTitle =
    typeof candidate.title === "string"
      ? candidate.title
      : candidate.title?.text || "";
  const cArtist =
    typeof candidate.author === "string"
      ? candidate.author
      : candidate.author?.name || "";
  const cDuration = candidate.duration?.seconds || 0;

  const titleScore = tokenOverlap(expectedTitle, cTitle) * 4;

  const artistScore = Math.max(
    tokenOverlap(expectedArtist, cArtist),
    tokenOverlap(expectedArtist, cTitle),
  );

  let durationScore = 0;
  if (expectedDurationSeconds > 0 && cDuration > 0) {
    durationScore = Math.max(
      0,
      20 - Math.abs(cDuration - expectedDurationSeconds),
    );
  }

  return titleScore + artistScore * 3 + durationScore;
}

export class YoutubeiAudio {
  private youtube: Innertube | null = null;
  private initPromise: Promise<Innertube> | null = null;
  private urlCache = new Map<string, CacheEntry>();
  private cookiesPath: string = "";

  setCookiesPath(cookiesPath: string) {
    this.cookiesPath = cookiesPath;
  }

  setYtDlpInstance(_instance: any) {}

  private parseNetscapeCookies(filePath: string): string {
    try {
      if (!fs.existsSync(filePath)) return "";
      const lines = fs.readFileSync(filePath, "utf-8").split("\n");
      const cookies: string[] = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const parts = trimmed.split("\t");
        if (parts.length >= 7) {
          cookies.push(`${parts[5]}=${parts[6]}`);
        }
      }
      return cookies.join("; ");
    } catch (err) {
      console.warn("[Youtubei] Failed to parse Netscape cookies:", err);
      return "";
    }
  }

  private async getYoutubeInstance(): Promise<Innertube> {
    if (this.youtube) return this.youtube;
    if (this.initPromise) return this.initPromise;

    console.log("[Youtubei] Initializing Innertube...");
    const options: any = {};
    if (this.cookiesPath) {
      const cookie = this.parseNetscapeCookies(this.cookiesPath);
      if (cookie) {
        options.cookie = cookie;
      }
    }

    this.initPromise = Innertube.create(options)
      .then((instance) => {
        this.youtube = instance;
        return instance;
      })
      .catch((err: any) => {
        this.initPromise = null;
        console.error("[Youtubei] Failed to initialize Innertube:", err);
        throw err;
      });
    return this.initPromise;
  }

  private getCacheKey(
    trackName: string,
    artistName: string,
    quality?: string,
    formatExt?: string,
  ): string {
    return `${trackName.toLowerCase().trim()}::${artistName.toLowerCase().trim()}::${quality || "default"}::${formatExt || "default"}`;
  }

  private getCachedUrl(key: string): string | null {
    const entry = this.urlCache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.urlCache.delete(key);
      return null;
    }

    return entry.url;
  }

  invalidateCachedUrl(trackName: string, artistName: string, quality?: string, formatExt?: string): void {
    const key = this.getCacheKey(trackName, artistName, quality, formatExt);
    if (this.urlCache.has(key)) {
      console.log(`[Youtubei] Invalidated cached URL for "${trackName}" by ${artistName}`);
      this.urlCache.delete(key);
    }
  }

  private setCachedUrl(key: string, url: string): void {
    if (this.urlCache.size >= MAX_CACHE_SIZE) {
      const firstKey = this.urlCache.keys().next().value;
      if (firstKey) {
        console.log(
          `[Youtubei] Cache full. Evicting oldest entry: ${firstKey}`,
        );
        this.urlCache.delete(firstKey);
      }
    }

    this.urlCache.set(key, {
      url,
      expiresAt: calculateCacheExpiry(url),
    });
  }

  private getInfoWithClient(
    yt: Innertube,
    videoId: string,
    client: StreamClient,
  ): Promise<any> {
    switch (client) {
      case "WEB_REMIX":
        return yt.music.getInfo(videoId);
      case "DEFAULT":
        return yt.getInfo(videoId);
      default:
        return yt.getInfo(videoId, { client: client as any });
    }
  }

  private selectAudioFormat(
    videoInfo: any,
    quality?: string,
    formatExt?: string,
  ): any {
    try {
      const adaptiveFormats = videoInfo.streaming_data?.adaptive_formats || [];
      const audioFormats = adaptiveFormats.filter(
        (f: any) => f.has_audio && !f.has_video,
      );

      if (!audioFormats || audioFormats.length === 0) {
        return videoInfo.chooseFormat({ type: "audio", quality: "best" });
      }

      let filtered = audioFormats;
      if (formatExt && formatExt !== "any" && formatExt !== "default") {
        filtered = audioFormats.filter((f: any) => {
          const mime = (f.mime_type || "").toLowerCase();
          return mime.includes(formatExt.toLowerCase());
        });
      }
      if (filtered.length === 0) {
        filtered = audioFormats;
      }

      filtered.sort((a: any, b: any) => {
        const rankA = codecRank(extractCodec(a.mime_type));
        const rankB = codecRank(extractCodec(b.mime_type));
        if (rankA !== rankB) return rankB - rankA;

        if (quality && quality !== "default") {
          const targetBitrate = parseInt(quality, 10) * 1000;
          const bitrateA = a.average_bitrate || a.bitrate || 128000;
          const bitrateB = b.average_bitrate || b.bitrate || 128000;
          return (
            Math.abs(bitrateA - targetBitrate) -
            Math.abs(bitrateB - targetBitrate)
          ); 
        }

        const bitrateA = a.average_bitrate || a.bitrate || 0;
        const bitrateB = b.average_bitrate || b.bitrate || 0;
        return bitrateB - bitrateA;
      });

      const format = filtered[0];
      if (format) {
        const selectedCodec = extractCodec(format.mime_type);
        console.log(
          `[Youtubei] Selected format: ${format.mime_type}, codec: ${selectedCodec || "unknown"}`,
        );
      }
      return format;
    } catch (err) {
      console.warn(
        "[Youtubei] Custom format selection failed, falling back to chooseFormat:",
        err,
      );
      return videoInfo.chooseFormat({ type: "audio", quality: "best" });
    }
  }

  private async fetchStreamUrlWithFallback(
    yt: Innertube,
    videoId: string,
    quality?: string,
    formatExt?: string,
    signal?: AbortSignal,
  ): Promise<{
    url: string;
    format: any;
    videoInfo: any;
    clientName: StreamClient;
  }> {
    let lastError: any = null;

    for (const client of STREAM_CLIENTS) {
      if (signal?.aborted) {
        throw Object.assign(new Error("AbortError"), { name: "AbortError" });
      }

      let videoInfo;
      try {
        console.log(`[Youtubei] Trying stream client ${client} for ${videoId}`);
        videoInfo = await this.getInfoWithClient(yt, videoId, client);
      } catch (err) {
        lastError = err;
        console.warn(`[Youtubei] Stream client ${client} getInfo failed:`, err);
        continue;
      }

      if (!videoInfo) continue;

      const format = this.selectAudioFormat(videoInfo, quality, formatExt);
      if (!format) {
        console.warn(`[Youtubei] No suitable audio format for client ${client}`);
        continue;
      }

      let url: string;
      try {
        url = await format.decipher(yt.session.player);
      } catch (err) {
        lastError = err;
        console.warn(`[Youtubei] Stream client ${client} decipher failed:`, err);
        continue;
      }

      if (!url) {
        console.warn(`[Youtubei] Empty stream URL from client ${client}`);
        continue;
      }

      console.log(
        `[Youtubei] Resolved stream URL with client ${client}: ${url.slice(0, 100)}...`,
      );
      return { url, format, videoInfo, clientName: client };
    }

    throw lastError || new Error("All YouTube stream clients failed");
  }

  async getStreamUrl(
    trackName: any,
    artistName: any,
    quality?: string,
    formatExt?: string,
    signal?: AbortSignal,
    _isPriority = false,
    durationMs: number = 0,
  ): Promise<string> {
    formatExt = "webm";
    const tName =
      typeof trackName === "string"
        ? trackName
        : trackName?.name || String(trackName || "unknown");
    const aName =
      typeof artistName === "string"
        ? artistName
        : artistName?.name || String(artistName || "unknown");
    const cacheKey = this.getCacheKey(tName, aName, quality, formatExt);

    const cachedUrl = this.getCachedUrl(cacheKey);
    if (cachedUrl) {
      console.log(`[Youtubei] Cache hit for "${tName}" by ${aName}`);
      return cachedUrl;
    }

    console.log(`[Youtubei] Fetching stream URL for "${tName}" by ${aName}...`);
    const query = `"${tName}" ${aName}`;

    try {
      if (signal?.aborted)
        throw Object.assign(new Error("AbortError"), { name: "AbortError" });

      const yt = await this.getYoutubeInstance();
      if (signal?.aborted)
        throw Object.assign(new Error("AbortError"), { name: "AbortError" });

      const searchResults = await yt.search(query, { type: "video" });
      if (!searchResults.videos || searchResults.videos.length === 0) {
        throw new Error(`No search results found for "${query}"`);
      }

      let bestVideo = searchResults.videos[0];
      const expectedDurationSecs = Math.floor(durationMs / 1000);

      if (expectedDurationSecs > 0 && searchResults.videos.length > 1) {
        console.log(
          `[Youtubei] Scoring ${searchResults.videos.length} candidates for "${tName}" by ${aName}...`,
        );

        let highestScore = -1;

        for (const video of searchResults.videos) {
          const cDuration = (video as any).duration?.seconds || 0;
          if (!matchesDuration(cDuration, expectedDurationSecs)) {
            continue;                                                    
          }

          const score = calculateScore(
            video,
            tName,
            aName,
            expectedDurationSecs,
          );

          if (score > highestScore) {
            highestScore = score;
            bestVideo = video;
          }
        }

        if (highestScore === -1) {
          console.warn(
            `[Youtubei] All candidates failed duration/token checks. Falling back to first result.`,
          );
          bestVideo = searchResults.videos[0];
        } else {
          const bTitle =
            typeof (bestVideo as any).title === "string"
              ? (bestVideo as any).title
              : (bestVideo as any).title?.text || "";
          console.log(
            `[Youtubei] Selected best match: "${bTitle}" with score ${highestScore}`,
          );
        }
      }

      const videoId = (bestVideo as any).id;

      if (!videoId) {
        throw new Error("Video ID not found in search result");
      }

      if (signal?.aborted)
        throw Object.assign(new Error("AbortError"), { name: "AbortError" });

      const { url } = await this.fetchStreamUrlWithFallback(
        yt,
        videoId,
        quality,
        formatExt,
        signal,
      );

      this.setCachedUrl(cacheKey, url);
      return url;
    } catch (error: any) {
      if (signal?.aborted || error.name === "AbortError") {
        const abortError = new Error("AbortError");
        abortError.name = "AbortError";
        throw abortError;
      }
      console.error("[Youtubei] Error getting stream URL:", error);
      throw error;
    }
  }

  async downloadTrack(
    trackName: any,
    artistName: any,
    outputPath: string,
    quality?: string,
    formatExt?: string,
    onProgress?: (progress: number) => void,
    signal?: AbortSignal,
  ): Promise<string> {
    formatExt = "webm";
    const tName =
      typeof trackName === "string"
        ? trackName
        : trackName?.name || String(trackName || "unknown");
    const aName =
      typeof artistName === "string"
        ? artistName
        : artistName?.name || String(artistName || "unknown");
    const query = `"${tName}" ${aName}`;

    console.log(
      `[Youtubei] Downloading "${tName}" by ${aName} to ${outputPath}...`,
    );

    try {
      if (signal?.aborted)
        throw Object.assign(new Error("AbortError"), { name: "AbortError" });

      const yt = await this.getYoutubeInstance();
      if (signal?.aborted)
        throw Object.assign(new Error("AbortError"), { name: "AbortError" });

      const searchResults = await yt.search(query, { type: "video" });
      if (!searchResults.videos || searchResults.videos.length === 0) {
        throw new Error(`No search results found for "${query}"`);
      }

      const videoId = (searchResults.videos[0] as any).id;
      if (!videoId) throw new Error("Video ID not found in search result");

      if (signal?.aborted)
        throw Object.assign(new Error("AbortError"), { name: "AbortError" });

      const { videoInfo, format } = await this.fetchStreamUrlWithFallback(
        yt,
        videoId,
        quality,
        formatExt,
        signal,
      );

      const contentLength = format.content_length
        ? Number(format.content_length)
        : 0;

      const stream = await videoInfo.download({
        type: "audio",
        itag: format.itag,
      });

      if (signal?.aborted)
        throw Object.assign(new Error("AbortError"), { name: "AbortError" });

      const writeStream = fs.createWriteStream(outputPath);
      let downloadedBytes = 0;

      const reader: any = (stream as any)[Symbol.asyncIterator]
        ? stream
        : Readable.from(stream as any);

      for await (const chunk of reader) {
        if (signal?.aborted) {
          writeStream.destroy();
          try {
            fs.unlinkSync(outputPath);
          } catch (e) {}
          throw Object.assign(new Error("AbortError"), { name: "AbortError" });
        }

        writeStream.write(chunk);
        downloadedBytes += chunk.length;

        if (onProgress && contentLength > 0) {
          const progress = (downloadedBytes / contentLength) * 100;
          onProgress(Math.min(100, Math.max(0, progress)));
        }
      }

      writeStream.end();
      return outputPath;
    } catch (error: any) {
      if (signal?.aborted || error.name === "AbortError") {
        const abortError = new Error("AbortError");
        abortError.name = "AbortError";
        throw abortError;
      }
      console.error("[Youtubei] Error downloading track:", error);
      throw error;
    }
  }

  async clearCache(): Promise<void> {
    this.urlCache.clear();
    console.log("[Youtubei] URL Cache cleared");
  }

  async update(): Promise<string> {
    console.log("[Youtubei] Update requested (no-op for youtubei)");
    return "youtubei.js is managed via npm packages.";
  }
}
