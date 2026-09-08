import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import http from 'http';

export interface CachedTrackMetadata {
    id: string;
    filePath: string;
    mimeType: string;
    size: number;
    lastAccessed: number;
}

export class AudioCacheManager {
    private cacheDir: string;
    private maxCachedTracks: number = 25;
    private maxCacheSizeBytes: number = 350 * 1024 * 1024; // 350 MB cap
    private activeWriters: Map<string, {
        tempPath: string;
        finalPath: string;
        writeStream: fs.WriteStream;
        bytesWritten: number;
        mimeType: string;
    }> = new Map();

    constructor() {
        this.cacheDir = path.join(app.getPath('userData'), 'audio-cache');
        this.ensureCacheDir();
    }

    private ensureCacheDir() {
        try {
            if (!fs.existsSync(this.cacheDir)) {
                fs.mkdirSync(this.cacheDir, { recursive: true });
            }
            this.cleanupOrphanedTmpFiles();
        } catch (err) {
            console.error('[AudioCache] Failed to create audio-cache dir:', err);
        }
    }

    private cleanupOrphanedTmpFiles() {
        try {
            const files = fs.readdirSync(this.cacheDir);
            const now = Date.now();
            for (const file of files) {
                if (file.endsWith('.tmp')) {
                    const fullPath = path.join(this.cacheDir, file);
                    try {
                        const stats = fs.statSync(fullPath);
                        // Clean up .tmp files older than 5 minutes that aren't actively being written
                        if (now - stats.mtimeMs > 5 * 60 * 1000) {
                            fs.unlinkSync(fullPath);
                            console.log(`[AudioCache] Cleaned up stale temporary cache file: ${file}`);
                        }
                    } catch (_) {}
                }
            }
        } catch (_) {}
    }

    public getCacheDir(): string {
        return this.cacheDir;
    }

    public get(trackId: string): string | null {
        if (!trackId || trackId === 'unknown') return null;
        this.ensureCacheDir();

        const possibleExts = ['.webm', '.mp4', '.m4a', '.audio'];
        for (const ext of possibleExts) {
            const candidate = path.join(this.cacheDir, `${trackId}${ext}`);
            try {
                if (fs.existsSync(candidate)) {
                    const stats = fs.statSync(candidate);
                    if (stats.size > 100 * 1024) { // Minimum 100KB for valid audio file
                        // Validate magic bytes to ensure it is not an HTML error page or corrupted JSON
                        const fd = fs.openSync(candidate, 'r');
                        const headerBuf = Buffer.alloc(16);
                        fs.readSync(fd, headerBuf, 0, 16, 0);
                        fs.closeSync(fd);

                        // Check if file starts with HTML/text markers: '<', '{', '[', ' '
                        const firstByte = headerBuf[0];
                        if (firstByte === 0x3C || firstByte === 0x7B || firstByte === 0x5B || firstByte === 0x20 || firstByte === 0x0A) {
                            console.warn(`[AudioCache] Detected corrupted/HTML cache file for ${trackId}. Deleting...`);
                            try { fs.unlinkSync(candidate); } catch (_) {}
                            continue;
                        }

                        // Update mtime to mark recently used
                        const now = new Date();
                        fs.utimes(candidate, now, now, () => {});
                        return candidate;
                    }
                }
            } catch (e) {}
        }
        return null;
    }

    public has(trackId: string): boolean {
        return this.get(trackId) !== null;
    }

    public remove(trackId: string): boolean {
        if (!trackId || trackId === 'unknown') return false;
        this.abortWriter(trackId);
        this.ensureCacheDir();
        let removed = false;
        const possibleExts = ['.webm', '.mp4', '.m4a', '.audio'];
        for (const ext of possibleExts) {
            const candidate = path.join(this.cacheDir, `${trackId}${ext}`);
            try {
                if (fs.existsSync(candidate)) {
                    fs.unlinkSync(candidate);
                    removed = true;
                    console.log(`[AudioCache] Deleted cached track file: ${path.basename(candidate)}`);
                }
            } catch (e) {}
        }
        return removed;
    }

