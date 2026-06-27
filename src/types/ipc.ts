import { LuneTrack } from './track';

export interface IPCChannels {
    
    'spotify-login': () => Promise<{ accessToken: string; cookies: any[]; expiration: number } | { success: false; error: string }>;
    'get-spotify-credentials': (forceRefresh?: boolean) => Promise<{ accessToken: string; cookies: any[]; expiration: number } | null>;
    'logout': () => Promise<boolean>;

    
    'get-saved-library': () => Promise<any[]>;
    'check-in-library': (id: string) => Promise<boolean>;
    'save-to-library': (data: { id: string, name: string, image: string | null, type: 'playlist' | 'album', owner?: string, description?: string, totalTracks?: number }) => Promise<boolean>;
    'remove-from-library': (id: string) => Promise<boolean>;
    'create-playlist': (data: { name: string, description: string, artwork: string | null }) => Promise<{ success: boolean; playlist?: any; error?: string }>;
    'get-playlist': (id: string) => Promise<any>;
    'get-playlist-tracks': (id: string) => Promise<LuneTrack[]>;
    'update-playlist': (data: { id: string, name: string, description: string, artwork: string | null }) => Promise<{ success: boolean; error?: string }>;
    'delete-playlist': (id: string) => Promise<{ success: boolean; error?: string }>;
    'get-playlists': () => Promise<any[]>;
    'get-track-playlists': (id: string) => Promise<string[]>;
    'add-track-to-playlist': (data: { playlistId: string, track: any }) => Promise<boolean>;
    'remove-track-from-playlist': (data: { playlistId: string, trackId: string }) => Promise<boolean>;

    
    'get-pinned-collections': () => Promise<any[]>;
    'toggle-pinned-collection': (collection: { id: string, name: string, type: string, image: string }) => Promise<boolean>;
    'check-is-pinned': (id: string) => Promise<boolean>;

    
    'get-downloads': () => Promise<LuneTrack[]>;
    'check-is-downloaded': (id: string) => Promise<boolean>;
    'remove-download': (id: string) => Promise<boolean>;
    'download-track': (track: any) => Promise<boolean>;

    
    'get-recent-tracks': () => Promise<LuneTrack[]>;
    'add-recent-track': (track: LuneTrack) => Promise<void>;
    'clear-recent-tracks': () => Promise<void>;
    'get-local-favorites': () => Promise<LuneTrack[]>;
    'check-local-favorite': (id: string) => Promise<boolean>;
    'add-local-favorite': (track: any) => Promise<boolean>;
    'remove-local-favorite': (id: string) => Promise<boolean>;

    
    'get-stream-url': (name: string, artist: string, id: string, isPriority?: boolean, requester?: string, durationMs?: number, forceRefresh?: boolean, preferFallback?: boolean) => Promise<string>;
    'cancel-stream': (id: string, requester?: string) => Promise<boolean>;
    'invalidate-stream-cache': (name: string, artist: string, id: string) => Promise<{ success: true } | { success: false; error: string }>;
    'clear-cache': () => Promise<{ success: true } | { success: false; error: string }>;
    'open-cache-folder': () => Promise<boolean>;

    
    'get-setting': (key: string) => Promise<any>;
    'set-setting': (key: string, value: any) => Promise<boolean>;
    'select-directory': () => Promise<string | null>;
    'get-default-download-location': () => Promise<string>;

    
    'minimize-window': () => void;
    'maximize-window': () => void;
    'close-window': () => void;
}

export type IPCChannelName = keyof IPCChannels;

export interface IpcRenderer {
    send: (channel: string, ...args: any[]) => void;
    on: (channel: string, func: (...args: any[]) => void) => (() => void);
    off: (channel: string, func: (...args: any[]) => void) => void;
    removeAllListeners: (channel: string) => void;
    invoke: <K extends IPCChannelName>(
        channel: K,
        ...args: Parameters<IPCChannels[K]>
    ) => ReturnType<IPCChannels[K]>;
}
