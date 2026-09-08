import { ipcMain, app, session, shell, BrowserWindow } from "electron";
import fs from "fs";
import path from "path";
import * as nodeUrl from "node:url";
import http from "http";
import { getDatabase } from "../database.js";
import { normalizeTrackForDB } from "./database.js";
import { getAudioEngine, getFallbackEngine, activeSearches, activeDownloads } from "../streaming.js";
import { audioCacheManager } from "../audioCache.js";
import { StoreSchema, schema } from "../store.js";
import Store from "electron-store";

let proxyPort = 0;
const proxyServer = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
    });
    res.end();
    return;
  }

  const reqUrl = req.url || '';
  if (!reqUrl.startsWith('/stream')) {
    res.writeHead(404);
    res.end();
    return;
  }

  const queryIndex = reqUrl.indexOf('?');
  if (queryIndex === -1) {
    res.writeHead(400);
    res.end('Missing query');
    return;
  }

  const queryParams = new URLSearchParams(reqUrl.slice(queryIndex));
  const localFilePathHex = queryParams.get('localPath');
  if (localFilePathHex) {
    try {
      const localFilePath = Buffer.from(localFilePathHex, 'hex').toString();
      if (fs.existsSync(localFilePath)) {
        const ext = path.extname(localFilePath).toLowerCase();
        const mimeTypes: Record<string, string> = {
          '.webm': 'audio/webm', '.m4a': 'audio/mp4', '.mp4': 'audio/mp4',
          '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.flac': 'audio/flac', '.wav': 'audio/wav'
        };
        audioCacheManager.serveLocalFile(localFilePath, req, res, mimeTypes[ext] || 'audio/mp4');
        return;
      }
    } catch (e) {}
  }

  const cachedTrackId = queryParams.get('cachedId');

  // Check if serving from local audio cache directly
  if (cachedTrackId) {
    const cachedFile = audioCacheManager.get(cachedTrackId);
    if (cachedFile) {
      const mime = cachedFile.endsWith('.mp4') ? 'audio/mp4' : 'audio/webm';
      audioCacheManager.serveLocalFile(cachedFile, req, res, mime);
      return;
    }
  }

  const targetUrl = queryParams.get('url');
  const trackIdToCache = queryParams.get('cacheTrackId') || '';

  if (!targetUrl) {
    res.writeHead(400);
    res.end('Missing url');
    return;
  }

  let resolvedUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  let resolvedAuth = '';
  let cleanTargetUrl = targetUrl;
  try {
    const parsed = new URL(targetUrl);
    const uaParam = parsed.searchParams.get('__luniq_ua');
    if (uaParam) {
      resolvedUserAgent = decodeURIComponent(uaParam);
      parsed.searchParams.delete('__luniq_ua');
    }
    const authParam = parsed.searchParams.get('__luniq_auth');
    if (authParam) {
      resolvedAuth = decodeURIComponent(authParam);
      parsed.searchParams.delete('__luniq_auth');
    }
    cleanTargetUrl = parsed.toString();
  } catch (e) {}

  let start = 0;
  let end: number | null = null;
  let isRangeRequest = false;
  if (req.headers.range) {
    isRangeRequest = true;
    const parts = req.headers.range.replace(/bytes=/, "").split("-");
    start = parseInt(parts[0], 10);
    if (parts[1]) {
      end = parseInt(parts[1], 10);
    }
  }

  const headers: Record<string, string> = {
    'User-Agent': resolvedUserAgent
  };

  if (resolvedAuth) {
    headers['Authorization'] = resolvedAuth;
  }

  if (isRangeRequest) {
    if (end !== null) {
      headers['Range'] = `bytes=${start}-${end}`;
    } else {
      headers['Range'] = `bytes=${start}-`;
    }
  }

  const controller = new AbortController();
  // Note: Do NOT abort fetch controller immediately on req 'close' if we are caching track from start 0
  // Instead, let background caching continue so seeking / range requests have the full audio in local cache.

  globalThis.fetch(cleanTargetUrl, {
    headers,
    signal: controller.signal
  })
    .then((targetRes) => {
      if (targetRes.status === 403) {
        console.warn(`[Proxy] 403 Forbidden details:`, {
          statusText: targetRes.statusText,
          headers: Object.fromEntries(targetRes.headers.entries()),
          targetUrl,
          sentHeaders: headers
        });
      }

      const mimeType = targetRes.headers.get('content-type') || 'audio/webm';
      const resHeaders: Record<string, string> = {
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache',
      };

      const cLength = targetRes.headers.get('content-length');
      if (cLength) resHeaders['Content-Length'] = cLength;

      const cRange = targetRes.headers.get('content-range');
      if (cRange) resHeaders['Content-Range'] = cRange;

      if (!res.headersSent) {
        res.writeHead(targetRes.status, resHeaders);
      }

      // Progressive cache writer if streaming from the beginning (start === 0) and response is valid audio
      const isValidAudioResponse = (targetRes.status === 200 || targetRes.status === 206) && !mimeType.includes('text/html') && !mimeType.includes('application/json');
      const shouldCache = isValidAudioResponse && trackIdToCache && (!isRangeRequest || start === 0);
      const cacheWriter = shouldCache
        ? audioCacheManager.startCaching(trackIdToCache, mimeType)
        : null;

      if (targetRes.body) {
        const reader = targetRes.body.getReader();
        let clientClosed = false;

        req.on('close', () => {
          clientClosed = true;
          // If we are not actively caching to disk, cancel upstream immediately to save bandwidth
          if (!cacheWriter) {
            controller.abort();
            reader.cancel().catch(() => {});
          }
        });

        const pump = async () => {
          const { done, value } = await reader.read();
          if (done) {
            cacheWriter?.commit();
            if (!res.writableEnded) res.end();
            return;
          }
          if (value) {
            cacheWriter?.write(value);
            if (!clientClosed && !res.writableEnded) {
              const canContinue = res.write(value);
              if (!canContinue) {
                res.once('drain', pump);
                return;
              }
            }
          }
          await pump();
        };
        pump().catch((err) => {
          if (err.name === 'AbortError' || err.message?.includes('aborted')) {
            cacheWriter?.abort();
            return;
          }
          console.error('[Proxy] Stream piping error:', err);
          cacheWriter?.abort();
          if (!res.writableEnded) res.end();
        });
      } else {
        cacheWriter?.abort();
        if (!res.writableEnded) res.end();
      }
    })
    .catch((err) => {
      if (err.name === 'AbortError' || err.message?.includes('aborted')) return;
      console.error('[Proxy] Request error:', err);
      if (!res.headersSent) {
        res.writeHead(500);
      }
      if (!res.writableEnded) res.end();
    });
});

