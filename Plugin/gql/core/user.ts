import { HttpClient } from "./http-client.js"
import { SpotifyError } from "./error.js";
import { getHash } from "./hash-registry.js";
import type { GqlPage, GqlPlaylistSimplified } from "../types/gql-api.js";
import type { Album, Artist, Track } from "../types/web-api.js";

class SpotifyUserEndpoint {
    gqlClient!: HttpClient;

    constructor(gqlClient: HttpClient) {
        this.gqlClient = gqlClient;
    }

    async me() {
        const hash = await getHash("User", "profileAttributes");

        const res = await this.gqlClient.post("query", {
            body: {
                operationName: "profileAttributes",
                variables: {},
                extensions: {
                    persistedQuery: {
                        version: 1,
                        sha256Hash: hash,
                    },
                },
            },
        });

        SpotifyError.mayThrow(res);
        const data = res.data.me;
        return {
            id: data.uri?.split(":").pop() || "",
            display_name: data.profile?.name || data.name || data.displayName || "",
            images: data.profile?.avatar?.sources || data.profile?.images || data.images || data.avatar?.sources || [],
            uri: data.uri || "",
        };
    }

    async attributes() {
        const hash = await getHash("User", "accountAttributes");

        const res = await this.gqlClient.post("query", {
            body: {
                operationName: "accountAttributes",
                variables: {},
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

    async savedTracks({
        offset = 0,
        limit = 20,
    }: { offset?: number; limit?: number } = {}): Promise<GqlPage<Track>> {
        const hash = await getHash("Library", "fetchLibraryTracks");

        const res = await this.gqlClient
            .post("query", {
                body: {
                    variables: {
                        offset,
                        limit,
                    },
                    operationName: "fetchLibraryTracks",
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

        const trackData = res.data.me.library.tracks.items;
        const pagingInfo = res.data.me.library.tracks.pagingInfo;

        const items = trackData
            .filter((item: any) => item.__typename === "UserLibraryTrackResponse")
            .map((item: any) => {
                const trackWrapper = item.track;
                if (!trackWrapper) return null;

                
                const track = trackWrapper.data || trackWrapper;
                const uri = trackWrapper._uri || track.uri || track._uri || "";
                const id = uri ? uri.split(":").pop() : "";

                                                                                
                const albumData = track.albumOfTrack || track.album;

                return {
                    id,
                    name: track.name || "Unknown Track",
                    uri,
                    duration_ms: track.duration?.totalMilliseconds ?? 0,
                    explicit: track.contentRating?.label === "EXPLICIT" || track.explicit === true,
                    album: {
                        id: albumData?.uri ? albumData.uri.split(":").pop() : (albumData?.id || ""),
                        name: albumData?.name || "Unknown Album",
                        images: albumData?.coverArt?.sources ?? albumData?.images ?? [],
                    } as any,
                    artists: track.artists?.items?.map((artist: any) => ({
                        id: artist.uri ? artist.uri.split(":").pop() : "",
                        name: artist.profile?.name || artist.name || "Unknown Artist",
                        uri: artist.uri || "",
                    })) ?? [],
                    added_at: item.addedAt?.isoString || item.addedAt || "",
                } as unknown as Track;
            }).filter(Boolean);

        return {
            offset: pagingInfo.offset,
            limit: pagingInfo.limit,
            total: res.data.me.library.tracks.totalCount,
            items,
        };
    }

    async savedPlaylists({
        offset = 0,
        limit = 20,
    }: { offset?: number; limit?: number } = {}): Promise<
        GqlPage<GqlPlaylistSimplified>
    > {
        const hash = await getHash("Library", "libraryV3");

        const res = await this.gqlClient
            .post("query", {
                body: {
                    variables: {
                        filters: ["Playlists"],
                        order: null,
                        textFilter: "",
                        features: [
                            "LIKED_SONGS",
                            "YOUR_EPISODES_V2",
                            "PRERELEASES",
                            "EVENTS",
                        ],
                        limit,
                        offset,
                        flatten: false,
                        expandedFolders: [],
                        folderUri: null,
                        includeFoldersWhenFlattening: true,
                    },
                    operationName: "libraryV3",
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

        const playlistData = res.data.me.libraryV3;
        const pagingInfo = playlistData.pagingInfo;

        const items = playlistData.items
            .filter(
                (item: any) =>
                    item.item.__typename === "PlaylistResponseWrapper" &&
                    item.item.data.__typename === "Playlist"
            )
            .map((item: any) => {
                const id = item.item._uri.split(":").pop();
                const playlist = item.item.data;
                const ownerV2 = playlist.ownerV2.data;

                return {
                    id,
                    description: playlist.description,
                    external_urls: {
                        spotify: `https://open.spotify.com/playlist/${id}`,
                    },
                    images:
                        playlist.images?.items.flatMap((image: any) => image.sources) ?? [],
                    name: playlist.name,
                    owner: {
                        type: "User",
                        external_urls: {
                            spotify: `https://open.spotify.com/user/${ownerV2.id}`,
                        },
                        id: ownerV2.id,
                        uri: ownerV2.uri,
                        display_name: ownerV2.name,
                        images: ownerV2.avatar?.sources ?? [],
                    },
                    uri: item.item._uri,
                    objectType: "Playlist",
                } satisfies GqlPlaylistSimplified;
            });

        return {
            limit: pagingInfo.limit,
            offset: pagingInfo.offset,
            total: playlistData.totalCount,
            items,
        };
    }

    async savedAlbums({
        offset = 0,
        limit = 20,
    }: { offset?: number; limit?: number } = {}): Promise<GqlPage<Album>> {
        const hash = await getHash("Library", "libraryV3");

        const res = await this.gqlClient
            .post("query", {
                body: {
                    variables: {
                        filters: ["Albums"],
                        order: null,
                        textFilter: "",
                        features: [
                            "LIKED_SONGS",
                            "YOUR_EPISODES_V2",
                            "PRERELEASES",
                            "EVENTS",
                        ],
                        limit,
                        offset,
                        flatten: false,
                        expandedFolders: [],
                        folderUri: null,
                        includeFoldersWhenFlattening: true,
                    },
                    operationName: "libraryV3",
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

        const albumsData = res.data.me.libraryV3;
        const pagingInfo = albumsData.pagingInfo;

        const items = albumsData.items
            .filter(
                (item: any) =>
                    item.item.__typename === "AlbumResponseWrapper" &&
                    item.item.data.__typename === "Album"
            )
            .map((item: any) => {
                const album = item.item.data;
                const id = item.item._uri.split(":").pop();
                return {
                    id,
                    name: album.name,
                    uri: item.item._uri,
                    images: album.coverArt?.sources ?? [],
                    artists: album.artists?.items?.map((artist: any) => ({
                        id: artist.uri.split(":").pop(),
                        name: artist.profile?.name,
                        uri: artist.uri,
                    })) ?? [],
                } as Album;
            });

        return {
            offset: pagingInfo.offset,
            limit: pagingInfo.limit,
            total: albumsData.totalCount,
            items,
        };
    }

    async savedArtists({
        offset = 0,
        limit = 20,
    }: { offset?: number; limit?: number } = {}): Promise<GqlPage<Artist>> {
        const hash = await getHash("Library", "libraryV3");

        const res = await this.gqlClient
            .post("query", {
                body: {
                    variables: {
                        filters: ["Artists"],
                        order: null,
                        textFilter: "",
                        features: [
                            "LIKED_SONGS",
                            "YOUR_EPISODES_V2",
                            "PRERELEASES",
                            "EVENTS",
                        ],
                        limit,
                        offset,
                        flatten: false,
                        expandedFolders: [],
                        folderUri: null,
                        includeFoldersWhenFlattening: true,
                    },
                    operationName: "libraryV3",
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

        const artistData = res.data.me.libraryV3;
        const pagingInfo = artistData.pagingInfo;

        const items = artistData.items
            .filter(
                (item: any) =>
                    item.item.__typename === "ArtistResponseWrapper" &&
                    item.item.data.__typename === "Artist"
            )
            .map((item: any) => {
                const artist = item.item.data;
                const id = item.item._uri.split(":").pop();
                return {
                    id,
                    name: artist.profile?.name,
                    uri: item.item._uri,
                    images: artist.visuals?.avatarImage?.sources ?? [],
                } as Artist;
            });

        return {
            offset: pagingInfo.offset,
            limit: pagingInfo.limit,
            total: artistData.totalCount,
            items,
        };
    }

    async isTracksSaved(ids: string[]): Promise<boolean[]> {
        const hash = await getHash("Library", "isCurated");

        const res = await this.gqlClient
            .post("query", {
                body: {
                    variables: {
                        uris: ids.map((id) => `spotify:track:${id}`),
                    },
                    operationName: "isCurated",
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

        const lookup = res.data.lookup;

        return lookup
            .filter((item: any) => item.data?.__typename === "Track")
            .map((item: any) => item.data?.isCurated ?? false);
    }

    async isInLibrary(
        ids: string[],
        { itemType }: { itemType: "artist" | "album" }
    ): Promise<boolean[]> {
        if (itemType !== "artist" && itemType !== "album") {
            throw new Error("itemType must be 'artist' or 'album'");
        }

        const hash = await getHash("Library", "areEntitiesInLibrary");

        const res = await this.gqlClient
            .post("query", {
                body: {
                    variables: {
                        uris: ids.map((id) => `spotify:${itemType}:${id}`),
                    },
                    operationName: "areEntitiesInLibrary",
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

        const lookup = res.data.lookup;

        return lookup
            .filter((item: any) => item.data?.__typename.toLowerCase() === itemType)
            .map((item: any) => item.data?.saved ?? false);
    }
}

export { SpotifyUserEndpoint };
