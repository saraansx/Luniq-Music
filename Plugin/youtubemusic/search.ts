import { YoutubeMusicClient } from './client.js';

export interface YtTrack {
    id: string;
    title: string;
    artists: { name: string; id: string | null }[];
    album?: { name: string; id: string };
    durationMs: number;
    thumbnail: string;
    isExplicit: boolean;
    source: 'youtube';
}

export class YoutubeMusicSearch {
    constructor(private client: YoutubeMusicClient) {}

    async query(searchTerm: string): Promise<YtTrack[]> {
        const payload = {
            query: searchTerm,
            params: 'EgWKAQIIAWoMEAMQBBAJEA4QChAF'
        };

        const response = await this.client.post('search', payload);
        const tracks: YtTrack[] = [];

        try {
            const tabs = response.contents?.tabbedSearchResultsRenderer?.tabs;
            if (!tabs) return [];

            const sectionList = tabs[0]?.tabRenderer?.content?.sectionListRenderer?.contents;
            if (!sectionList) return [];

            const shelf = sectionList.find((c: any) => c.musicShelfRenderer)?.musicShelfRenderer;
            if (!shelf) return [];

            for (const item of shelf.contents || []) {
                const renderer = item.musicResponsiveListItemRenderer;
                if (!renderer) continue;

                const track = this.parseTrack(renderer);
                if (track) tracks.push(track);
            }
        } catch (e) {
            console.error('[YoutubeMusic] Search parse error:', e);
        }

        return tracks;
    }

    private parseTrack(renderer: any): YtTrack | null {
        try {
            const columns = renderer.flexColumns;
            if (!columns || columns.length < 2) return null;

                                               
            const titleRun = columns[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0];
            const title = titleRun?.text;
            const videoId = renderer.playlistItemData?.videoId || titleRun?.navigationEndpoint?.watchEndpoint?.videoId;

            if (!title || !videoId) return null;

            const metadataRuns = columns[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
            
            const artists = [];
            let album;
            let durationText = '';

            for (let i = 0; i < metadataRuns.length; i++) {
                const run = metadataRuns[i];
                if (run.text === ' • ') continue;

                const browseId = run.navigationEndpoint?.browseEndpoint?.browseId;
                const pageType = run.navigationEndpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType;

                if (pageType === 'MUSIC_PAGE_TYPE_ARTIST') {
                    artists.push({ name: run.text, id: browseId });
                } else if (pageType === 'MUSIC_PAGE_TYPE_ALBUM') {
                    album = { name: run.text, id: browseId };
                } else if (/^\d+:\d+/.test(run.text)) {
                    durationText = run.text;
                } else if (!pageType && i === 0 && !run.text.match(/^\d+:\d+/)) {
                                                         
                    artists.push({ name: run.text, id: null });
                }
            }

            const thumbnails = renderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails;
            const thumbnailUrl = thumbnails ? thumbnails[thumbnails.length - 1]?.url : '';

            let durationMs = 0;
            if (durationText) {
                const parts = durationText.split(':').map(Number);
                if (parts.length === 2) durationMs = (parts[0] * 60 + parts[1]) * 1000;
                if (parts.length === 3) durationMs = (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
            }

            return {
                id: videoId,
                title,
                artists: artists.length > 0 ? artists : [{ name: 'Unknown Artist', id: null }],
                album,
                durationMs,
                thumbnail: thumbnailUrl,
                isExplicit: renderer.badges?.some((b: any) => b.musicInlineBadgeRenderer?.icon?.iconType === 'MUSIC_EXPLICIT_BADGE') || false,
                source: 'youtube'
            };
        } catch (e) {
            return null;
        }
    }
}