    public startCaching(trackId: string, mimeType: string = 'audio/webm'): {
        write: (chunk: Uint8Array | Buffer) => void;
        commit: () => void;
        abort: () => void;
    } {
        if (!trackId || trackId === 'unknown') {
            return {
                write: () => {},
                commit: () => {},
                abort: () => {},
            };
        }

        // If already cached or actively caching, don't duplicate
        if (this.has(trackId) || this.activeWriters.has(trackId)) {
            return {
                write: () => {},
                commit: () => {},
                abort: () => {},
            };
        }

        this.ensureCacheDir();

        const ext = mimeType.includes('mp4') || mimeType.includes('m4a') ? '.mp4' : '.webm';
        const tempPath = path.join(this.cacheDir, `${trackId}_${Date.now()}.tmp`);
        const finalPath = path.join(this.cacheDir, `${trackId}${ext}`);

        try {
            const writeStream = fs.createWriteStream(tempPath, { flags: 'w' });
            const writerEntry = {
                tempPath,
                finalPath,
                writeStream,
                bytesWritten: 0,
                mimeType
            };

            this.activeWriters.set(trackId, writerEntry);

            writeStream.on('error', (err) => {
                console.warn(`[AudioCache] Write stream error for track ${trackId}:`, err);
                this.abortWriter(trackId);
            });

            return {
                write: (chunk: Uint8Array | Buffer) => {
                    if (!this.activeWriters.has(trackId)) return;
                    try {
                        writeStream.write(chunk);
                        writerEntry.bytesWritten += chunk.length;
                    } catch (e) {
                        this.abortWriter(trackId);
                    }
                },
                commit: () => {
                    this.commitWriter(trackId);
                },
                abort: () => {
                    this.abortWriter(trackId);
                }
            };
        } catch (err) {
            console.error(`[AudioCache] Could not start caching for ${trackId}:`, err);
            return {
                write: () => {},
                commit: () => {},
                abort: () => {},
            };
        }
    }

    private commitWriter(trackId: string) {
        const entry = this.activeWriters.get(trackId);
        if (!entry) return;

        this.activeWriters.delete(trackId);
        entry.writeStream.end(async () => {
            try {
                if (fs.existsSync(entry.tempPath)) {
                    const stats = await fs.promises.stat(entry.tempPath);
                    if (stats.size > 100 * 1024) {
                        await fs.promises.rename(entry.tempPath, entry.finalPath);
                        console.log(`[AudioCache] Successfully cached track: ${trackId} (${(stats.size / (1024 * 1024)).toFixed(2)} MB)`);
                        this.pruneLRU();
                    } else {
                        await fs.promises.unlink(entry.tempPath).catch(() => {});
                    }
                }
            } catch (err) {
                console.warn(`[AudioCache] Commit failed for ${trackId}:`, err);
                try {
                    await fs.promises.unlink(entry.tempPath).catch(() => {});
                } catch (e) {}
            }
        });
    }

    private abortWriter(trackId: string) {
        const entry = this.activeWriters.get(trackId);
        if (!entry) return;

        this.activeWriters.delete(trackId);
        try {
            entry.writeStream.destroy();
            if (fs.existsSync(entry.tempPath)) {
                fs.unlink(entry.tempPath, () => {});
            }
        } catch (e) {}
    }

