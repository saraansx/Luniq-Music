export class SpotifyRadioEndpoint {
    private accessToken: string;
    private onUnauthorized?: () => void;

    constructor(accessToken: string, onUnauthorized?: () => void) {
        this.accessToken = accessToken;
        this.onUnauthorized = onUnauthorized;
    }

        async getStationTracks(
        trackId: string,
        _artistId?: string,
        count: number = 15
    ): Promise<RadioTrack[]> {
        try {
            const res = await fetch(`https://api.spotify.com/v1/recommendations?seed_tracks=${trackId}&limit=${count}`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${this.accessToken}`,
                    Accept: 'application/json',
                },
            });

            if (res.ok) {
                const data = await res.json();
                console.log('[Radio] REST fallback raw response:', JSON.stringify(data).slice(0, 500));
                const items = data?.tracks ?? [];
                const parsed: RadioTrack[] = items
                    .map((item: any): RadioTrack => {
                        const id = item.id ?? (item.uri ?? '').split(':').pop() ?? '';
                        const artists = (item.artists ?? []).map((a: any) => ({
                            id: (a.uri ?? '').split(':').pop() ?? a.id ?? '',
                            name: a.name ?? 'Unknown',
                        }));
                        return {
                            id,
                            name: item.name,
                            artist: artists.map((a: any) => a.name).join(', '),
                            artists,
                            albumName: item.album?.name ?? '',
                            albumArt: item.album?.images?.[0]?.url ?? '',
                            durationMs: item.duration_ms ?? 0,
                        };
                    })
                    .filter((t: RadioTrack) => t.id && t.name);

                if (parsed.length > 0) {
                    console.log(`[Radio] Got ${parsed.length} tracks from REST fallback`);
                    return parsed;
                }
            } else if (res.status === 401 && this.onUnauthorized) {
                this.onUnauthorized();
            }
        } catch (e) {
            console.warn('[Radio] REST fallback error:', e);
        }

        console.error('[Radio] Both sources failed — returning empty array');
        return [];
    }
}

export interface RadioTrack {
    id: string;
    name: string;
    artist: string;
    artists: { id: string; name: string }[];
    albumName: string;
    albumArt: string;
    durationMs: number;
}
