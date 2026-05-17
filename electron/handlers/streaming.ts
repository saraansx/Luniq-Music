import { ipcMain, app, session, shell, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import * as nodeUrl from 'node:url';
import { getDatabase } from '../database.js';
import { ytDlp, activeSearches, activeDownloads } from '../streaming.js';
import { StoreSchema, schema } from '../store.js';
import Store from 'electron-store';

const store = new Store<StoreSchema>({ schema: schema as any }); 

function normalizeTrackForDB(track: any) {
    const artist = Array.isArray(track.artists)
        ? track.artists.map((a: any) => typeof a === 'string' ? a : (a.name || '')).join(', ')
        : track.artist || 'Unknown Artist';

    return {
        id: track.id || track.trackId || 'unknown',
        name: track.name || 'Unknown Track',
        artist: artist,
        albumName: track.albumName || track.album?.name || '',
        albumArt: track.albumArt || track.albumArtFull || track.images?.[0]?.url || track.album?.images?.[0]?.url || '',
        durationMs: track.durationMs || track.duration_ms || track.duration?.totalMilliseconds || track.trackDuration?.totalMilliseconds || 0
    };
}

export function registerStreamingHandlers() {
    const db = getDatabase();

    const getDownloadsDir = async () => {
        const customDir = store.get('downloadLocation');
        if (customDir) {
            try {
                await fs.promises.access(customDir);
                return customDir;
            } catch (e) {}
        }
        const defaultDir = path.join(app.getPath('userData'), 'downloads');
        try {
            await fs.promises.access(defaultDir);
        } catch (e) {
            await fs.promises.mkdir(defaultDir, { recursive: true });
        }
        return defaultDir;
    };

    ipcMain.handle('get-stream-url', async (_event, trackName: string, artistName: string, trackId: string = 'unknown', isPriority: boolean = false, requester: string = 'unknown') => {
        try {
            if (trackId && trackId !== 'unknown' && db) {
                const local = db.prepare('SELECT localPath FROM downloads WHERE id = ?').get(trackId);
                if (local && local.localPath) {
                    try {
                        await fs.promises.access(local.localPath);
                        return `lune-local://f/${Buffer.from(local.localPath).toString('hex')}`;
                    } catch (e) {}
                }
            }

            // Use isPriority to infer requester if not provided (old frontend support)
            const rId = requester !== 'unknown' ? requester : (isPriority ? 'player' : 'prefetch');

            let search = activeSearches.get(trackId);
            if (!search) {
                const controller = new AbortController();
                const lowDataMode = store.get('lowDataMode') || false;
                const audioQuality = lowDataMode ? '96' : (store.get('audioQuality') || '128');
                const audioFormat = store.get('audioFormat') || 'mp4';

                console.log(`[Main] Starting new stream fetch for: ${trackName} - ${artistName} (ID: ${trackId})`);

                const promise = ytDlp.getStreamUrl(trackName, artistName, audioQuality, audioFormat, controller.signal, isPriority);
                search = { controller, promise, requesters: new Set() };
                activeSearches.set(trackId, search);
            } else {
                console.log(`[Main] Joining existing stream fetch for: ${trackName} (ID: ${trackId}) [Count: ${search.requesters.size}]`);
            }

            search.requesters.add(rId);

            try {
                const url = await search.promise;
                return url;
            } finally {
                // Cleanup after natural completion OR abortion
                const currentSearch = activeSearches.get(trackId);
                if (currentSearch) {
                    currentSearch.requesters.delete(rId);
                    if (currentSearch.requesters.size === 0) {
                        activeSearches.delete(trackId);
                        console.log(`[Main] Fetch completed and cleared for track: ${trackId}`);
                    }
                }
            }
        } catch (error: any) {
            if (error.name === 'AbortError') {
                return '';
            }
            console.error('Error fetching stream URL:', error);
            return '';
        }
    });

    ipcMain.handle('cancel-stream', (_event, trackId: string, requester: string = 'unknown') => {
        const search = activeSearches.get(trackId);
        if (search) {
            const rId = requester !== 'unknown' ? requester : 'player'; 
            
            search.requesters.delete(rId);
            console.log(`[Main] Requester "${rId}" cancelled for track: ${trackId}. Remaining: ${search.requesters.size}`);

            if (search.requesters.size === 0) {
                search.controller.abort();
                activeSearches.delete(trackId);
                console.log(`[Main] All requesters cancelled. Aborting fetch for track: ${trackId}`);
                return true;
            }
            return false;
        }
        return false;
    });

    ipcMain.handle('clear-cache', async () => {
        try {
            await ytDlp.clearCache();
            activeSearches.forEach(val => val.controller.abort());
            activeSearches.clear();

            if (session.defaultSession) {
                await session.defaultSession.clearCache();
                console.log('[Main] Electron session cache cleared.');
            }

            return { success: true };
        } catch (err) {
            console.error('Failed to clear cache:', err);
            return { success: false, error: String(err) };
        }
    });

    ipcMain.handle('open-cache-folder', async () => {
        try {
            const userDataPath = app.getPath('userData');
            console.log(`[Main] Opening data folder: ${userDataPath}`);

            try {
                await fs.promises.access(userDataPath);
            } catch (e) {
                await fs.promises.mkdir(userDataPath, { recursive: true });
            }

            const error = await shell.openPath(userDataPath);
            if (error) {
                console.error(`[Main] shell.openPath failed: ${error}. Trying openExternal...`);
                await shell.openExternal(nodeUrl.pathToFileURL(userDataPath).href);
            }
            return true;
        } catch (err) {
            console.error('Failed to open cache folder:', err);
            return false;
        }
    });

    ipcMain.handle('download-track', async (_event, track) => {
        if (!db) return false;
        const normalized = normalizeTrackForDB(track);
        
        // Prevent multiple simultaneous downloads for the same track
        if (activeDownloads.has(normalized.id)) {
            return true;
        }

        try {
            const existing = db.prepare('SELECT localPath FROM downloads WHERE id = ?').get(normalized.id);
            if (existing && existing.localPath) {
                if (fs.existsSync(existing.localPath)) {
                    return true;
                } else {
                    db.prepare('DELETE FROM downloads WHERE id = ?').run(normalized.id);
                }
            }

            const downloadFormat = store.get('downloadFormat') || 'mp4';
            const ext = downloadFormat === 'webm' ? 'webm' : 'm4a';
            const fileName = `${normalized.id}.${ext}`;
            const targetDir = await getDownloadsDir();
            const localPath = path.join(targetDir, fileName);

            const controller = new AbortController();
            activeDownloads.set(normalized.id, controller);

            // Notify frontend immediately that download has started (fetching info phase)
            BrowserWindow.getAllWindows().forEach(w => w.webContents.send('download-progress', {
                id: normalized.id,
                name: normalized.name,
                progress: 0.1 // Small non-zero to trigger the UI indicator
            }));

            try {
                const lowDataMode = store.get('lowDataMode') || false;
                const downloadQuality = lowDataMode ? '96' : (store.get('downloadQuality') || '256');

                console.log(`[Main] Downloading track: ${normalized.name} - ${normalized.artist} | Max Quality: ${downloadQuality} kbps | Format: ${downloadFormat}${lowDataMode ? ' (Low Data Mode)' : ''}`);

                await ytDlp.downloadTrack(normalized.name, normalized.artist, localPath, downloadQuality, downloadFormat, (progress: number) => {
                    BrowserWindow.getAllWindows().forEach(w => w.webContents.send('download-progress', {
                        id: normalized.id,
                        name: normalized.name,
                        progress
                    }));
                }, controller.signal);
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
                Date.now()
            );
            
            // Notify all renderers
            BrowserWindow.getAllWindows().forEach(w => w.webContents.send('lune:download-status-changed'));

            return true;
        } catch (error) {
            console.error('Download Track Error', error);
            // Notify frontend that download failed to prevent "Ghost UI"
            BrowserWindow.getAllWindows().forEach(w => w.webContents.send('download-progress', {
                id: normalized.id,
                name: normalized.name,
                progress: -1 // Special value for error
            }));
            return false;
        }
    });

    ipcMain.handle('remove-download', async (_event, id) => {
        if (activeDownloads.has(id)) {
            activeDownloads.get(id)?.abort();
            activeDownloads.delete(id);
        }
        if (!db) return false;
        try {
            const existing = db.prepare('SELECT localPath FROM downloads WHERE id = ?').get(id);
            if (existing && existing.localPath) {
                try {
                    await fs.promises.unlink(existing.localPath);
                } catch (err) {
                    console.warn('Failed to delete existing download file:', err);
                }
            }

            try {
                const targetDir = await getDownloadsDir();
                const files = await fs.promises.readdir(targetDir);
                for (const file of files) {
                    if (file.startsWith(id + '.')) {
                        const fullPath = path.join(targetDir, file);
                        try {
                            await fs.promises.unlink(fullPath);
                        } catch (err) {
                            console.warn('Failed to delete partial file:', err);
                        }
                    }
                }
            } catch (cleanupErr) {
                console.warn('Failed to cleanup partial download files:', cleanupErr);
            }

            db.prepare('DELETE FROM downloads WHERE id = ?').run(id);
            
            // Notify all renderers
            BrowserWindow.getAllWindows().forEach(w => w.webContents.send('lune:download-status-changed'));

            return true;
        } catch (error) {
            console.error('Remove Download Error', error);
            return false;
        }
    });
}