    public serveLocalFile(
        filePath: string,
        req: http.IncomingMessage,
        res: http.ServerResponse,
        mimeType: string = 'audio/webm'
    ) {
        try {
            const stat = fs.statSync(filePath);
            const totalSize = stat.size;
            let start = 0;
            let end = totalSize - 1;

            if (req.headers.range) {
                const rangeHeader = req.headers.range;
                const parts = rangeHeader.replace(/bytes=/, '').split('-');
                start = parseInt(parts[0], 10) || 0;
                if (parts[1]) {
                    end = parseInt(parts[1], 10);
                }

                if (start >= totalSize || end >= totalSize) {
                    res.writeHead(416, {
                        'Content-Range': `bytes */${totalSize}`,
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end();
                    return;
                }

                res.writeHead(206, {
                    'Content-Type': mimeType,
                    'Content-Range': `bytes ${start}-${end}/${totalSize}`,
                    'Content-Length': (end - start) + 1,
                    'Accept-Ranges': 'bytes',
                    'Access-Control-Allow-Origin': '*',
                    'X-Luniq-Cache': 'HIT'
                });
            } else {
                res.writeHead(200, {
                    'Content-Type': mimeType,
                    'Content-Length': totalSize,
                    'Accept-Ranges': 'bytes',
                    'Access-Control-Allow-Origin': '*',
                    'X-Luniq-Cache': 'HIT'
                });
            }

            const stream = fs.createReadStream(filePath, { start, end });
            stream.on('error', (err) => {
                console.error('[AudioCache] Stream read error:', err);
                if (!res.headersSent) {
                    res.writeHead(500);
                }
                res.end();
            });

            req.on('close', () => {
                stream.destroy();
            });

            stream.pipe(res);
        } catch (err) {
            console.error('[AudioCache] Failed to serve local cached file:', err);
            if (!res.headersSent) {
                res.writeHead(500);
            }
            res.end();
        }
    }

    public async pruneLRU(): Promise<void> {
        try {
            this.ensureCacheDir();
            const files = await fs.promises.readdir(this.cacheDir);
            const audioFiles: { path: string; size: number; mtime: number }[] = [];

            let totalBytes = 0;
            for (const file of files) {
                if (file.endsWith('.tmp')) {
                    // Check if stale temp file older than 10 mins
                    const fullPath = path.join(this.cacheDir, file);
                    try {
                        const s = await fs.promises.stat(fullPath);
                        if (Date.now() - s.mtimeMs > 10 * 60 * 1000) {
                            await fs.promises.unlink(fullPath);
                        }
                    } catch (e) {}
                    continue;
                }

                if (file.endsWith('.webm') || file.endsWith('.mp4') || file.endsWith('.audio')) {
                    const fullPath = path.join(this.cacheDir, file);
                    try {
                        const s = await fs.promises.stat(fullPath);
                        audioFiles.push({
                            path: fullPath,
                            size: s.size,
                            mtime: s.mtimeMs
                        });
                        totalBytes += s.size;
                    } catch (e) {}
                }
            }

            // Sort oldest accessed first
            audioFiles.sort((a, b) => a.mtime - b.mtime);

            // Prune while over count or byte limits
            while (
                (audioFiles.length > this.maxCachedTracks || totalBytes > this.maxCacheSizeBytes) &&
                audioFiles.length > 0
            ) {
                const oldest = audioFiles.shift();
                if (oldest) {
                    try {
                        await fs.promises.unlink(oldest.path);
                        totalBytes -= oldest.size;
                        console.log(`[AudioCache] Evicted LRU cached track: ${path.basename(oldest.path)}`);
                    } catch (e) {}
                }
            }
        } catch (err) {
            console.warn('[AudioCache] Prune LRU error:', err);
        }
    }

    public async clear(): Promise<void> {
        try {
            // Abort all active writers
            for (const trackId of Array.from(this.activeWriters.keys())) {
                this.abortWriter(trackId);
            }

            this.ensureCacheDir();
            const files = await fs.promises.readdir(this.cacheDir);
            for (const file of files) {
                const fullPath = path.join(this.cacheDir, file);
                try {
                    await fs.promises.unlink(fullPath);
                } catch (e) {}
            }
            console.log('[AudioCache] Cache cleared completely.');
        } catch (err) {
            console.error('[AudioCache] Failed to clear audio cache:', err);
        }
    }
}

export const audioCacheManager = new AudioCacheManager();
