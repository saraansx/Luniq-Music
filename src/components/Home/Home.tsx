
import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import './Home.css';
import { useApi } from '../../context/ApiContext';
import type { BrowseSectionItem } from '../../../Plugin/gql/types/gql-api';
import { HomeSkeleton } from '../Skeleton/Skeleton';
import { formatDuration } from '../../utils/format';

interface PlatformCookie {
    domain: string;
    expirationDate?: number;
    hostOnly: boolean;
    httpOnly: boolean;
    name: string;
    path: string;
    sameSite: string;
    secure: boolean;
    session: boolean;
    value: string;
}

import { usePlayer } from '../../context/PlayerContext';
import { useLanguage } from '../../context/LanguageContext';
import { LuniqTrack, normalizeTrack } from '../../types/track';
import { usePlayback } from '../../context/PlaybackContext';

interface HomeProps {
    accessToken?: string;
    cookies?: PlatformCookie[];
    onPlaylistSelect?: (id: string, isAlbum?: boolean) => void;
    onTrackViewSelect?: (trackInfo: { id: string; name: string; image: string; artists: string[] }) => void;
    onArtistSelect?: (id: string) => void;
}

const Home = ({ accessToken, cookies, onPlaylistSelect, onTrackViewSelect, onArtistSelect }: HomeProps) => {
    const { 
        handleTrackSelect: onTrackSelect,
        handlePlayNext: onPlayNext,
        handleAddToQueue: onAddToQueue,
        currentTrack
    } = usePlayer();
    const { lowDataMode } = usePlayback();
    const { t } = useLanguage();
    const [sections, setSections] = useState<BrowseSectionItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [activeSection, setActiveSection] = useState<{ id: string; title: string } | null>(null);
    const [sectionItems, setSectionItems] = useState<any[]>([]);

    // Context menu state for trending track items
    const [trackMenu, setTrackMenu] = useState<string | null>(null);
    const [menuTrack, setMenuTrack] = useState<LuniqTrack | null>(null);
    const [menuPosition, setMenuPosition] = useState<{ x: number; y: number; isBottom: boolean } | null>(null);
    const [menuFavoriteState, setMenuFavoriteState] = useState<boolean | null>(null);
    const [menuDownloadState, setMenuDownloadState] = useState<boolean | null>(null);
    const [showPlaylistSubmenu, setShowPlaylistSubmenu] = useState(false);
    const [localPlaylists, setLocalPlaylists] = useState<any[]>([]);
    const [trackPlaylists, setTrackPlaylists] = useState<string[]>([]);

    const api = useApi();

    const [userName, setUserName] = useState<string>('');

    useEffect(() => {
        const fetchUser = async () => {
            if (!accessToken) return;
            try {
                const profile = await api.user.me();
                if (profile?.display_name) {
                    setUserName(profile.display_name);
                }
            } catch (err) {
                console.warn('Could not fetch user profile for greeting:', err);
            }
        };
        fetchUser();
    }, [api, accessToken]);

    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        let base = '';
        if (hour < 12) base = t('home.goodMorning');
        else if (hour < 18) base = t('home.goodAfternoon');
        else base = t('home.goodEvening');
        
        return userName ? `${base}, ${userName}` : base;
    }, [t, userName]);

    const fetchHomeData = async () => {
        try {
            setLoading(true);
            const spT = Array.isArray(cookies) ? cookies.find(c => c.name === 'sp_t')?.value : undefined;

            const data = await api.browse.home({
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                spTCookie: spT,
            });

            setSections(data);
        } catch (err: any) {
            console.error('Failed to fetch home data:', err);
            setError(err.message || 'Failed to load content');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!activeSection) {
            fetchHomeData();
        }
    }, [api, cookies, activeSection]);

    const handleShowAll = async (section: BrowseSectionItem) => {
        try {
            setLoading(true);
            setActiveSection({ id: section.id, title: section.title });

            const spT = Array.isArray(cookies) ? cookies.find(c => c.name === 'sp_t')?.value : undefined;

            const data = await api.browse.homeSection(section.id, {
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                spTCookie: spT,
                limit: 50 
            });

            const cleanItems = (data.items || []).filter((item: any) => {
                const name = (item.name || "").trim().toLowerCase();
                if (name === "various artists" || name === "various artist") return false;
                const uri = item.uri || "";
                if (uri.includes(":episode:") || uri.includes(":show:")) return false;
                return true;
            });

            setSectionItems(cleanItems);
        } catch (err: any) {
            console.error('Failed to load section:', err);
            setError('Failed to load section content');
        } finally {
            setLoading(false);
        }
    };

    const handleBackToHome = () => {
        setActiveSection(null);
        setSectionItems([]);
        setError(null);
        
        
    };

    const handleCardClick = (item: any) => {
        const uriType = item.uri?.split(':')?.[1];
        const isTrack = item.objectType === 'Track' || uriType === 'track';
        const isPlaylist = item.objectType === 'Playlist' || uriType === 'playlist';
        const isAlbum = item.objectType === 'Album' || uriType === 'album';
        const isArtist = item.objectType === 'Artist' || uriType === 'artist';

        console.log('[Home] Card clicked:', { objectType: item.objectType, uri: item.uri, uriType, isTrack, isPlaylist, isAlbum, isArtist, name: item.name });

        if (isTrack && onTrackViewSelect) {
            
            onTrackViewSelect({
                id: item.uri?.split(':').pop() || item.id,
                name: item.name,
                image: item.images?.[0]?.url || '',
                artists: item.artists?.map((a: any) => a.name) || [],
            });
        } else if (isPlaylist && onPlaylistSelect) {
            const id = item.uri?.split(':').pop() || item.id;
            onPlaylistSelect(id);
        } else if (isAlbum && onPlaylistSelect) {
            const id = item.uri?.split(':').pop() || item.id;
            onPlaylistSelect(id, true);
        } else if (isArtist && onArtistSelect) {
            const id = item.uri?.split(':').pop() || item.id;
            onArtistSelect(id);
        } else if (onTrackViewSelect) {
                                                                
            console.log('[Home] Unknown type, opening as track view');
            onTrackViewSelect({
                id: item.uri?.split(':').pop() || item.id,
                name: item.name,
                image: item.images?.[0]?.url || '',
                artists: item.artists?.map((a: any) => a.name) || [],
            });
        }
    };

    const fetchTracksForItem = async (item: any): Promise<LuniqTrack[]> => {
        const uriType = item.uri?.split(':')?.[1];
        const isTrack = item.objectType === 'Track' || uriType === 'track';
        const isAlbum = item.objectType === 'Album' || uriType === 'album';
        const isArtist = item.objectType === 'Artist' || uriType === 'artist';

        if (isTrack) {
            return [normalizeTrack(item, lowDataMode)];
        }

        try {
            const id = item.uri?.split(':').pop() || item.id;
            
            if (isArtist) {
                const artistOverview = await api.artist.getArtist(id);
                const topTracks = (artistOverview?.discography?.topTracks?.items || [])
                    .map((tItem: any) => normalizeTrack(tItem.track, lowDataMode))
                    .filter((t: any) => t && t.id);
                return topTracks.length > 0 ? topTracks : [normalizeTrack(item, lowDataMode)];
            } else if (isAlbum) {
                const albumData = await api.album.getAlbum(id);
                const trackItems = albumData?.tracksV2?.items || albumData?.tracks?.items || albumData?.tracks || [];
                const coverUrl = albumData?.coverArt?.sources?.[0]?.url
                                || albumData?.images?.items?.[0]?.sources?.[0]?.url
                                || albumData?.images?.[0]?.url || item.images?.[0]?.url || '';
                
                const mapped = trackItems.map((tItem: any) => {
                    const track = tItem.track || tItem;
                    if (!track) return null;
                    const normalized = normalizeTrack(track, lowDataMode);
                    if (!normalized.albumArt || normalized.albumArt.includes('data:image/svg')) normalized.albumArt = coverUrl;
                    if (!normalized.albumName) normalized.albumName = albumData.name;
                    return normalized;
                }).filter((t: any) => t !== null);
                
                return mapped.length > 0 ? mapped : [normalizeTrack(item, lowDataMode)];
            } else {
                const data = await api.playlist.getPlaylist(id);
                if (!data?.content?.items?.length) {
                    return [normalizeTrack(item, lowDataMode)];
                }

                return (data.content?.items || [])
                    .map((trackItem: any) => {
                        const trackData = trackItem.itemV2?.data;
                        if (!trackData) return null;
                        return normalizeTrack(trackData, lowDataMode);
                    })
                    .filter((t: any): t is LuniqTrack => t !== null);
            }
        } catch (err) {
            console.error('Failed to fetch tracks for item:', err);
            return [normalizeTrack(item, lowDataMode)];
        }
    };

    const handlePlayButtonClick = async (e: React.MouseEvent, item: any) => {
        e.stopPropagation();
        const tracks = await fetchTracksForItem(item);
        if (tracks.length > 0 && onTrackSelect) {
            onTrackSelect(tracks[0], tracks);
        }
    };

    const handleTrackMenuClick = async (e: React.MouseEvent, track: LuniqTrack) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const isBottom = rect.bottom > window.innerHeight - 250;
        setMenuPosition({
            x: rect.right,
            y: isBottom ? rect.top : rect.bottom,
            isBottom
        });
        setMenuTrack(track);
        setTrackMenu(track.id);
        setShowPlaylistSubmenu(false);

        try {
            const isFav = await window.ipcRenderer?.invoke('check-local-favorite', track.id);
            setMenuFavoriteState(!!isFav);

            const isDl = await window.ipcRenderer?.invoke('check-is-downloaded', track.id);
            setMenuDownloadState(!!isDl);

            const plList = await window.ipcRenderer?.invoke('get-playlists');
            setLocalPlaylists(plList || []);

            const trackPls = await window.ipcRenderer?.invoke('get-track-playlists', track.id);
            setTrackPlaylists(trackPls || []);
        } catch (err) {
            console.error('Failed to query track context info:', err);
        }
    };

    const handleToggleFavorite = async (track: LuniqTrack) => {
        try {
            const isFav = await window.ipcRenderer?.invoke('check-local-favorite', track.id);
            if (isFav) {
                await window.ipcRenderer?.invoke('remove-local-favorite', track.id);
                setMenuFavoriteState(false);
            } else {
                await window.ipcRenderer?.invoke('add-local-favorite', track);
                setMenuFavoriteState(true);
            }
            window.dispatchEvent(new Event('luniq:playlist-update'));
        } catch (err) {
            console.error('Failed to toggle favorite:', err);
        }
    };

    const handleToggleDownload = async (track: LuniqTrack) => {
        try {
            const isDl = await window.ipcRenderer?.invoke('check-is-downloaded', track.id);
            if (isDl) {
                await window.ipcRenderer?.invoke('delete-downloaded-track', track.id);
                setMenuDownloadState(false);
            } else {
                await window.ipcRenderer?.invoke('download-track', track);
                setMenuDownloadState(true);
            }
            window.dispatchEvent(new Event('luniq:download-update'));
        } catch (err) {
            console.error('Failed to toggle download:', err);
        }
    };

    const handleTogglePlaylistTrack = async (playlistId: string, track: LuniqTrack) => {
        try {
            const inPlaylist = trackPlaylists.includes(playlistId);
            if (inPlaylist) {
                await window.ipcRenderer?.invoke('remove-track-from-playlist', playlistId, track.id);
                setTrackPlaylists(prev => prev.filter(id => id !== playlistId));
            } else {
                await window.ipcRenderer?.invoke('add-track-to-playlist', playlistId, track);
                setTrackPlaylists(prev => [...prev, playlistId]);
            }
            window.dispatchEvent(new Event('luniq:playlist-update'));
        } catch (err) {
            console.error('Failed to toggle playlist track:', err);
        }
    };

    useEffect(() => {
        const handleOutsideClick = () => {
            if (trackMenu) {
                setTrackMenu(null);
                setMenuTrack(null);
            }
        };
        window.addEventListener('click', handleOutsideClick);
        return () => window.removeEventListener('click', handleOutsideClick);
    }, [trackMenu]);

    // Identify trending tracks section and popular artists section (MUST be called before any conditional return!)
    const { trendingSection, artistSection, standardSections } = useMemo(() => {
        let foundTrending: BrowseSectionItem | null = null;
        let foundArtist: BrowseSectionItem | null = null;
        const rest: BrowseSectionItem[] = [];

        for (const s of sections) {
            if (!s.items || s.items.length === 0 || !s.title) continue;
            const title = s.title.toLowerCase();
            if (title.includes("unknown") || title.includes("recently")) continue;
            if (title.includes("episode") || title.includes("podcast") || title.includes("show") || title.includes("audiobook")) continue;

            const hasArtists = s.items.some(item => item.objectType === 'Artist' || item.uri?.includes(':artist:'));
            const isArtistTitle = title.includes('artist') || title.includes('singer') || title.includes('favorite');

            if (!foundArtist && (hasArtists || isArtistTitle)) {
                foundArtist = s;
                continue;
            }

            const hasTracks = s.items.some(item => (item as any).objectType === 'Track' || item.uri?.includes(':track:'));
            const isTrendingTitle = title.includes('trend') || title.includes('popular') || title.includes('top') || title.includes('chart') || title.includes('hit');

            if (!foundTrending && (hasTracks || isTrendingTitle)) {
                foundTrending = s;
                continue;
            }

            rest.push(s);
        }

        // If artistSection is found but no trendingSection, check if rest has any playlist/album/track section
        if (foundArtist && !foundTrending && rest.length > 1) {
            // Take the 2nd section (index 1 after jumpBackIn six-pack) as trending
            foundTrending = rest.splice(1, 1)[0];
        }

        return {
            trendingSection: foundTrending,
            artistSection: foundArtist,
            standardSections: rest
        };
    }, [sections]);

    if (loading) {
        return <HomeSkeleton />;
    }

    if (error) {
        return (
            <div className="home-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
                <h2>{t('home.error')}</h2>
                <p>{error}</p>
                <button onClick={async () => {
                    if (activeSection) {
                        handleBackToHome();
                    } else {
                        if (error && error.includes('401')) {
                            try {
                                console.log('Encountered 401, forcing token refresh...');
                                await window.ipcRenderer?.invoke('get-spotify-credentials', true);
                            } catch (e) {
                                console.error('Failed to force refresh:', e);
                            }
                        }
                        window.location.reload();
                    }
                }}>
                    {activeSection ? t('home.backToHome') : t('home.retry')}
                </button>
                {!activeSection && (
                    <button
                        style={{ marginTop: '16px', background: 'transparent', border: '1px solid #ffffff55' }}
                        onClick={async () => {
                            await window.ipcRenderer?.invoke('logout');
                            window.location.reload();
                        }}
                    >
                        {t('home.reLogin')}
                    </button>
                )}
            </div>
        );
    }

    if (activeSection) {
        return (
            <div className="home-container">
                <header className="home-header" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button
                        onClick={handleBackToHome}
                        style={{
                            background: 'rgba(255,255,255,0.1)',
                            border: 'none',
                            color: 'white',
                            borderRadius: '50%',
                            width: '32px',
                            height: '32px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M11.03.47a.75.75 0 010 1.06L4.56 8l6.47 6.47a.75.75 0 11-1.06 1.06L2.44 8 9.97.47a.75.75 0 011.06 0z"></path>
                        </svg>
                    </button>
                    <h1 className="home-title" style={{ fontSize: '2rem' }}>{activeSection.title}</h1>
                </header>

                <div className="section-list">
                    <div className="items-grid">
                        {sectionItems.map((item) => (
                            <div key={item.uri || item.id} className="card" onClick={() => handleCardClick(item)}>
                                <div className="card-image-wrapper">
                                    <img
                                        src={item.images[0]?.url || 'placeholder.png'}
                                        alt={item.name}
                                        className="card-image"
                                        loading="lazy"
                                    />
                                    <div className="play-button" onClick={(e) => handlePlayButtonClick(e, item)}>
                                        <svg role="img" height="24" width="24" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M7.05 3.606l13.49 7.788a.7.7 0 010 1.212L7.05 20.394A.7.7 0 016 19.788V4.212a.7.7 0 011.05-.606z"></path>
                                        </svg>
                                    </div>

                                </div>
                                <div className="card-content">
                                    <h3 className="card-title">{item.name}</h3>
                                    <p className="card-subtitle">
                                        {(() => {
                                            const raw = item as any;
                                            const artistList = raw.artists || raw.firstArtist?.items || raw.track?.artists;
                                            if (Array.isArray(artistList) && artistList.length > 0) {
                                                return artistList.map((a: any) => a.name || a.profile?.name).filter(Boolean).join(', ');
                                            }
                                            if (raw.artist) return raw.artist;
                                            if (raw.objectType === 'Playlist') {
                                                return raw.owner?.display_name ? `${t('home.by')} ${raw.owner.display_name}` : raw.description || t('home.playlist');
                                            }
                                            if (raw.objectType === 'Album') return t('home.album');
                                            if (raw.objectType === 'Artist') return t('home.artist');
                                            if (raw.description) return raw.description;
                                            return t('home.track') || 'Track';
                                        })()}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="home-container">
            <header className="home-header">
                <h1 className="home-title">{greeting}</h1>
            </header>

            <div className="section-list">
                {!loading && !error && sections.length === 0 && (
                    <div className="empty-state" style={{ textAlign: 'center', marginTop: '40px', opacity: 0.7 }}>
                        <h3>{t('home.emptyTitle')}</h3>
                        <p>{t('home.emptyDesc')}</p>
                        <button
                            style={{
                                marginTop: '16px',
                                padding: '8px 16px',
                                background: 'white',
                                color: 'black',
                                borderRadius: '20px',
                                fontSize: '14px',
                                fontWeight: 600
                            }}
                            onClick={() => window.location.reload()}
                        >
                            {t('home.reload')}
                        </button>
                    </div>
                )}

                {/* 1. Six-Pack / Jump back in (first standard section) */}
                {standardSections.length > 0 && (() => {
                    const section = standardSections[0];
                    const displayTitle = section.title || t('home.jumpBackIn');
                    const filteredItems = section.items.filter(item => {
                        const uri = item.uri || "";
                        const name = (item.name || "").trim().toLowerCase();
                        if (uri.includes(":episode:") || uri.includes(":show:")) return false;
                        if (name === "various artists" || name === "various artist") return false;
                        // Filter out items that have no images or empty image urls
                        const hasValidImage = Array.isArray(item.images) && item.images.length > 0 && !!item.images[0]?.url;
                        if (!hasValidImage && !item.images?.[0]) return false;
                        return true;
                    });
                    if (filteredItems.length === 0) return null;

                    return (
                        <section key={section.id} className="browse-section">
                            <div className="section-header">
                                <h2 className="home-section-title">{displayTitle}</h2>
                                <button className="show-all-btn" onClick={() => handleShowAll(section)}>
                                    {t('home.showAll')}
                                </button>
                            </div>
                            <div className="items-grid six-pack">
                                {filteredItems.map((item) => (
                                    <div key={item.uri || item.id} className="card" onClick={() => handleCardClick(item)}>
                                        <div className="card-image-wrapper">
                                            <img
                                                src={item.images[0]?.url || 'placeholder.png'}
                                                alt={item.name}
                                                className="card-image"
                                                loading="lazy"
                                            />
                                        </div>
                                        <div className="card-content">
                                            <h3 className="card-title">{item.name}</h3>
                                            <p className="card-subtitle">
                                                {(() => {
                                                    const raw = item as any;
                                                    const artistList = raw.artists || raw.firstArtist?.items || raw.track?.artists;
                                                    if (Array.isArray(artistList) && artistList.length > 0) {
                                                        return artistList.map((a: any) => a.name || a.profile?.name).filter(Boolean).join(', ');
                                                    }
                                                    if (raw.artist) return raw.artist;
                                                    if (raw.objectType === 'Playlist') {
                                                        return raw.owner?.display_name ? `${t('home.by')} ${raw.owner.display_name}` : raw.description || t('home.playlist');
                                                    }
                                                    if (raw.objectType === 'Album') return t('home.album');
                                                    if (raw.objectType === 'Artist') return t('home.artist');
                                                    if (raw.description) return raw.description;
                                                    return t('home.track') || 'Track';
                                                })()}
                                            </p>
                                        </div>
                                        <div className="play-button" onClick={(e) => handlePlayButtonClick(e, item)}>
                                            <svg role="img" height="14" width="14" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M7.05 3.606l13.49 7.788a.7.7 0 010 1.212L7.05 20.394A.7.7 0 016 19.788V4.212a.7.7 0 011.05-.606z"></path>
                                            </svg>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    );
                })()}

                {/* 2. Side-by-Side Split: Trending Now (Left) & Artists You Love (Right) */}
                {(trendingSection || artistSection) && (
                    <section className="browse-section home-split-row">
                        {/* Left: Trending now */}
                        {trendingSection && (
                            <div className="split-col split-trending-col">
                                <div className="split-header">
                                    <h2 className="split-title">{t('home.trendingNow') || trendingSection.title || 'Trending now'}</h2>
                                    <button className="show-all-btn" onClick={() => handleShowAll(trendingSection)}>
                                        {t('home.showAll')}
                                    </button>
                                </div>
                                <div className="trending-track-list">
                                    {trendingSection.items.slice(0, 4).map((item, index) => {
                                        const raw = item as any;
                                        const artistName = raw.artists?.[0]?.name || raw.artist || 'Unknown';
                                        const normTrack: LuniqTrack = {
                                            id: (item.uri || "").split(":").pop() || item.id,
                                            name: item.name,
                                            artist: artistName,
                                            artists: raw.artists?.map((a: any) => ({ name: a.name, id: a.id })) || [{ name: artistName, id: null }],
                                            albumArt: item.images?.[0]?.url || '',
                                            durationMs: raw.durationMs || raw.duration_ms || raw.trackDuration?.totalMilliseconds || 0,
                                            albumName: raw.album?.name || raw.albumName || ''
                                        };
                                        const isPlayingThis = currentTrack?.id === normTrack.id;

                                        return (
                                            <div
                                                key={item.uri || item.id}
                                                className="trending-track-item"
                                                onClick={() => handleCardClick(item)}
                                            >
                                                <div className="trending-rank">
                                                    {isPlayingThis ? (
                                                        <div className="playing-animation">
                                                            <div className="bar bar1"></div>
                                                            <div className="bar bar2"></div>
                                                            <div className="bar bar3"></div>
                                                        </div>
                                                    ) : (
                                                        index + 1
                                                    )}
                                                </div>
                                                <div className="trending-art-wrapper">
                                                    <img
                                                        src={item.images?.[0]?.url || 'placeholder.png'}
                                                        alt={item.name}
                                                        className="trending-art-img"
                                                        loading="lazy"
                                                    />
                                                    <div
                                                        className="trending-play-overlay"
                                                        onClick={(e) => handlePlayButtonClick(e, item)}
                                                    >
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                                            <path d="M7.05 3.606l13.49 7.788a.7.7 0 010 1.212L7.05 20.394A.7.7 0 016 19.788V4.212a.7.7 0 011.05-.606z"></path>
                                                        </svg>
                                                    </div>
                                                </div>
                                                <div className="trending-meta">
                                                    <span className="trending-title">{item.name}</span>
                                                    <span className="trending-artists">
                                                        {(() => {
                                                            const artistList = raw.artists || raw.firstArtist?.items || raw.track?.artists;
                                                            if (Array.isArray(artistList) && artistList.length > 0) {
                                                                return artistList.map((a: any, i: number) => (
                                                                    <React.Fragment key={i}>
                                                                        <span
                                                                            className="trending-artist-link"
                                                                            onClick={(e) => {
                                                                                if (onArtistSelect && (a.id || a.uri)) {
                                                                                    e.stopPropagation();
                                                                                    onArtistSelect(a.id || a.uri.split(':').pop());
                                                                                }
                                                                            }}
                                                                        >
                                                                            {a.name || a.profile?.name}
                                                                        </span>
                                                                        {i < artistList.length - 1 && ', '}
                                                                    </React.Fragment>
                                                                ));
                                                            }
                                                            return raw.artist || 'Artist';
                                                        })()}
                                                    </span>
                                                </div>
                                                <div className="trending-duration">
                                                    {normTrack.durationMs > 0 ? formatDuration(normTrack.durationMs) : ''}
                                                </div>
                                                <button
                                                    className="trending-dots-btn"
                                                    title={t('playlist.more') || 'More options'}
                                                    onClick={(e) => handleTrackMenuClick(e, normTrack)}
                                                >
                                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                                                        <circle cx="12" cy="5" r="2" />
                                                        <circle cx="12" cy="12" r="2" />
                                                        <circle cx="12" cy="19" r="2" />
                                                    </svg>
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Right: Artists you love */}
                        {artistSection && (
                            <div className="split-col split-artists-col">
                                <div className="split-header">
                                    <h2 className="split-title">{t('home.artistsYouLove') || artistSection.title || 'Artists you love'}</h2>
                                    <button className="show-all-btn" onClick={() => handleShowAll(artistSection)}>
                                        {t('home.showAll')}
                                    </button>
                                </div>
                                <div className="artist-cards-row">
                                    {artistSection.items.slice(0, 8).map((item) => (
                                        <div
                                            key={item.uri || item.id}
                                            className="artist-circle-card"
                                            onClick={() => handleCardClick(item)}
                                        >
                                            <div className="artist-circle-avatar-wrapper">
                                                <img
                                                    src={item.images[0]?.url || 'placeholder.png'}
                                                    alt={item.name}
                                                    className="artist-circle-avatar"
                                                    loading="lazy"
                                                />
                                            </div>
                                            <span className="artist-circle-name">{item.name}</span>
                                            <span className="artist-circle-subtitle">{t('home.artist') || 'Artist'}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>
                )}

                {/* 3. Remaining Standard Sections */}
                {standardSections.slice(1).map((section) => {
                    const displayTitle = section.title || t('home.recommended');
                    const filteredItems = section.items.filter(item => {
                        const uri = item.uri || "";
                        const name = (item.name || "").trim().toLowerCase();
                        if (uri.includes(":episode:") || uri.includes(":show:")) return false;
                        if (name === "various artists" || name === "various artist") return false;
                        const hasValidImage = Array.isArray(item.images) && item.images.length > 0 && !!item.images[0]?.url;
                        if (!hasValidImage && !item.images?.[0]) return false;
                        return true;
                    });
                    
                    if (filteredItems.length === 0) return null;

                    return (
                        <section key={section.id} className="browse-section">
                            <div className="section-header">
                                <h2 className="home-section-title">{displayTitle}</h2>
                                <button
                                    className="show-all-btn"
                                    onClick={() => handleShowAll(section)}
                                >
                                    {t('home.showAll')}
                                </button>
                            </div>
                            <div className="items-grid">
                                {filteredItems.map((item) => (
                                    <div key={item.uri || item.id} className="card" onClick={() => handleCardClick(item)}>
                                        <div className="card-image-wrapper">
                                            <img
                                                src={item.images[0]?.url || 'placeholder.png'}
                                                alt={item.name}
                                                className="card-image"
                                                loading="lazy"
                                            />
                                            <div className="play-button" onClick={(e) => handlePlayButtonClick(e, item)}>
                                                <svg role="img" height="24" width="24" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M7.05 3.606l13.49 7.788a.7.7 0 010 1.212L7.05 20.394A.7.7 0 016 19.788V4.212a.7.7 0 011.05-.606z"></path>
                                                </svg>
                                            </div>
                                        </div>
                                        <div className="card-content">
                                            <h3 className="card-title">{item.name}</h3>
                                            <p className="card-subtitle">
                                                {(() => {
                                                    const raw = item as any;
                                                    const artistList = raw.artists || raw.firstArtist?.items || raw.track?.artists;
                                                    if (Array.isArray(artistList) && artistList.length > 0) {
                                                        return artistList.map((a: any) => a.name || a.profile?.name).filter(Boolean).join(', ');
                                                    }
                                                    if (raw.artist) return raw.artist;
                                                    if (raw.objectType === 'Playlist') {
                                                        return raw.owner?.display_name ? `${t('home.by')} ${raw.owner.display_name}` : raw.description || t('home.playlist');
                                                    }
                                                    if (raw.objectType === 'Album') return t('home.album');
                                                    if (raw.objectType === 'Artist') return t('home.artist');
                                                    if (raw.description) return raw.description;
                                                    return t('home.track') || 'Track';
                                                })()}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    );
                })}
            </div>

            {/* Context Menu Portal for Trending Tracks */}
            {trackMenu && menuTrack && menuPosition && createPortal(
                <div 
                    className={`luniq-dropdown ${menuPosition.isBottom ? 'open-up' : 'open-down'}`}
                    style={{
                        position: 'fixed',
                        top: menuPosition.isBottom ? 'auto' : `${menuPosition.y + 8}px`,
                        bottom: menuPosition.isBottom ? `${window.innerHeight - menuPosition.y + 8}px` : 'auto',
                        right: `${window.innerWidth - menuPosition.x}px`,
                        left: 'auto',
                        zIndex: 9999
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button className="luniq-dropdown-item" onClick={() => { onPlayNext?.(menuTrack); setTrackMenu(null); }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M13 12H3M13 6H3M13 18H3" />
                            <path d="M17 8l5 4-5 4V8z" />
                        </svg>
                        {t('playlist.playNext') || 'Play next'}
                    </button>
                    <button className="luniq-dropdown-item" onClick={() => { onAddToQueue?.(menuTrack); setTrackMenu(null); }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
                        {t('playlist.addToQueue') || 'Add to queue'}
                    </button>
                    {menuFavoriteState !== null && (
                        <button className="luniq-dropdown-item" onClick={() => { handleToggleFavorite(menuTrack); setTrackMenu(null); }}>
                            {menuFavoriteState ? (
                                <>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                                    </svg>
                                    {t('playlist.removeFromFavorites') || 'Remove from favorites'}
                                </>
                            ) : (
                                <>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.84-8.84 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                                    </svg>
                                    {t('playlist.saveToFavorites') || 'Save to favorites'}
                                </>
                            )}
                        </button>
                    )}
                    {menuDownloadState !== null && (
                        <button className="luniq-dropdown-item" onClick={() => { handleToggleDownload(menuTrack); setTrackMenu(null); }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            {menuDownloadState ? (t('playlist.removeDownload') || 'Remove download') : (t('playlist.download') || 'Download')}
                        </button>
                    )}
                    <div className="luniq-dropdown-divider" />
                    <button 
                        className={`luniq-dropdown-item ${showPlaylistSubmenu ? 'active' : ''}`}
                        onClick={() => setShowPlaylistSubmenu(!showPlaylistSubmenu)}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M8 6h13M8 12h13M8 18h5" />
                            <path d="M3 6h.01M3 12h.01M3 18h.01" />
                            <path d="M16 18h6M19 15v6" />
                        </svg>
                        {t('playlist.addToLocalPlaylist') || 'Add to playlist'}
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: 'auto', transform: showPlaylistSubmenu ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                    {showPlaylistSubmenu && (
                        <div className="luniq-submenu">
                            {localPlaylists.length > 0 ? (
                                localPlaylists.map((p) => {
                                    const isInPlaylist = trackPlaylists.includes(p.id);
                                    return (
                                        <button 
                                            key={p.id} 
                                            className={`luniq-dropdown-item ${isInPlaylist ? 'active' : ''}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleTogglePlaylistTrack(p.id, menuTrack);
                                            }}
                                        >
                                            {p.name}
                                            {isInPlaylist && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ marginLeft: 'auto' }}><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                        </button>
                                    );
                                })
                            ) : (
                                <div className="luniq-dropdown-item disabled" style={{ opacity: 0.5, cursor: 'default' }}>{t('playlist.noLocalPlaylists') || 'No playlists'}</div>
                            )}
                        </div>
                    )}
                </div>,
                document.body
            )}
        </div>
    );
};

export default Home;
