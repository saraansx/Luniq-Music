import { ALBUM_PLACEHOLDER } from '../constants/assets';

export interface LuneTrack {
    id: string;
    queueId?: string; 
    name: string;
    artist: string; 
    artists: { 
        name: string; 
        id: string | null;
    }[];
    albumName?: string;
    albumArt: string;
    durationMs: number;
    addedAt?: string | number;
    downloadedAt?: string | number;
}

export const resolveSpotifyImageUrl = (url: string): string => {
    if (!url) return '';
    if (url.startsWith('spotify:image:')) {
        return `https://i.scdn.co/image/${url.replace('spotify:image:', '')}`;
    }
    return url;
};

   
                                                                             
                                                
   
export const normalizeTrack = (track: any, lowDataMode: boolean = false): LuneTrack => {
    if (!track) {
        return {
            id: '',
            name: 'Unknown Track',
            artist: 'Unknown Artist',
            artists: [{ name: 'Unknown Artist', id: null }],
            albumArt: ALBUM_PLACEHOLDER,
            durationMs: 0
        };
    }

    
    const id = track.id || track.trackId || (track.uri?.startsWith('spotify:track:') ? track.uri.split(':').pop() : track.uri) || '';

                     
    const name = track.name || track.trackName || 'Unknown Track';

    
    let artists: { name: string; id: string | null }[] = [];
    
    
    const rawArtists = track.artists?.items || track.artists || track.firstArtist?.items || track.artist;

    if (Array.isArray(rawArtists)) {
        artists = rawArtists.map((a: any) => {
            if (typeof a === 'string') return { name: a, id: null };
            return {
                name: a.profile?.name || a.name || 'Unknown Artist',
                id: a.id || (a.uri?.startsWith('spotify:artist:') ? a.uri.split(':').pop() : a.uri) || null
            };
        });
    } else if (rawArtists && typeof rawArtists === 'object') {
        const a = rawArtists;
        artists = [{
            name: a.profile?.name || a.name || 'Unknown Artist',
            id: a.id || (a.uri?.startsWith('spotify:artist:') ? a.uri.split(':').pop() : a.uri) || null
        }];
    } else if (typeof rawArtists === 'string') {
        artists = rawArtists.split(', ').map(n => ({ name: n, id: null }));
    }

    if (artists.length === 0) {
        artists = [{ name: 'Unknown Artist', id: null }];
    }

    const artist = artists.map(a => a.name).join(', ');

    
    
    const images = (track.images || track.album?.images || track.albumOfTrack?.coverArt?.sources || track.album?.coverArt?.sources || []);
    
    let rawArt = track.albumArt || ALBUM_PLACEHOLDER;
    if (images.length > 0) {
        if (lowDataMode) {
            
            rawArt = images[images.length - 1].url || images[images.length - 1].uri || rawArt;
        } else {
            
            rawArt = images[0].url || images[0].uri || rawArt;
        }
    }

    const albumArt = resolveSpotifyImageUrl(rawArt);

    
    const albumName = track.albumName 
        || track.album?.name 
        || track.albumOfTrack?.name 
        || '';

                         
    const durationMs = track.durationMs 
        || track.duration_ms 
        || track.duration?.totalMilliseconds 
        || track.trackDuration?.totalMilliseconds 
        || 0;

                                       
    const addedAt = track.addedAt?.isoString || track.added_at || track.addedAt || '';
    const downloadedAt = track.downloadedAt || '';

    return {
        id,
        name,
        artist,
        artists,
        albumName,
        albumArt,
        durationMs,
        addedAt,
        downloadedAt
    };
};