proxyServer.keepAliveTimeout = 65000;
proxyServer.headersTimeout = 66000;

proxyServer.listen(0, '127.0.0.1', () => {
  const addr = proxyServer.address();
  proxyPort = typeof addr === 'string' ? 0 : addr?.port || 0;
  console.log(`[Proxy] Local stream proxy running on http://127.0.0.1:${proxyPort}`);
});

const store = new Store<StoreSchema>({ schema: schema as any });

let lastClearCache = 0;
const CLEAR_CACHE_DEBOUNCE_MS = 2_000;

export function registerStreamingHandlers() {
  const db = getDatabase();

  const getDownloadsDir = async () => {
    const customDir = store.get("downloadLocation");
    if (customDir) {
      try {
        await fs.promises.access(customDir);
        return customDir;
      } catch (e) {}
    }
    const defaultDir = path.join(app.getPath("userData"), "downloads");
    try {
      await fs.promises.access(defaultDir);
    } catch (e) {
      await fs.promises.mkdir(defaultDir, { recursive: true });
    }
    return defaultDir;
  };

  const getStreamUrlWithFallback = async (
    trackName: string,
    artistName: string,
    audioQuality: string,
    audioFormat: string,
    signal: AbortSignal,
    isPriority: boolean,
    durationMs: number,
    options: {
      forceRefresh?: boolean;
      preferFallback?: boolean;
      trackId?: string;
    } = {},
  ): Promise<string> => {
    const {
      forceRefresh = false,
      preferFallback = false,
      trackId = '',
    } = options;

    const engines = preferFallback
      ? [getFallbackEngine(), getAudioEngine()]
      : [getAudioEngine(), getFallbackEngine()];

    const startTime = performance.now();
    let lastError: any = null;
    for (const engine of engines) {
      try {
        if (forceRefresh && typeof (engine as any).invalidateCachedUrl === "function") {
          (engine as any).invalidateCachedUrl(
            trackName,
            artistName,
            audioQuality,
            "webm",
          );
        }

        const url = await engine.getStreamUrl(
          trackName,
          artistName,
          audioQuality,
          audioFormat,
          signal,
          isPriority,
          durationMs,
        );

        if (!url) {
          throw new Error("Empty stream URL returned by engine");
        }

        let client = 'default';
        try {
          const parsed = new URL(url);
          client = parsed.searchParams.get('c') || 'default';
        } catch (e) {}

        const engineName = engine.constructor.name.replace('Audio', '').toLowerCase();
        console.log(`[Audio Engine] Resolved "${trackName}" via ${engineName} (${client}) in ${Math.round(performance.now() - startTime)}ms`);

        const cacheParam = trackId ? `&cacheTrackId=${encodeURIComponent(trackId)}` : '';
        const localUrl = `http://127.0.0.1:${proxyPort}/stream?url=${encodeURIComponent(url)}${cacheParam}`;
        return localUrl;
      } catch (error: any) {
        if (error.name === "AbortError" || signal.aborted) {
          throw error;
        }
        lastError = error;
        console.warn(
          `[Audio Engine] ${engine.constructor.name} failed for "${trackName}":`,
          error.message || error,
        );
      }
    }

    throw lastError || new Error("All audio engines failed");
  };

  const downloadTrackWithFallback = async (
    trackName: string,
    artistName: string,
    localPath: string,
    downloadQuality: string,
    downloadFormat: string,
    onProgress: (progress: number) => void,
    signal: AbortSignal,
  ): Promise<string> => {
    const primary = getAudioEngine();
    const fallback = getFallbackEngine();

    try {
      return await primary.downloadTrack(
        trackName,
        artistName,
        localPath,
        downloadQuality,
        downloadFormat,
        onProgress,
        signal,
      );
    } catch (error: any) {
      if (error.name === "AbortError" || signal.aborted) {
        throw error;
      }
      console.log(
        `[Audio Engine] Primary engine failed for download "${trackName}", trying fallback...`,
      );
      return await fallback.downloadTrack(
        trackName,
        artistName,
        localPath,
        downloadQuality,
        downloadFormat,
        onProgress,
        signal,
      );
    }
  };

  ipcMain.handle(
    "get-stream-url",
    async (
      _event,
      trackName: string,
      artistName: string,
      trackId: string = "unknown",
      isPriority: boolean = false,
      requester: string = "unknown",
      durationMs: number = 0,
      forceRefresh: boolean = false,
      preferFallback: boolean = false,
    ) => {
      try {
        if (trackId && trackId !== "unknown") {
          // 1. Check offline permanent downloads in DB
          if (db) {
            const local = db
              .prepare("SELECT localPath FROM downloads WHERE id = ?")
              .get(trackId);
            if (local && local.localPath) {
              try {
                await fs.promises.access(local.localPath);
                const hex = Buffer.from(local.localPath).toString("hex");
                console.log(`[Stream] 💾 Playing downloaded offline track: "${trackName}" (${local.localPath})`);
                return `http://127.0.0.1:${proxyPort}/stream?localPath=${hex}`;
              } catch (e) {}
            }
          }

          // 2. Check instant replay cache unless forced refresh
          if (!forceRefresh) {
            const cachedFilePath = audioCacheManager.get(trackId);
            if (cachedFilePath) {
              console.log(`[AudioCache] ⚡ Instant Replay cache hit for "${trackName}" (ID: ${trackId})`);
              return `http://127.0.0.1:${proxyPort}/stream?cachedId=${encodeURIComponent(trackId)}`;
            }
          }
        }

        const rId =
          requester !== "unknown"
            ? requester
            : isPriority
              ? "player"
              : "prefetch";

        let search = activeSearches.get(trackId);
        if (!search || forceRefresh) {
          if (search && forceRefresh) {
            search.controller.abort();
            activeSearches.delete(trackId);
            console.log(
              `[Main] Force refresh requested, aborted existing fetch for: ${trackId}`,
            );
          }

          const controller = new AbortController();
          const lowDataMode = store.get("lowDataMode") || false;
          const audioQuality = lowDataMode
            ? "96"
            : store.get("audioQuality") || "128";
          const audioFormat = "webm";


          const promise = getStreamUrlWithFallback(
            trackName,
            artistName,
            audioQuality,
            audioFormat,
            controller.signal,
            isPriority,
            durationMs,
            { forceRefresh, preferFallback, trackId },
          );
          search = { controller, promise, requesters: new Set() };
          activeSearches.set(trackId, search);
        } else {
          // joining stream fetch
        }

        search.requesters.add(rId);

        try {
          const url = await search.promise;
          return url;
        } finally {
          const currentSearch = activeSearches.get(trackId);
          if (currentSearch) {
            currentSearch.requesters.delete(rId);
            if (currentSearch.requesters.size === 0) {
              activeSearches.delete(trackId);
            }
          }
        }
      } catch (error: any) {
        if (error.name === "AbortError") {
          return "";
        }
        console.error("Error fetching stream URL:", error);
        return "";
      }
    },
  );

  ipcMain.handle(
    "cancel-stream",
    (_event, trackId: string, requester: string = "unknown") => {
      const search = activeSearches.get(trackId);
      if (search) {
        const rId = requester !== "unknown" ? requester : "player";

        search.requesters.delete(rId);
        console.log(
          `[Main] Requester "${rId}" cancelled for track: ${trackId}. Remaining: ${search.requesters.size}`,
        );

        if (search.requesters.size === 0) {
          search.controller.abort();
          activeSearches.delete(trackId);
          console.log(
            `[Main] All requesters cancelled. Aborting fetch for track: ${trackId}`,
          );
          return true;
        }
        return false;
      }
      return false;
    },
  );

  ipcMain.handle(
    "invalidate-stream-cache",
    async (
      _event,
      trackName: string,
      artistName: string,
      trackId: string = "unknown",
    ) => {
      try {
        const lowDataMode = store.get("lowDataMode") || false;
        const audioQuality = lowDataMode
          ? "96"
          : store.get("audioQuality") || "128";

        getAudioEngine().invalidateCachedUrl(
          trackName,
          artistName,
          audioQuality,
          "webm",
        );
        getFallbackEngine().invalidateCachedUrl(
          trackName,
          artistName,
          audioQuality,
          "webm",
        );

        if (trackId && trackId !== "unknown") {
          audioCacheManager.remove(trackId);
        }

        const search = activeSearches.get(trackId);
        if (search) {
          search.controller.abort();
          activeSearches.delete(trackId);
        }

        console.log(
          `[Main] Invalidated stream cache for: ${trackName} - ${artistName} (ID: ${trackId})`,
        );
        return { success: true };
      } catch (err) {
        console.error("Failed to invalidate stream cache:", err);
        return { success: false, error: String(err) };
      }
    },
  );

  ipcMain.handle("clear-cache", async () => {
    const now = Date.now();
    if (now - lastClearCache < CLEAR_CACHE_DEBOUNCE_MS) {
      return { success: true };
    }
    lastClearCache = now;

    try {
      await getAudioEngine().clearCache();
      await audioCacheManager.clear();
      activeSearches.forEach((val) => val.controller.abort());
      activeSearches.clear();

      if (session.defaultSession) {
        await session.defaultSession.clearCache();
        console.log("[Main] Electron session cache cleared.");
      }

      return { success: true };
    } catch (err) {
      console.error("Failed to clear cache:", err);
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle("open-cache-folder", async () => {
    try {
      const userDataPath = app.getPath("userData");
      console.log(`[Main] Opening data folder: ${userDataPath}`);

      try {
        await fs.promises.access(userDataPath);
      } catch (e) {
        await fs.promises.mkdir(userDataPath, { recursive: true });
      }

      const error = await shell.openPath(userDataPath);
      if (error) {
        console.error(
          `[Main] shell.openPath failed: ${error}. Trying openExternal...`,
        );
        await shell.openExternal(nodeUrl.pathToFileURL(userDataPath).href);
      }
      return true;
    } catch (err) {
      console.error("Failed to open cache folder:", err);
      return false;
    }
  });

  ipcMain.handle("download-track", async (_event, track) => {
    if (!db) return false;
    const normalized = normalizeTrackForDB(track);

    if (activeDownloads.has(normalized.id)) {
      return true;
    }

    try {
      const existing = db
        .prepare("SELECT localPath FROM downloads WHERE id = ?")
        .get(normalized.id);
      if (existing && existing.localPath) {
        if (fs.existsSync(existing.localPath)) {
          return true;
        } else {
          db.prepare("DELETE FROM downloads WHERE id = ?").run(normalized.id);
        }
      }

      const ext = "webm";
      const fileName = `${normalized.id}.${ext}`;
      const targetDir = await getDownloadsDir();
      const localPath = path.join(targetDir, fileName);

      const controller = new AbortController();
      activeDownloads.set(normalized.id, controller);

      BrowserWindow.getAllWindows().forEach((w) =>
        w.webContents.send("download-progress", {
          id: normalized.id,
          name: normalized.name,
          progress: 0.1,
        }),
      );

      try {
        const lowDataMode = store.get("lowDataMode") || false;
        const downloadQuality = lowDataMode
          ? "96"
          : store.get("downloadQuality") || "256";

        console.log(
          `[Main] Downloading track: ${normalized.name} - ${normalized.artist} | Max Quality: ${downloadQuality} kbps | Format: webm${lowDataMode ? " (Low Data Mode)" : ""}`,
        );

        await downloadTrackWithFallback(
          normalized.name,
          normalized.artist,
          localPath,
          downloadQuality,
          ext,
          (progress: number) => {
            BrowserWindow.getAllWindows().forEach((w) =>
              w.webContents.send("download-progress", {
                id: normalized.id,
                name: normalized.name,
                progress,
              }),
            );
          },
          controller.signal,
        );
      } finally {
        activeDownloads.delete(normalized.id);
      }

      const stmt = db.prepare(`
                INSERT INTO downloads (id, name, artist, albumName, albumArt, durationMs, localPath, downloadedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
      stmt.run(
        normalized.id,
        normalized.name,
        normalized.artist,
        normalized.albumName,
        normalized.albumArt,
        normalized.durationMs,
        localPath,
        Date.now(),
      );

      BrowserWindow.getAllWindows().forEach((w) =>
        w.webContents.send("luniq:download-status-changed"),
      );

      return true;
    } catch (error) {
      console.error("Download Track Error", error);

      BrowserWindow.getAllWindows().forEach((w) =>
        w.webContents.send("download-progress", {
          id: normalized.id,
          name: normalized.name,
          progress: -1,
        }),
      );
      return false;
    }
  });

  ipcMain.handle("remove-download", async (_event, id) => {
    if (activeDownloads.has(id)) {
      activeDownloads.get(id)?.abort();
      activeDownloads.delete(id);
    }
    if (!db) return false;
    try {
      const existing = db
        .prepare("SELECT localPath FROM downloads WHERE id = ?")
        .get(id);
      if (existing && existing.localPath) {
        try {
          await fs.promises.unlink(existing.localPath);
        } catch (err) {
          console.warn("Failed to delete existing download file:", err);
        }
      }

      try {
        const targetDir = await getDownloadsDir();
        const files = await fs.promises.readdir(targetDir);
        for (const file of files) {
          if (file.startsWith(id + ".")) {
            const fullPath = path.join(targetDir, file);
            try {
              await fs.promises.unlink(fullPath);
            } catch (err) {
              console.warn("Failed to delete partial file:", err);
            }
          }
        }
      } catch (cleanupErr) {
        console.warn("Failed to cleanup partial download files:", cleanupErr);
      }

      db.prepare("DELETE FROM downloads WHERE id = ?").run(id);

      BrowserWindow.getAllWindows().forEach((w) =>
        w.webContents.send("luniq:download-status-changed"),
      );

      return true;
    } catch (error) {
      console.error("Remove Download Error", error);
      return false;
    }
  });
}
