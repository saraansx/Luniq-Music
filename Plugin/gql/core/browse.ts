import { HttpClient } from "./http-client.js"
import { SpotifyError } from "./error.js";
import { getHash } from "./hash-registry.js";
import type {
    BrowseSectionItem,
    GqlAlbumSimplified,
    GqlArtist,
    GqlArtistSimplified,
    GqlPage,
    GqlPlaylistSimplified,
    GqlUser,
} from "../types/gql-api.js";

class SpotifyBrowseEndpoint {
    gqlClient!: HttpClient;

    constructor(gqlClient: HttpClient) {
        this.gqlClient = gqlClient;
    }

    parseSectionItems(section: Record<string, any>): BrowseSectionItem {
        const id = section.uri.split(":").pop();
        const title = section.data?.title?.transformedLabel ?? section.data?.title?.text ?? 'Unknown Section';

        return {
            id,
            uri: section.uri,
            title: title,
            external_urls: {
                spotify: `https://open.spotify.com/section/${id}`,
            },
            items: section.sectionItems.items
                .map((item: any) => {
                    const wrapperTypeName = item.content.__typename;
                    const contentTypeName = item.content.data?.__typename;

                    if (
                        wrapperTypeName === "PlaylistResponseWrapper" &&
                        contentTypeName === "Playlist"
                    ) {
                        const id = item.uri.split(":").pop();
                        const playlist = item.content.data;
                        const ownerV2 = playlist.ownerV2.data;
                        const ownerId = ownerV2.uri.split(":")?.pop();

                        return {
                            objectType: "Playlist",
                            id,
                            description: playlist.description,
                            external_urls: {
                                spotify: `https://open.spotify.com/playlist/${id}`,
                            },
                            images:
                                playlist.images?.items.flatMap((image: any) => image.sources) ??
                                [],
                            name: playlist.name,
                            owner: {
                                type: "User",
                                external_urls: {
                                    spotify: `https://open.spotify.com/user/${ownerId}`,
                                },
                                id: ownerId,
                                uri: ownerV2.uri,
                                display_name: ownerV2.name,
                                images: ownerV2.avatar?.sources ?? [],
                            } satisfies GqlUser,
                            uri: item.uri,
                        } satisfies GqlPlaylistSimplified;
                    } else if (
                        wrapperTypeName === "AlbumResponseWrapper" &&
                        contentTypeName === "Album"
                    ) {
                        const id = item.uri.split(":").pop();
                        const album = item.content.data;

                        return {
                            objectType: "Album",
                            id,
                            name: album.name,
                            album_type: album.albumType?.toLowerCase(),
                            external_urls: {
                                spotify: `https://open.spotify.com/album/${id}`,
                            },
                            uri: item.uri,
                            images: album.coverArt?.sources ?? [],
                            artists: (album.artists?.items?.map((artist: any) => {
                                const id = artist.uri.split(":").pop();
                                return {
                                    id,
                                    uri: artist.uri,
                                    name: artist.profile.name,
                                    external_urls: {
                                        spotify: `https://open.spotify.com/artist/${id}`,
                                    },
                                    objectType: "Artist",
                                } satisfies GqlArtistSimplified;
                            }) ?? []) as GqlArtistSimplified[],
                        } satisfies GqlAlbumSimplified;
                    } else if (
                        wrapperTypeName === "ArtistResponseWrapper" &&
                        contentTypeName === "Artist"
                    ) {
                        const id = item.uri.split(":").pop();
                        const artist = item.content.data;
                        const name = artist.profile?.name || artist.name;
                        const images = artist.visuals?.avatarImage?.sources
                            ?? artist.images?.items?.flatMap((i: any) => i.sources)
                            ?? artist.images?.sources
                            ?? [];

                        if (!name || images.length === 0) return null;

                        return {
                            objectType: "Artist",
                            id,
                            name,
                            uri: item.uri,
                            external_urls: {
                                spotify: `https://open.spotify.com/artist/${id}`,
                            },
                            images,
                        } satisfies GqlArtist as any;
                    } else if (
                        wrapperTypeName === "TrackResponseWrapper" &&
                        contentTypeName === "Track"
                    ) {
                        const id = item.uri.split(":").pop();
                        const track = item.content.data;
                        const name = track.name;
                        const images = track.albumOfTrack?.coverArt?.sources ?? [];

                        if (!name || images.length === 0) return null;

                        const artists = (track.artists?.items?.map((artist: any) => ({
                            id: artist.uri.split(":").pop(),
                            name: artist.profile?.name || artist.name || "Unknown Artist",
                            uri: artist.uri,
                            objectType: "Artist"
                        })) ?? []);

                        return {
                            objectType: "Track",
                            id,
                            name,
                            uri: item.uri,
                            images,
                            artists,
                        } as any;
                    } else if (item.content?.data || item.content?.itemV2?.data || item.content) {
                        
                        const content = item.content || {};
                        const data = content.data || content.itemV2?.data || {};
                        const id = (item.uri || "").split(":").pop();

                                                                        
                        const images = data.images?.items?.flatMap((i: any) => i.sources)
                            ?? data.images?.sources
                            ?? data.coverArt?.sources
                            ?? data.visuals?.avatarImage?.sources
                            ?? data.avatar?.sources
                            ?? content.images?.items?.flatMap((i: any) => i.sources)
                            ?? content.images?.sources
                            ?? content.metadata?.images?.flatMap((i: any) => i.sources)
                            ?? data.itemV2?.data?.images?.items?.flatMap((i: any) => i.sources)
                            ?? [];

                                                                            
                        const name = data.name
                            || data.profile?.name
                            || data.title?.transformedLabel
                            || data.title?.text
                            || data.label
                            || data.text
                            || data.heading?.text
                            || content.name
                            || content.title?.text
                            || content.metadata?.name;

                                                                                            
                        if (!name || name === "Unknown" || images.length === 0) {
                            return null;
                        }

                        
                        const uriType = (item.uri || "").split(":")[1];
                        let objectType = data.__typename
                            || content.__typename?.replace("ResponseWrapper", "")
                            || (uriType ? uriType.charAt(0).toUpperCase() + uriType.slice(1) : "Unknown");

                        
                        if (objectType === "Collection" || objectType === "CollectionView") objectType = "Playlist";

                        return {
                            objectType,
                            id,
                            name,
                            uri: item.uri || `spotify:unknown:${id}`,
                            external_urls: {
                                spotify: `https://open.spotify.com/${objectType.toLowerCase()}/${id}`,
                            },
                            images,
                        } as any;
                    }

                    return null;
                })
                .filter((item: any) => item !== null),
        } satisfies BrowseSectionItem;
    }

