import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';

const dbPath = path.join(app.getPath('userData'), 'database', 'lune.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

let db: any;

export function getDatabase() {
    if (db) return db;

    try {
        db = new Database(dbPath);
        db.exec(`
            -- Local Playlists
            CREATE TABLE IF NOT EXISTS playlists (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                artwork TEXT,
                createdAt INTEGER
            );

            -- Playlist Tracks
            CREATE TABLE IF NOT EXISTS playlist_tracks (
                playlistId TEXT,
                trackId TEXT,
                name TEXT NOT NULL,
                artist TEXT,
                albumName TEXT,
                albumArt TEXT,
                durationMs INTEGER,
                addedAt INTEGER,
                PRIMARY KEY (playlistId, trackId),
                FOREIGN KEY (playlistId) REFERENCES playlists(id) ON DELETE CASCADE
            );

            -- Recent Tracks (History)
            CREATE TABLE IF NOT EXISTS recent (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                artist TEXT,
                albumArt TEXT,
                durationMs INTEGER,
                playedAt INTEGER
            );

            -- Sidebar Pinned Items
            CREATE TABLE IF NOT EXISTS pinned_collections (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                image TEXT,
                pinnedAt INTEGER
            );

            -- Saved / Favorite Tracks
            CREATE TABLE IF NOT EXISTS favorites (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                artist TEXT,
                albumName TEXT,
                albumArt TEXT,
                durationMs INTEGER,
                addedAt INTEGER
            );

            -- Downloaded Tracks
            CREATE TABLE IF NOT EXISTS downloads (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                artist TEXT,
                albumName TEXT,
                albumArt TEXT,
                durationMs INTEGER,
                localPath TEXT,
                downloadedAt INTEGER
            );

            -- Saved Library (locally saved Spotify playlists/albums)
            CREATE TABLE IF NOT EXISTS saved_library (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                image TEXT,
                owner TEXT,
                description TEXT,
                totalTracks INTEGER,
                savedAt INTEGER
            );
        `);
        return db;
    } catch (error) {
        console.error('Failed to initialize unified database:', error);
        return null;
    }
}
