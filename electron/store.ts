export interface StoreSchema {
    
    spotify_access_token?: string;
    spotify_cookies?: any[]; 
    spotify_expires_at?: number; 

    
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
    audioEngine?: string;
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
    lavalinkHost?: string;
    lavalinkPort?: number;
    lavalinkPassword?: string;
    lavalinkSecure?: boolean;
    floatingLyricsEnabled?: boolean;
    floatingLyricsBounds?: {
        x?: number;
        y?: number;
        width?: number;
        height?: number;
    };
    gaplessEnabled?: boolean;
    crossfadeDuration?: number;
    spatialAudioEnabled?: boolean;
    spatialAudioMode?: 'off' | 'audiophile' | 'studio';
    spatialBassBoost?: number;
    spatialVocalClarity?: number;
    spatialTubeWarmth?: boolean;
    spatialWidth?: number;
    spatialRoomSize?: 'small' | 'medium';
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
    audioQuality: { type: 'string', default: '320' },
    downloadQuality: { type: 'string', default: '320' },
    audioEngine: { type: 'string', default: 'youtubei' },
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
    spatialAudioEnabled: { type: 'boolean', default: false },
    spatialAudioMode: { type: 'string', default: 'audiophile' },
    spatialBassBoost: { type: 'number', default: 4 },
    spatialVocalClarity: { type: 'number', default: 3 },
    spatialTubeWarmth: { type: 'boolean', default: true },
    spatialWidth: { type: 'number', default: 1.4 },
    spatialRoomSize: { type: 'string', default: 'medium' },
    closeBehavior: { type: 'string', default: 'minimize' },
    discordRPC: { type: 'boolean', default: true },
    autoUpdateYtdlp: { type: 'boolean', default: true },
    lastYtdlpUpdate: { type: 'number', default: 0 },
    autoUpdateApp: { type: 'boolean', default: true },
    app_version: { type: 'string' },
    has_starred: { type: 'boolean', default: false },
    startup_count: { type: 'number', default: 0 },
    lavalinkHost: { type: 'string', default: 'us1.visihost.in' },
    lavalinkPort: { type: 'number', default: 3059 },
    lavalinkPassword: { type: 'string', default: 'aeronova' },
    lavalinkSecure: { type: 'boolean', default: false },
    floatingLyricsEnabled: { type: 'boolean', default: true },
    floatingLyricsBounds: {
        type: 'object',
        properties: {
            width: { type: 'number' },
            height: { type: 'number' },
            x: { type: 'number' },
            y: { type: 'number' }
        }
    },
};
