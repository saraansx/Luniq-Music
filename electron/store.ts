export interface StoreSchema {
    // Authentication
    spotify_access_token?: string;
    spotify_cookies?: any[]; // Storing cookies array which contains sp_dc
    spotify_expires_at?: number; // timestamp when token expires

    // App Settings
    language?: string;
    region?: string;
    windowBounds?: {
        width: number;
        height: number;
        x?: number;
        y?: number;
    };
    audioQuality?: string;
    downloadQuality?: string;
    audioFormat?: string;
    downloadFormat?: string;
    downloadLocation?: string;
    normalizeVolume?: boolean;
    lowDataMode?: boolean;
    autoplayEnabled?: boolean;
    monoAudio?: boolean;
    audioDeviceId?: string;
    playbackSpeed?: number;
    volume?: number;
    isMuted?: boolean;
    eqEnabled?: boolean;
    eqBands?: number[];
    closeBehavior?: string;
    discordRPC?: boolean;
    autoUpdateYtdlp?: boolean;
    lastYtdlpUpdate?: number;
    autoUpdateApp?: boolean;
    app_version?: string;
    has_starred?: boolean;
    startup_count?: number;
}

export const schema = {
    spotify_access_token: { type: 'string' },
    spotify_cookies: { type: 'array' },
    spotify_expires_at: { type: 'number' },
    language: { type: 'string', default: 'en' },
    region: { type: 'string', default: 'US' },
    windowBounds: {
        type: 'object',
        properties: {
            width: { type: 'number' },
            height: { type: 'number' },
            x: { type: 'number' },
            y: { type: 'number' }
        }
    },
    audioQuality: { type: 'string', default: '256' },
    downloadQuality: { type: 'string', default: '320' },
    audioFormat: { type: 'string', default: 'webm' },
    downloadFormat: { type: 'string', default: 'webm' },
    downloadLocation: { type: 'string' },
    normalizeVolume: { type: 'boolean', default: false },
    lowDataMode: { type: 'boolean', default: false },
    autoplayEnabled: { type: 'boolean', default: true },
    monoAudio: { type: 'boolean', default: false },
    audioDeviceId: { type: 'string', default: 'default' },
    playbackSpeed: { type: 'number', default: 1.0 },
    volume: { type: 'number', default: 0.8 },
    isMuted: { type: 'boolean', default: false },
    eqEnabled: { type: 'boolean', default: false },
    eqBands: { 
        type: 'array', 
        items: { type: 'number' },
        default: [0, 0, 0, 0, 0]
    },
    closeBehavior: { type: 'string', default: 'minimize' },
    discordRPC: { type: 'boolean', default: true },
    autoUpdateYtdlp: { type: 'boolean', default: true },
    lastYtdlpUpdate: { type: 'number', default: 0 },
    autoUpdateApp: { type: 'boolean', default: true },
    app_version: { type: 'string' },
    has_starred: { type: 'boolean', default: false },
    startup_count: { type: 'number', default: 0 },
} as const;
