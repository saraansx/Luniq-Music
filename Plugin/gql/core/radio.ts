/**
 * SpotifyRadioEndpoint
 * Calls Spotify's internal radio-apollo (spclient) API — the same one the
 * official web player uses for "Song Radio". Falls back to the partner
 * GraphQL fetchSeedSuggestions query if spclient is unavailable.
 */
import { getHash } from "./hash-registry.js";

export class SpotifyRadioEndpoint {
    private accessToken: string;
    private onUnauthorized?: () => void;

    constructor(accessToken: string, onUnauthorized?: () => void) {
        this.accessToken = accessToken;
        this.onUnauthorized = onUnauthorized;
    }

    /** Convert spotify:image: URI or upgrade i.scdn.co URL to 640x640 HTTPS. */
    private upgradeImageUrl(url: string): string {
        if (!url) return '';
        // Convert Spotify internal image URI → HTTPS CDN URL
        if (url.startsWith('spotify:image:')) {
            const hash = url.replace('spotify:image:', '');
            return `https://i.scdn.co/image/${hash}`;
        }
        // Upgrade existing HTTPS scdn.co URLs to larger size
        if (url.includes('i.scdn.co')) {
            return url.replace(/ab67616d[0-9a-f]{16}/i, 'ab67616d0000b273');
        }
        return url;
    }

    /**
     * Fetch a radio station seeded by a track.
     * Returns up to `count` RadioTrack objects.
     */
    async getStationTracks(
        trackId: string,
        _artistId?: string,
        count: number = 15
    ): Promise<RadioTrack[]> {
        const seedUri = `spotify:track:${trackId}`;

        // ── Primary: radio-apollo spclient ────────────────────────────────────
        try {
            const url = `https://spclient.wg.spotify.com/radio-apollo/v3/stations/${encodeURIComponent(seedUri)}?autoplay=true&count=${count}`;
            const res = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${this.accessToken}`,
                    Accept: 'application/json',
                    'App-Platform': 'WebPlayer',
                    'Spotify-App-Version': '1.0.0',
                },
            });

            if (res.ok) {
                const data = await res.json();
                console.log('[Radio] radio-apollo raw response:', JSON.stringify(data).slice(0, 500));

                // The spclient response has tracks as an array.
                // Each track item has a `uri` and a `metadata` bag.
                const rawTracks: any[] = data?.tracks ?? data?.nextPageTracks ?? [];

                const parsed = rawTracks
                    .map((t: any): RadioTrack | null => {
                        // Try both shapes: metadata-style and direct track style
                        const uri: string = t?.uri ?? t?.track?.uri ?? '';
                        const meta = t?.metadata ?? t?.track ?? t ?? {};
                        const id = uri.split(':').pop() ?? '';
                        if (!id || !meta) return null;

                        const name: string =
                            meta.title ?? meta.name ?? '';
                        if (!name) return null;

                        const artistName: string =
                            meta.artist_name ??
                            meta.album_artist_name ??
                            (Array.isArray(meta.artists)
                                ? meta.artists.map((a: any) => a.name ?? a.artist_name).join(', ')
                                : '');

                        const artistId: string =
                            (meta.artist_uri ?? '').split(':').pop() ?? '';

                        const albumArt: string = this.upgradeImageUrl(
                            meta.imageUri ??
                            meta.image_url ??
                            meta.imageUrl ??
                            meta.album?.images?.[0]?.url ??
                            meta.images?.[0]?.url ??
                            ''
                        );

                        const albumName: string =
                            meta.album_title ?? meta.album?.name ?? '';

                        const durationMs: number =
                            parseInt(meta.duration ?? '0', 10) ||
                            (meta.duration_ms ?? meta.durationMs ?? 0);

                        return {
                            id,
                            name,
                            artist: artistName,
                            artists: artistName
                                ? [{ id: artistId, name: artistName }]
                                : [],
                            albumName,
                            albumArt,
                            durationMs,
                        };
                    })
                    .filter((t): t is RadioTrack => t !== null && t.name.length > 0);

                if (parsed.length > 0) {
                    console.log(`[Radio] ✅ Got ${parsed.length} radio tracks from spclient`);
                    return parsed;
                }
                console.warn('[Radio] spclient returned 0 parseable tracks, trying GQL fallback...');
            } else {
                if (res.status === 401 && this.onUnauthorized) {
                    this.onUnauthorized();
                }
                console.warn(`[Radio] spclient returned ${res.status}, trying GQL fallback...`);
            }
        } catch (e) {
            console.warn('[Radio] spclient error:', e);
        }

        // ── Fallback: partner API GraphQL fetchSeedSuggestions ────────────────
        try {
            const hash = await getHash("Radio", "fetchSeedSuggestions");

            const body = {
                variables: { uri: seedUri },
                operationName: 'fetchSeedSuggestions',
                extensions: {
                    persistedQuery: {
                        version: 1,
                        sha256Hash: hash,
                    },
                },
            };

            const res = await fetch('https://api-partner.spotify.com/pathfinder/v2/query', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify(body),
            });

            if (res.ok) {
                const data = await res.json();
                console.log('[Radio] GQL fallback raw response:', JSON.stringify(data).slice(0, 500));
                const items = data?.data?.seedSuggestions?.items ?? [];
                const parsed: RadioTrack[] = items
                    .filter((item: any) => item?.uri && item?.name)
                    .slice(0, count)
                    .map((item: any): RadioTrack => {
                        const id = item.uri.split(':').pop() ?? item.uri;
                        const artists = (item.artists?.items ?? []).map((a: any) => ({
                            id: (a.uri ?? '').split(':').pop() ?? '',
                            name: a.profile?.name ?? a.name ?? 'Unknown',
                        }));
                        return {
                            id,
                            name: item.name,
                            artist: artists.map((a: any) => a.name).join(', '),
                            artists,
                            albumName: item.albumOfTrack?.name ?? '',
                            albumArt: item.albumOfTrack?.coverArt?.sources?.[0]?.url ?? '',
                            durationMs: item.duration?.totalMilliseconds ?? 0,
                        };
                    });

                if (parsed.length > 0) {
                    console.log(`[Radio] ✅ Got ${parsed.length} tracks from GQL fallback`);
                    return parsed;
                }
            } else if (res.status === 401 && this.onUnauthorized) {
                this.onUnauthorized();
            }
        } catch (e) {
            console.warn('[Radio] GQL fallback error:', e);
        }

        console.error('[Radio] ❌ Both sources failed — returning empty array');
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
