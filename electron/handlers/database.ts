import { ipcMain } from 'electron';
import fs from 'fs';
import { getDatabase } from '../database.js';

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

export function registerDatabaseHandlers() {
    const db = getDatabase();

    ipcMain.handle('get-local-favorites', () => {
        if (!db) return [];
        try {
            const stmt = db.prepare('SELECT * FROM favorites ORDER BY addedAt DESC');
            return stmt.all();
        } catch (error) {
            console.error('Favorites Retrieval Error', error);
            return [];
        }
    });

    ipcMain.handle('add-local-favorite', (_event, track) => {
        if (!db) return false;
        try {
            const normalized = normalizeTrackForDB(track);
            const stmt = db.prepare(`
                INSERT OR REPLACE INTO favorites (id, name, artist, albumName, albumArt, durationMs, addedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            stmt.run(normalized.id, normalized.name, normalized.artist, normalized.albumName, normalized.albumArt, normalized.durationMs, Date.now());
            return true;
        } catch (error) {
            console.error('Favorites Save Error', error);
            return false;
        }
    });

    ipcMain.handle('remove-local-favorite', (_event, trackId) => {
        if (!db) return false;
        try {
            const stmt = db.prepare('DELETE FROM favorites WHERE id = ?');
            stmt.run(trackId);
            return true;
        } catch (error) {
            console.error('Favorites Delete Error', error);
            return false;
        }
    });

    ipcMain.handle('check-local-favorite', (_event, trackId) => {
        if (!db) return false;
        try {
            const result = db.prepare('SELECT 1 FROM favorites WHERE id = ?').get(trackId);
            return !!result;
        } catch (error) {
            return false;
        }
    });

    ipcMain.handle('get-pinned-collections', () => {
        if (!db) return [];
        try {
            const stmt = db.prepare('SELECT * FROM pinned_collections ORDER BY pinnedAt DESC');
            return stmt.all();
        } catch (error) {
            console.error('Pinned Collections Retrieval Error', error);
            return [];
        }
    });

    ipcMain.handle('toggle-pinned-collection', (_event, collection) => {
        if (!db) return false;
        try {
            const check = db.prepare('SELECT id FROM pinned_collections WHERE id = ?').get(collection.id);
            if (check) {
                db.prepare('DELETE FROM pinned_collections WHERE id = ?').run(collection.id);
                return false;
            } else {
                db.prepare(`
                    INSERT INTO pinned_collections (id, name, type, image, pinnedAt)
                    VALUES (?, ?, ?, ?, ?)
                `).run(collection.id, collection.name, collection.type, collection.image, Date.now());
                return true;
            }
        } catch (error) {
            console.error('Pinned Collection Toggle Error', error);
            return false;
        }
    });

    ipcMain.handle('check-is-pinned', (_event, id) => {
        if (!db) return false;
        try {
            const result = db.prepare('SELECT 1 FROM pinned_collections WHERE id = ?').get(id);
            return !!result;
        } catch (error) {
            return false;
        }
    });

    ipcMain.handle('get-recent-tracks', () => {
        if (!db) return [];
        try {
            const stmt = db.prepare('SELECT * FROM recent ORDER BY playedAt DESC LIMIT 50');
            return stmt.all();
        } catch (error) {
            console.error('Recent Database Retrieval Error', error);
            return [];
        }
    });

    ipcMain.handle('add-recent-track', (_event, track) => {
        if (!db) return;
        try {
            const normalized = normalizeTrackForDB(track);
            const stmt = db.prepare(`
                INSERT OR REPLACE INTO recent (id, name, artist, albumArt, durationMs, playedAt)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            stmt.run(normalized.id, normalized.name, normalized.artist, normalized.albumArt, normalized.durationMs, Date.now());
        } catch (error) {
            console.error('Recent Database Save Error', error);
        }
    });

    ipcMain.handle('clear-recent-tracks', () => {
        if (!db) return;
        try {
            const stmt = db.prepare('DELETE FROM recent');
            stmt.run();
        } catch (error) {
            console.error('Recent Database Clear Error', error);
        }
    });

    ipcMain.handle('get-downloads', async () => {
        if (!db) return [];
        try {
            const stmt = db.prepare('SELECT * FROM downloads ORDER BY downloadedAt DESC');
            const items = stmt.all();
            
            // Perform existence checks in parallel
            const checkResults = await Promise.all(
                items.map(async (item: any) => {
                    if (!item.localPath) return { item, exists: false };
                    try {
                        await fs.promises.access(item.localPath);
                        return { item, exists: true };
                    } catch {
                        return { item, exists: false };
                    }
                })
            );

            const validItems = [];
            const invalidIds = [];

            for (const res of checkResults) {
                if (res.exists) {
                    validItems.push(res.item);
                } else {
                    invalidIds.push(res.item.id);
                }
            }

            // Cleanup invalid entries in a single transaction
            if (invalidIds.length > 0) {
                const deleteStmt = db.prepare('DELETE FROM downloads WHERE id = ?');
                const deleteBatch = db.transaction((ids: string[]) => {
                    for (const id of ids) deleteStmt.run(id);
                });
                deleteBatch(invalidIds);
            }

            return validItems;
        } catch (error) {
            console.error('Downloads Retrieval Error', error);
            return [];
        }
    });

    ipcMain.handle('check-is-downloaded', async (_event, id) => {
        if (!db) return false;
        try {
            const result = db.prepare('SELECT localPath FROM downloads WHERE id = ?').get(id);
            if (result && result.localPath) {
                try {
                    await fs.promises.access(result.localPath);
                    return true;
                } catch {
                    db.prepare('DELETE FROM downloads WHERE id = ?').run(id);
                    return false;
                }
            }
            return false;
        } catch (error) {
            return false;
        }
    });

    ipcMain.handle('get-playlists', () => {
        if (!db) return [];
        try {
            const stmt = db.prepare('SELECT * FROM playlists ORDER BY createdAt DESC');
            return stmt.all();
        } catch (error) {
            console.error('Database Retrieval Error', error);
            return [];
        }
    });

    ipcMain.handle('create-playlist', (_event, playlist) => {
        if (!db) return { success: false, error: 'Database not initialized' };
        try {
            const id = `local-${Date.now()}`;
            const stmt = db.prepare('INSERT INTO playlists (id, name, description, artwork, createdAt) VALUES (?, ?, ?, ?, ?)');
            stmt.run(id, playlist.name, playlist.description || '', playlist.artwork || null, Date.now());
            return {
                success: true,
                playlist: {
                    id,
                    name: playlist.name,
                    description: playlist.description || '',
                    artwork: playlist.artwork || null,
                    createdAt: Date.now()
                }
            };
        } catch (error) {
            console.error('Database Create Error', error);
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('update-playlist', (_event, playlist) => {
        if (!db) return { success: false, error: 'Database not initialized' };
        try {
            const stmt = db.prepare('UPDATE playlists SET name = ?, description = ?, artwork = ? WHERE id = ?');
            stmt.run(playlist.name, playlist.description, playlist.artwork, playlist.id);
            return { success: true };
        } catch (error) {
            console.error('Database Update Error', error);
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('delete-playlist', (_event, id) => {
        if (!db) return { success: false, error: 'Database not initialized' };
        try {
            const stmt = db.prepare('DELETE FROM playlists WHERE id = ?');
            stmt.run(id);
            return { success: true };
        } catch (error) {
            console.error('Database Delete Error', error);
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('get-playlist', (_event, id) => {
        try {
            const stmt = db.prepare('SELECT * FROM playlists WHERE id = ?');
            return stmt.get(id);
        } catch (error) {
            console.error('Database Get Error', error);
            return null;
        }
    });

    ipcMain.handle('add-track-to-playlist', (_event, { playlistId, track }) => {
        if (!db) return false;
        try {
            const normalized = normalizeTrackForDB(track);
            const stmt = db.prepare(`
                INSERT OR REPLACE INTO playlist_tracks (playlistId, trackId, name, artist, albumName, albumArt, durationMs, addedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);

            stmt.run(
                playlistId,
                normalized.id,
                normalized.name,
                normalized.artist,
                normalized.albumName,
                normalized.albumArt,
                normalized.durationMs,
                Date.now()
            );
            return true;
        } catch (error) {
            console.error('Add Track to Playlist Error', error);
            return false;
        }
    });

    ipcMain.handle('remove-track-from-playlist', (_event, { playlistId, trackId }) => {
        if (!db) return false;
        try {
            const stmt = db.prepare('DELETE FROM playlist_tracks WHERE playlistId = ? AND trackId = ?');
            stmt.run(playlistId, trackId);
            return true;
        } catch (error) {
            console.error('Remove Track from Playlist Error', error);
            return false;
        }
    });

    ipcMain.handle('get-playlist-tracks', (_event, playlistId) => {
        if (!db) return [];
        try {
            const stmt = db.prepare('SELECT * FROM playlist_tracks WHERE playlistId = ? ORDER BY addedAt DESC');
            return stmt.all(playlistId);
        } catch (error) {
            console.error('Get Playlist Tracks Error', error);
            return [];
        }
    });

    ipcMain.handle('get-track-playlists', (_event, trackId) => {
        if (!db) return [];
        try {
            const stmt = db.prepare('SELECT playlistId FROM playlist_tracks WHERE trackId = ?');
            const results = stmt.all(trackId);
            return results.map((r: any) => r.playlistId);
        } catch (error) {
            console.error('Get Track Playlists Error', error);
            return [];
        }
    });

    ipcMain.handle('get-saved-library', () => {
        if (!db) return [];
        try {
            const stmt = db.prepare('SELECT * FROM saved_library ORDER BY savedAt DESC');
            return stmt.all();
        } catch (error) {
            console.error('Saved Library Retrieval Error', error);
            return [];
        }
    });

    ipcMain.handle('save-to-library', (_event, item) => {
        if (!db) return false;
        try {
            const stmt = db.prepare(`
                INSERT OR REPLACE INTO saved_library (id, name, type, image, owner, description, totalTracks, savedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            stmt.run(
                item.id,
                item.name,
                item.type || 'playlist',
                item.image || '',
                item.owner || '',
                item.description || '',
                item.totalTracks || 0,
                Date.now()
            );
            return true;
        } catch (error) {
            console.error('Save to Library Error', error);
            return false;
        }
    });

    ipcMain.handle('remove-from-library', (_event, id) => {
        if (!db) return false;
        try {
            db.prepare('DELETE FROM saved_library WHERE id = ?').run(id);
            return true;
        } catch (error) {
            console.error('Remove from Library Error', error);
            return false;
        }
    });

    ipcMain.handle('check-in-library', (_event, id) => {
        if (!db) return false;
        try {
            const result = db.prepare('SELECT 1 FROM saved_library WHERE id = ?').get(id);
            return !!result;
        } catch (error) {
            return false;
        }
    });
}
