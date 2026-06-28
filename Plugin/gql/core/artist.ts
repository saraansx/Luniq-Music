import { HttpClient } from "./http-client.js"
import { SpotifyError } from "./error.js";
import { getHash } from "./hash-registry.js";

class SpotifyArtistEndpoint {
    gqlClient!: HttpClient;

    constructor(gqlClient: HttpClient) {
        this.gqlClient = gqlClient;
    }

    async follow(artistIds: string[]) {
        const hash = await getHash("Library", "addToLibrary");

        const res = await this.gqlClient
            .post("query", {
                body: {
                    variables: {
                        uris: artistIds.map((id) => `spotify:artist:${id}`),
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

    async unfollow(artistIds: string[]) {
        const hash = await getHash("Library", "addToLibrary");

        const res = await this.gqlClient.post("query", {
                body: {
                    variables: {
                        uris: artistIds.map((id) => `spotify:artist:${id}`),
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

    async getArtist(artistId: string) {
        const hash = await getHash("Artist", "queryArtistOverview");

        const res = await this.gqlClient.post("query", {
            body: {
                variables: {
                    uri: `spotify:artist:${artistId}`,
                    locale: "en",
                    includePrerelease: false,
                },
                operationName: "queryArtistOverview",
                extensions: {
                    persistedQuery: {
                        version: 1,
                        sha256Hash: hash,
                    },
                },
            },
        });

        SpotifyError.mayThrow(res);
        return res.data.artistUnion || res.data.artistV2 || res.data.artist;
    }
}

export { SpotifyArtistEndpoint };
