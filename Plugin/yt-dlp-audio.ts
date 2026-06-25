import _ytdlp from 'yt-dlp-exec';
import fs from 'fs';

interface CacheEntry {
    url: string;
    expiresAt: number; 
}

const MIN_REQUEST_INTERVAL_MS = 1500;

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const STREAM_URL_EXPIRY_SAFETY_MS = 60 * 1000;

const MAX_CACHE_SIZE = 200;

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


export class YtDlpAudio {
    private cookiesPath: string | null = null;
    private ytdlpInstance: any = _ytdlp;
    
        setYtDlpInstance(instance: any) {
        this.ytdlpInstance = instance;
    }

        private urlCache = new Map<string, CacheEntry>();

        private lastRequestTime = 0;

        private taskQueue: Array<{ isPriority: boolean; resolve: (onDone: () => void) => void }> = [];
    private isProcessingQueue = false;

        setCookiesPath(cookiesPath: string) {
        if (fs.existsSync(cookiesPath)) {
            if (this.cookiesPath !== cookiesPath) {
                console.log(`[YtDlp] Using cookies file: ${cookiesPath}`);
            }
            this.cookiesPath = cookiesPath;
        } else {
            console.warn(`[YtDlp] Cookies file not found: ${cookiesPath}`);
        }
    }

        private static readonly PLAYER_CLIENTS = [
        'mweb,default',
        'web,default',
        'tv_embedded',
        'android',
    ];

    private getYouTubeOptions(quality: string | undefined, formatExt: string | undefined, extra: Record<string, any> = {}, playerClient = 'mweb,default'): Record<string, any> {
        
        
        
        let formatStr = 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio/best';
        let extFilter = '';
        
        if (formatExt === 'mp4' || formatExt === 'm4a') extFilter = '[ext=m4a]';
        else if (formatExt === 'webm') extFilter = '[ext=webm]';

        if (quality) {
            
            const q = parseInt(quality, 10);
            formatStr = `bestaudio${extFilter}[abr<=${q}]/bestaudio${extFilter}/bestaudio/best`;
        } else if (extFilter) {
            formatStr = `bestaudio${extFilter}/bestaudio/best`;
        }

        const opts: Record<string, any> = {
            format: formatStr,
            noPlaylist: true,
            noWarnings: true,
            geoBypass: true,
            noCheckCertificates: true,
            extractorArgs: `youtube:player_client=${playerClient}`,
            ...extra
        };

        if (this.cookiesPath && fs.existsSync(this.cookiesPath)) {
            opts.cookies = this.cookiesPath;
        }

        console.log(`[YtDlp] Generated Options: format="${formatStr}", extractorArgs="${opts.extractorArgs}"`);

        return opts;
    }

        private isBotDetectionError(err: any): boolean {
        const msg: string = err?.stderr || err?.message || '';
        return (
            msg.includes('Sign in to confirm') ||
            msg.includes('bot') ||
            msg.includes('HTTP Error 429') ||
            msg.includes('Precondition check failed')
        );
    }

