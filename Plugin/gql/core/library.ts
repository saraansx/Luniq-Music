import { HttpClient } from "./http-client.js";
import { SpotifyError } from "./error.js";
import { getHash } from "./hash-registry.js";
import { Track } from "../types/web-api.js";
import { GqlPage } from "../types/gql-api.js";

export class SpotifyLibraryEndpoint {
    gqlClient: HttpClient;

    constructor(gqlClient: HttpClient) {
        this.gqlClient = gqlClient;
    }

    async tracks({
        offset = 0,
        limit = 50, 
    }: { offset?: number; limit?: number } = {}): Promise<GqlPage<Track>> {
        const hash = await getHash("Library", "fetchLibraryTracks");

        const res = await this.gqlClient.post("query", {
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
        });

        SpotifyError.mayThrow(res);

        const trackData = res.data.me?.library?.tracks?.items ?? [];
        const pagingInfo = res.data.me?.library?.tracks?.pagingInfo;

        const items = trackData
            .map((item: any) => {
                
                
                const trackWrapper = item.track || item.itemV2 || item.item;
                if (!trackWrapper) return null;

                
                const track = trackWrapper.data || trackWrapper;
                if (!track) return null;

                
                const uri = trackWrapper._uri || track.uri || track._uri || "";
                const id = uri ? uri.split(":").pop() : (track.id || track.trackId || "");

                       
                const name = track.name || track.title || "";

                                                                                
                const albumData = track.albumOfTrack || track.album?.data || track.album || {};
                const albumImages = albumData?.coverArt?.sources
                    || albumData?.images?.items?.flatMap((i: any) => i.sources)
                    || albumData?.images?.items
                    || albumData?.images
                    || [];

                
                const artistsData = track.artists?.items || track.artists || [];
                const mappedArtists = artistsData.map((artist: any) => {
                    const aData = artist?.profile || artist?.data || artist;
                    return {
                        id: aData?.uri ? aData.uri.split(":").pop() : (artist?.uri ? artist.uri.split(":").pop() : (aData?.id || "")),
                        name: aData?.name || artist?.name || aData?.title || "Unknown Artist",
                        uri: aData?.uri || artist?.uri || "",
                    };
                });

                return {
                    id,
                    name: name || "Unknown Track",
                    uri: uri,
                    duration_ms: track.duration?.totalMilliseconds
                        || track.trackDuration?.totalMilliseconds
                        || track.duration_ms
                        || 0,
                    explicit: track.contentRating?.label === "EXPLICIT" || track.explicit === true,
                    album: {
                        id: albumData?.uri ? albumData.uri.split(":").pop() : (albumData?.id || ""),
                        name: albumData?.name || albumData?.title || "Unknown Album",
                        images: albumImages,
                    } as any,
                    artists: mappedArtists,
                    added_at: item.addedAt?.isoString || item.addedAt || "",
                } as unknown as Track;
            }).filter(Boolean);

        return {
            offset: pagingInfo?.offset ?? 0,
            limit: pagingInfo?.limit ?? limit,
            total: res.data.me?.library?.tracks?.totalCount ?? 0,
            items,
        };
    }
}
