import { HttpClient } from "./http-client.js"
import { SpotifyError } from "./error.js";
import { getHash } from "./hash-registry.js";

class SpotifyTrackEndpoint {
    gqlClient!: HttpClient;

    constructor(gqlClient: HttpClient) {
        this.gqlClient = gqlClient;
    }

    async save(trackIds: string[]) {
        const hash = await getHash("Library", "addToLibrary");

        const res = await this.gqlClient
            .post("query", {
                body: {
                    variables: {
                        libraryItemUris: trackIds.map((id) => `spotify:track:${id}`),
                    },
                    operationName: "addToLibrary",
                    extensions: {
                        persistedQuery: {
                            version: 1,
                            sha256Hash: hash,
                        },
                    },
                },
            })
            ;

        SpotifyError.mayThrow(res);
        return res;
    }

    async unsave(trackIds: string[]) {
        const hash = await getHash("Library", "addToLibrary");

        const res = await this.gqlClient.post("query", {
                body: {
                    variables: {
                        libraryItemUris: trackIds.map((id) => `spotify:track:${id}`),
                    },
                    operationName: "removeFromLibrary",
                    extensions: {
                        persistedQuery: {
                            version: 1,
                            sha256Hash: hash,
                        },
                    },
                },
            })
            ;

        SpotifyError.mayThrow(res);
        return res;
    }

    async getTrack(trackId: string) {
        const hash = await getHash("Track", "getTrack");

        const res = await this.gqlClient.post("query", {
            body: {
                variables: {
                    uri: `spotify:track:${trackId}`,
                },
                operationName: "getTrack",
                extensions: {
                    persistedQuery: {
                        version: 1,
                        sha256Hash: hash,
                    },
                },
            },
        });

        SpotifyError.mayThrow(res);
        return res.data.trackUnion || res.data.track || res.data.trackV2;
    }

    async getCanvas(trackId: string) {
        const hash = await getHash("Track", "canvas");

        const res = await this.gqlClient.post("query", {
            body: {
                variables: {
                    trackUri: `spotify:track:${trackId}`,
                },
                operationName: "canvas",
                extensions: {
                    persistedQuery: {
                        version: 1,
                        sha256Hash: hash,
                    },
                },
            },
        });

        SpotifyError.mayThrow(res);
        return res.data;
    }

    async getTrackPreviews(uris: string[]) {
        const hash = await getHash("Track", "trackPreview");

        const res = await this.gqlClient.post("query", {
            body: {
                variables: {
                    uris,
                },
                operationName: "trackPreview",
                extensions: {
                    persistedQuery: {
                        version: 1,
                        sha256Hash: hash,
                    },
                },
            },
        });

        SpotifyError.mayThrow(res);
        return res.data;
    }
}

export { SpotifyTrackEndpoint };
