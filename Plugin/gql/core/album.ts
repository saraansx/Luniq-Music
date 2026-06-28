import { HttpClient } from "./http-client.js"
import { SpotifyError } from "./error.js";
import { getHash } from "./hash-registry.js";
import type { GqlAlbum, GqlPage } from "../types/gql-api.js";

class SpotifyAlbumEndpoint {
    gqlClient!: HttpClient;

    constructor(gqlClient: HttpClient) {
        this.gqlClient = gqlClient;
    }

    async releases({
        offset = 0,
        limit = 20,
    }: { offset?: number; limit?: number } = {}): Promise<
        GqlPage<GqlAlbum>
    > {
        const hash = await getHash("Album", "queryWhatsNewFeed");

        const res = await this.gqlClient
            .post("query", {
                body: {
                    variables: {
                        offset,
                        limit,
                        onlyUnPlayedItems: false,
                        includedContentTypes: ["ALBUM"],
                    },
                    operationName: "queryWhatsNewFeed",
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

        const releasesData = res.data.whatsNewFeedItems;
        const pagingInfo = releasesData.pagingInfo;
        const items = releasesData.items
            .filter(
                (item: any) =>
                    item.content?.__typename === "AlbumResponseWrapper" &&
                    item.content?.data?.__typename === "Album"
            )
            .map((item: any) => {
                const album = item.content.data;
                const id = album.uri.split(":").pop();

                return {
                    id,
                    name: album.name,
                    album_type: album.albumType?.toLowerCase(),
                    release_date: album.date?.isoString,
                    release_date_precision: album.date?.precision ?? "day",
                    images: album.coverArt?.sources,
                    external_urls: {
                        spotify: `https://open.spotify.com/album/${id}`,
                    },
                    artists:
                        album.artists?.items?.map((artist: any) => {
                            const artistId = artist.uri.split(":").pop();
                            return {
                                id: artistId,
                                uri: artist.uri,
                                name: artist.profile.name,
                                external_urls: {
                                    spotify: `https://open.spotify.com/artist/${artistId}`,
                                },
                            };
                        }) ?? [],
                };
            });

        return {
            offset: pagingInfo.offset,
            limit: pagingInfo.limit,
            total: releasesData.totalCount,
            items,
        };
    }

    async save(albumIds: string[]) {
        const hash = await getHash("Library", "addToLibrary");

        const res = await this.gqlClient
            .post("query", {
                body: {
                    variables: {
                        uris: albumIds.map((id) => `spotify:album:${id}`),
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

    async getAlbum(albumId: string) {
        const hash = await getHash("Album", "getAlbum");

        try {
            const res = await this.gqlClient.post("query", {
                body: {
                    variables: {
                        uri: `spotify:album:${albumId}`,
                        locale: "en",
                        offset: 0,
                        limit: 300,
                    },
                    operationName: "getAlbum",
                    extensions: {
                        persistedQuery: {
                            version: 1,
                            sha256Hash: hash,
                        },
                    },
                },
            });

            SpotifyError.mayThrow(res);

            const albumData = res.data?.albumUnion || res.data?.albumV2 || res.data?.album;
            if (albumData) return albumData;

            console.log("[album.getAlbum] Raw response keys:", Object.keys(res.data || {}));
        } catch (err) {
            console.log("[album.getAlbum] Fetch failed with primary hash:", err);

            
            try {
                const fallbackHash = await getHash("Album", "getAlbum");

                const res = await this.gqlClient.post("query", {
                    body: {
                        variables: {
                            uri: `spotify:album:${albumId}`,
                            offset: 0,
                            limit: 300,
                        },
                        operationName: "queryAlbumTracks",
                        extensions: {
                            persistedQuery: {
                                version: 1,
                                sha256Hash: fallbackHash,
                            },
                        },
                    },
                });

                SpotifyError.mayThrow(res);
                const albumData = res.data?.albumUnion || res.data?.albumV2 || res.data?.album;
                if (albumData) return albumData;
            } catch (fallbackErr) {
                console.log("[album.getAlbum] Fallback also failed:", fallbackErr);
            }
        }

        throw new Error("Could not fetch album data with discovered hashes");
    }

    async unsave(albumIds: string[]) {
        const hash = await getHash("Library", "addToLibrary");

        const res = await this.gqlClient.post("query", {
                body: {
                    variables: {
                        uris: albumIds.map((id) => `spotify:album:${id}`),
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
}

export { SpotifyAlbumEndpoint };