    async home({
        timeZone,
        spTCookie,
        limit = 20,
    }: {
        timeZone: string;
        spTCookie: string;
        limit?: number;
    }): Promise<BrowseSectionItem[]> {
        const hash = await getHash("Browse", "home");

        const res = await this.gqlClient
            .post("query", {
                body: {
                    variables: {
                        timeZone,
                        sp_t: spTCookie,
                        facet: "",
                        sectionItemsLimit: limit,
                    },
                    operationName: "home",
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

        const homeData = res.data?.home;
        if (!homeData || !homeData.sectionContainer) {
            return [];
        }

        const homeSections = homeData.sectionContainer.sections.items;

        return homeSections
            .filter(
                (section: any) =>
                    
                    section.sectionItems?.items?.length > 0
            )
            .map((section: any) => {
                return this.parseSectionItems(section);
            })
            .filter(
                (section: any) => section.items.length > 0
            ) satisfies BrowseSectionItem[];
    }

    async homeSection(
        id: string,
        {
            timeZone,
            spTCookie,
            limit = 20,
            offset = 0,
        }: {
            timeZone: string;
            spTCookie: string;
            limit?: number;
            offset?: number;
        }
    ): Promise<GqlPage<BrowseSectionItem["items"][number]>> {
        const hash = await getHash("Browse", "home");

        const res = await this.gqlClient
            .post("query", {
                body: {
                    variables: {
                        uri: `spotify:section:${id}`,
                        timeZone,
                        sp_t: spTCookie,
                        facet: "",
                        sectionItemsOffset: offset,
                        sectionItemsLimit: limit,
                    },
                    operationName: "homeSection",
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

        if (!res.data?.homeSections?.sections?.[0]?.sectionItems) {
            return {
                offset: offset,
                limit: limit,
                total: 0,
                items: [],
            };
        }

        const homeSection = res.data.homeSections.sections[0].sectionItems;
        const pagingInfo = homeSection.pagingInfo;

        const items = this.parseSectionItems(
            res.data.homeSections.sections[0]
        ).items;

        return {
            offset: pagingInfo.offset ?? offset,
            limit: pagingInfo.limit ?? limit,
            total: homeSection.totalCount ?? 0,
            items,
        };
    }
}

export { SpotifyBrowseEndpoint };