        private getCacheKey(trackName: string, artistName: string, quality?: string, formatExt?: string): string {
        return `${trackName.toLowerCase().trim()}::${artistName.toLowerCase().trim()}::${quality||'default'}::${formatExt||'default'}`;
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

        private setCachedUrl(key: string, url: string): void {
        
        if (this.urlCache.size >= MAX_CACHE_SIZE) {
            const firstKey = this.urlCache.keys().next().value;
            if (firstKey) {
                console.log(`[YtDlp] 🫗 Cache full (${MAX_CACHE_SIZE}). Evicting oldest entry: ${firstKey.split('::').slice(0, 2).join(' - ')}`);
                this.urlCache.delete(firstKey);
            }
        }

        this.urlCache.set(key, {
            url,
            expiresAt: calculateCacheExpiry(url)
        });
    }

    invalidateCachedUrl(trackName: string, artistName: string, quality?: string, formatExt?: string): void {
        const key = this.getCacheKey(trackName, artistName, quality, formatExt);
        if (this.urlCache.has(key)) {
            console.log(`[YtDlp] Invalidated cached URL for "${trackName}" by ${artistName}`);
            this.urlCache.delete(key);
        }
    }

        private async waitForRateLimit(isPriority = false): Promise<() => void> {
        return new Promise(resolve => {
            if (isPriority) {
                
                const firstNonPriorityIndex = this.taskQueue.findIndex(t => !t.isPriority);
                if (firstNonPriorityIndex === -1) {
                    this.taskQueue.push({ isPriority, resolve });
                } else {
                    this.taskQueue.splice(firstNonPriorityIndex, 0, { isPriority, resolve });
                }
            } else {
                this.taskQueue.push({ isPriority, resolve });
            }
            this.processQueue();
        });
    }

    private async processQueue() {
        if (this.isProcessingQueue) return;
        this.isProcessingQueue = true;

        while (this.taskQueue.length > 0) {
            const task = this.taskQueue.shift()!;
            
            const now = Date.now();
            const elapsed = now - this.lastRequestTime;

            if (elapsed < MIN_REQUEST_INTERVAL_MS) {
                const waitTime = MIN_REQUEST_INTERVAL_MS - elapsed;
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }

            await new Promise<void>((resolve) => {
                task.resolve(resolve);
            });

            this.lastRequestTime = Date.now();
        }

        this.isProcessingQueue = false;
    }

        async getStreamUrl(trackName: any, artistName: any, quality?: string, formatExt?: string, signal?: AbortSignal, isPriority = false): Promise<string> {
        formatExt = 'webm';
        const tName = typeof trackName === 'string' ? trackName : (trackName?.name || String(trackName || 'unknown'));
        const aName = typeof artistName === 'string' ? artistName : (artistName?.name || String(artistName || 'unknown'));
        
        const cacheKey = this.getCacheKey(tName, aName, quality, formatExt);

        
        const cachedUrl = this.getCachedUrl(cacheKey);
        if (cachedUrl) {
            console.log(`[YtDlp] Cache hit for "${tName}" by ${aName} [Quality: ${quality||'default'}]`);
            return cachedUrl;
        }

        console.log(`[YtDlp] Fetching stream for "${tName}" by ${aName} at max quality ${quality || 'default'} kbps`);
        const query = `"${tName}" ${aName}`;

        try {
            if (signal?.aborted) throw Object.assign(new Error('AbortError'), { name: 'AbortError' });

            
            const onDone = await this.waitForRateLimit(isPriority);

            try {
                
                if (signal?.aborted) {
                    throw Object.assign(new Error('AbortError'), { name: 'AbortError' });
                }

                let lastError: any = null;

                
                for (const client of YtDlpAudio.PLAYER_CLIENTS) {
                    if (signal?.aborted) {
                        throw Object.assign(new Error('AbortError'), { name: 'AbortError' });
                    }

                    try {
                        const child = this.ytdlpInstance.exec(`ytsearch1:${query}`, this.getYouTubeOptions(quality, formatExt, {
                            getUrl: true,
                            quiet: true
                        }, client));

                        if (signal) {
                            const onAbort = () => {
                                try { child.cancel(); } catch (e) {  }
                            };
                            signal.addEventListener('abort', onAbort);
                            child.finally(() => signal.removeEventListener('abort', onAbort)).catch(() => {});
                        }

                        const rawOutput = await child;
                        const url = (typeof rawOutput === 'string' ? rawOutput : (rawOutput as any).stdout || '').trim();

                        if (!url || !url.startsWith('http')) {
                            throw new Error(`Incomplete URL from yt-dlp: ${url || '[empty]'}`);
                        }

                        
                        this.setCachedUrl(cacheKey, url);
                        console.log(`[YtDlp] Cached URL for "${tName}" by ${aName} [${quality||'default'}] via client="${client}" (${this.urlCache.size} entries)`);

                        return url;

                    } catch (err: any) {
                        if (err.isCanceled || signal?.aborted || err.name === 'AbortError') throw err;

                        lastError = err;

                        if (this.isBotDetectionError(err)) {
                            console.warn(`[YtDlp] Bot detection with client="${client}", trying next...`);
                            continue; 
                        }

                        
                        throw err;
                    }
                }

                
                console.error('YtDlpAudio execution error:', lastError);
                throw new Error(`Failed to get stream URL: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
            } finally {
                onDone();
            }
        } catch (error: any) {
            if (error.isCanceled || signal?.aborted || error.name === 'AbortError') {
                const abortError = new Error('AbortError');
                abortError.name = 'AbortError';
                throw abortError;
            }

            throw error;
        }
    }

    async downloadTrack(trackName: any, artistName: any, outputPath: string, quality?: string, formatExt?: string, onProgress?: (progress: number) => void, signal?: AbortSignal): Promise<string> {
        formatExt = 'webm';
        const tName = typeof trackName === 'string' ? trackName : (trackName?.name || String(trackName || 'unknown'));
        const aName = typeof artistName === 'string' ? artistName : (artistName?.name || String(artistName || 'unknown'));
        
        console.log(`[YtDlp] Starting download for "${tName}" by ${aName} at max quality ${quality || 'default'} kbps to ${outputPath}`);
        const query = `"${tName}" ${aName}`;

        
        const onDone = await this.waitForRateLimit();

        try {
            let lastError: any = null;

            
            for (const client of YtDlpAudio.PLAYER_CLIENTS) {
                if (signal?.aborted) throw Object.assign(new Error('AbortError'), { name: 'AbortError' });

                try {
                    console.log(`[YtDlp] Trying player_client="${client}" for download of "${tName}"`);
                    await this._downloadFromYouTube(query, outputPath, quality, formatExt, onProgress, signal, client);
                    return outputPath;
                } catch (err: any) {
                    
                    if (err.isCanceled || signal?.aborted || err.message === 'Download Aborted' || err.name === 'AbortError') {
                        throw err;
                    }

                    lastError = err;

                    if (this.isBotDetectionError(err)) {
                        console.warn(`[YtDlp] Bot detection during download with client="${client}", trying next...`);
                        continue; 
                    }

                    
                    throw new Error(`yt-dlp exited with error: ${err.message}`);
                }
            }

            
            throw new Error(`Download failed after trying all clients: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
        } finally {
            onDone();
        }
    }

    private _downloadFromYouTube(query: string, outputPath: string, quality?: string, formatExt?: string, onProgress?: (progress: number) => void, signal?: AbortSignal, playerClient = 'mweb,default'): Promise<void> {
        return new Promise((resolve, reject) => {
            const extraOptions: Record<string, any> = {
                output: outputPath,
                newline: true
            };

            const child = this.ytdlpInstance.exec(`ytsearch1:${query}`, this.getYouTubeOptions(quality, formatExt, extraOptions, playerClient));

            if (signal) {
                const onAbort = () => {
                    child.cancel();
                    reject(new Error('Download Aborted'));
                };
                signal.addEventListener('abort', onAbort);
                child.finally(() => signal.removeEventListener('abort', onAbort)).catch(() => {});
            }

            child.stdout?.on('data', (data: any) => {
                const output = data.toString();
                const match = output.match(/\[download\]\s+([\d.]+)%/);
                if (match && match[1] && onProgress) {
                    onProgress(parseFloat(match[1]));
                }
            });

            child.then(() => resolve()).catch((err: any) => {
                if (err.isCanceled || signal?.aborted) return;
                reject(err);
            });
        });
    }

        async clearCache(): Promise<void> {
        this.urlCache.clear();
        console.log('[YtDlp] In-memory URL cache cleared.');
        
        try {
            
            await this.ytdlpInstance.exec('', { rmCacheDir: true });
            console.log('[YtDlp] Disk cache cleared (--rm-cache-dir).');
        } catch (err: any) {
            if (err?.code === 'ENOENT' || err?.message?.includes('not recognized')) {
                console.warn('[YtDlp] Disk cache could not be cleared because yt-dlp is missing (it will be downloaded automatically).');
            } else {
                console.warn('[YtDlp] Failed to clear disk cache (non-critical).');
            }
        }
    }

    async update(): Promise<string> {
        console.log('[YtDlp] 🔄 Checking for yt-dlp binary updates from GitHub...');
        try {
            const res = await this.ytdlpInstance.exec('', { update: true });
            const output = (typeof res === 'string' ? res : res?.stdout || '').trim();
            console.log(`[YtDlp] 📥 Update Result: ${output}`);
            return output;
        } catch (err: any) {
            console.error('[YtDlp] ❌ Failed to update yt-dlp binary:', err);
            throw err;
        }
    }
}

