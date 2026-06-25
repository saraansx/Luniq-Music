import { app } from 'electron';
import path from 'path';
import Store from 'electron-store';
import { YoutubeiAudio } from '../Plugin/youtubei-audio.js';
import { YtDlpAudio } from '../Plugin/yt-dlp-audio.js';
import { StoreSchema, schema } from './store.js';

export const youtubeiAudio = new YoutubeiAudio();
export const ytdlpAudio = new YtDlpAudio();

const store = new Store<StoreSchema>({ schema: schema as any });

let lastLoggedEngine: string | null = null;

export function getAudioEngine(): YoutubeiAudio | YtDlpAudio {
    const engine = store.get('audioEngine') || 'youtubei';
    if (engine !== lastLoggedEngine) {
        console.log(`[Audio Engine] Active engine: ${engine}`);
        lastLoggedEngine = engine;
    }
    return engine === 'ytdlp' ? ytdlpAudio : youtubeiAudio;
}

export function getFallbackEngine(): YoutubeiAudio | YtDlpAudio {
    const engine = store.get('audioEngine') || 'youtubei';
    return engine === 'ytdlp' ? youtubeiAudio : ytdlpAudio;
}

export const activeSearches = new Map<string, { 
    controller: AbortController; 
    promise: Promise<string>;
    requesters: Set<string>;
}>();
export const activeDownloads = new Map<string, AbortController>();

const ytCookiesPath = path.join(app.getPath('userData'), 'yt-cookies.txt');
youtubeiAudio.setCookiesPath(ytCookiesPath);
ytdlpAudio.setCookiesPath(ytCookiesPath);
