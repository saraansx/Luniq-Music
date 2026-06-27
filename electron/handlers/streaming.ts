import { ipcMain, app, session, shell, BrowserWindow } from "electron";
import fs from "fs";
import path from "path";
import * as nodeUrl from "node:url";
import { getDatabase } from "../database.js";
import { normalizeTrackForDB } from "./database.js";
import { getAudioEngine, getFallbackEngine, activeSearches, activeDownloads } from "../streaming.js";
import { StoreSchema, schema } from "../store.js";
import Store from "electron-store";

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
    } = {},
  ): Promise<string> => {
    const {
      forceRefresh = false,
      preferFallback = false,
    } = options;

    const engines = preferFallback
      ? [getFallbackEngine(), getAudioEngine()]
      : [getAudioEngine(), getFallbackEngine()];

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

        return url;
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
        if (trackId && trackId !== "unknown" && db) {
          const local = db
            .prepare("SELECT localPath FROM downloads WHERE id = ?")
            .get(trackId);
          if (local && local.localPath) {
            try {
              await fs.promises.access(local.localPath);
              return `lune-local://f/${Buffer.from(local.localPath).toString("hex")}`;
            } catch (e) {}
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

          console.log(
            `[Main] Starting new stream fetch for: ${trackName} - ${artistName} (ID: ${trackId})${forceRefresh ? " [force refresh]" : ""}${preferFallback ? " [prefer fallback]" : ""}`,
          );

          const promise = getStreamUrlWithFallback(
            trackName,
            artistName,
            audioQuality,
            audioFormat,
            controller.signal,
            isPriority,
            durationMs,
            { forceRefresh, preferFallback },
          );
          search = { controller, promise, requesters: new Set() };
          activeSearches.set(trackId, search);
        } else {
          console.log(
            `[Main] Joining existing stream fetch for: ${trackName} (ID: ${trackId}) [Count: ${search.requesters.size}]`,
          );
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
              console.log(
                `[Main] Fetch completed and cleared for track: ${trackId}`,
              );
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
        w.webContents.send("lune:download-status-changed"),
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
        w.webContents.send("lune:download-status-changed"),
      );

      return true;
    } catch (error) {
      console.error("Remove Download Error", error);
      return false;
    }
  });
}
