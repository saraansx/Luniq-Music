import { HttpClient } from "./http-client.js"
import { SpotifyError } from "./error.js";
import { getHash } from "./hash-registry.js";

class SpotifyPlaylistEndpoint {
    gqlClient!: HttpClient;

    constructor(gqlClient: HttpClient) {
        this.gqlClient = gqlClient;
    }

    async getPlaylist(playlistId: string): Promise<any> {
        const hash = await getHash("Playlist", "fetchPlaylist");

        const res = await this.gqlClient.post("query", {
            body: {
                variables: {
                    uri: `spotify:playlist:${playlistId}`,
                    offset: 0,
                    limit: 343,
                    enableWatchFeedEntrypoint: false,
                },
                operationName: "fetchPlaylist",
                extensions: {
                    persistedQuery: {
                        version: 1,
                        sha256Hash: hash,
                    },
                },
            },
        });

        SpotifyError.mayThrow(res);
        return res.data.playlistV2;
    }

    async tracks(
        playlistId: string,
        { offset = 0, limit = 50 }: { offset?: number; limit?: number } = {}
    ): Promise<any> {
        const hash = await getHash("Playlist", "fetchPlaylist");

        const res = await this.gqlClient.post("query", {
            body: {
                variables: {
                    uri: `spotify:playlist:${playlistId}`,
                    offset,
                    limit,
                    enableWatchFeedEntrypoint: false,
                },
                operationName: "fetchPlaylist",
                extensions: {
                    persistedQuery: {
                        version: 1,
                        sha256Hash: hash,
                    },
                },
            },
        });

        SpotifyError.mayThrow(res);
        return res.data.playlistV2.content;
    }

    async create(options: { name: string; description?: string; public?: boolean; collaborative?: boolean }) {
        try {
            const hash = await getHash("Playlist", "createPlaylist");

            const res = await this.gqlClient.post("query", {
                body: {
                    variables: {
                        name: options.name,
                        description: options.description || "",
                        public: options.public || false,
                        collaborative: options.collaborative || false,
                    },
                    operationName: "createPlaylist",
                    extensions: {
                        persistedQuery: {
                            version: 1,
                            sha256Hash: hash,
                        },
                    },
                },
            });

            SpotifyError.mayThrow(res);
            return res.data.createPlaylist;
        } catch (err) {
            console.warn("[SpotifyPlaylistEndpoint] create GQL failed, falling back to REST API:", err);
            const restRes = await this.gqlClient.post("https://api.spotify.com/v1/me/playlists", {
                body: {
                    name: options.name,
                    description: options.description || "",
                    public: options.public ?? false,
                    collaborative: options.collaborative ?? false
                }
            });
            return restRes;
        }
    }

    async addTracks(playlistId: string, { uris, position }: { uris: string[]; position?: number }) {
        try {
            const hash = await getHash("Playlist", "addToPlaylist");

            const res = await this.gqlClient.post("query", {
                body: {
                    variables: {
                        playlistUri: `spotify:playlist:${playlistId}`,
                        uris,
                        position: position ?? null,
                    },
                    operationName: "addItemsToPlaylist",
                    extensions: {
                        persistedQuery: {
                            version: 1,
                            sha256Hash: hash,
                        },
                    },
                },
            });

            SpotifyError.mayThrow(res);
            return res;
        } catch (err) {
            console.warn("[SpotifyPlaylistEndpoint] addTracks GQL failed, falling back to REST API:", err);
            const restRes = await this.gqlClient.post(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
                body: {
                    uris,
                    position: position ?? undefined
                }
            });
            return restRes;
        }
    }

    async removeTracks(playlistId: string, { uris }: { uris: string[] }) {
        try {
            const hash = await getHash("Playlist", "removeFromPlaylist");

            const res = await this.gqlClient.post("query", {
                body: {
                    variables: {
                        playlistUri: `spotify:playlist:${playlistId}`,
                        uris,
                    },
                    operationName: "removeItemsFromPlaylist",
                    extensions: {
                        persistedQuery: {
                            version: 1,
                            sha256Hash: hash,
                        },
                    },
                },
            });

            SpotifyError.mayThrow(res);
            return res;
        } catch (err) {
            console.warn("[SpotifyPlaylistEndpoint] removeTracks GQL failed, falling back to REST API:", err);
            const restRes = await this.gqlClient.delete(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
                body: {
                    tracks: uris.map(uri => ({ uri }))
                }
            });
            return restRes;
        }
    }

    async follow(playlistIds: string[]) {
        const hash = await getHash("Library", "addToLibrary");

        const res = await this.gqlClient.post("query", {
            body: {
                variables: {
                    uris: playlistIds.map(id => `spotify:playlist:${id}`),
                },
                operationName: "addToLibrary",
                extensions: {
                    persistedQuery: {
                        version: 1,
                        sha256Hash: hash,
                    },
                },
            },
        });

        SpotifyError.mayThrow(res);
        return res;
    }

    async unfollow(playlistIds: string[]) {
        const hash = await getHash("Library", "addToLibrary");

        const res = await this.gqlClient.post("query", {
            body: {
                variables: {
                    uris: playlistIds.map(id => `spotify:playlist:${id}`),
                },
                operationName: "removeFromLibrary",
                extensions: {
                    persistedQuery: {
                        version: 1,
                        sha256Hash: hash,
                    },
                },
            },
        });

        SpotifyError.mayThrow(res);
        return res;
    }
}

export { SpotifyPlaylistEndpoint };
