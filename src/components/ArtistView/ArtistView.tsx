import React, { useEffect, useState, useRef } from 'react';
import './ArtistView.css';
import { useApi } from '../../context/ApiContext';

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
import { DownloadIndicator } from '../DownloadIndicator/DownloadIndicator';
import { formatDuration, formatMonthlyListeners } from '../../utils/format';
import { usePlayback } from '../../context/PlaybackContext';

interface ArtistViewProps {
    accessToken: string;
    cookies: PlatformCookie[];
    artistId: string;
    onBack: () => void;
    onHome?: () => void;
    onPlaylistSelect?: (id: string, isAlbum?: boolean) => void;
    onArtistSelect?: (id: string) => void;
}

const ARTIST_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9IiNiM2IzYjMiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTEyIDJhNSA1IDAgMSAxIDAgMTAgNSA1IDAgMCAxIDAtMTB6bTAgMTRjNC40MTggMCA4IDIuMjM5IDggNXYxaC0xNnYtMWMwLTIuNzYxIDMuNTgyLTUgOC01eiIvPjwvc3ZnPg==';

const ArtistView: React.FC<ArtistViewProps> = ({
    accessToken: _accessToken,
    cookies: _cookies,
    artistId,
    onBack,
    onHome,
    onPlaylistSelect,
    onArtistSelect,
}) => {
    const { 
        handleTrackSelect: onTrackSelect, 
        handleAddToQueue: onAddToQueue,
        handlePlayNext: onPlayNext,
        activeBulkDownloads,
        startBulkDownload,
        stopBulkDownload
    } = usePlayer();
    const { lowDataMode } = usePlayback();
    const { t } = useLanguage();
    const [artistData, setArtistData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFollowing, setIsFollowing] = useState(false);
    const [menuTrackId, setMenuTrackId] = useState<string | null>(null);
    const [menuPosition, setMenuPosition] = useState<{ x: number, y: number, isBottom: boolean } | null>(null);
    const [localPlaylists, setLocalPlaylists] = useState<any[]>([]);
    const [trackPlaylists, setTrackPlaylists] = useState<string[]>([]);
    const [showPlaylistSubmenu, setShowPlaylistSubmenu] = useState(false);
    const isDownloading = activeBulkDownloads.has(`artist-${artistId}`);
    
    

    const trackMenuRef = useRef<HTMLDivElement>(null);

    const api = useApi();

    useEffect(() => {
        const fetchArtistDetails = async () => {
            try {
                setLoading(true);
                setError(null);

                
                const [data, followStatus] = await Promise.all([
                    api.artist.getArtist(artistId),
                    api.user.isInLibrary([artistId], { itemType: 'artist' })
                ]);

                if (data) {
                    setArtistData(data);
                }
                if (followStatus && followStatus.length > 0) {
                    setIsFollowing(followStatus[0]);
                }
            } catch (err: any) {
                console.error('[ArtistView] Failed to fetch artist:', err);
                setError(err.message || 'Failed to load artist details');
            } finally {
                setLoading(false);
            }
        };

        if (artistId) {
            fetchArtistDetails();
        }
    }, [artistId, api]);

    const handleFollow = async () => {
        try {
            if (isFollowing) {
                await api.artist.unfollow([artistId]);
                setIsFollowing(false);
            } else {
                await api.artist.follow([artistId]);
                setIsFollowing(true);
            }
            window.dispatchEvent(new Event('luniq:playlist-update'));
        } catch (err) {
            console.error('[ArtistView] Failed to toggle follow state:', err);
        }
    };

    const [menuFavoriteState, setMenuFavoriteState] = useState<boolean | null>(null);
    const [menuDownloadState, setMenuDownloadState] = useState<boolean | null>(null);

    const handleTrackMenuClick = async (e: React.MouseEvent, track: any) => {
        e.preventDefault();
        if (menuTrackId === track.id) {
            setMenuTrackId(null);
            setMenuPosition(null);
            setMenuFavoriteState(null);
            setMenuDownloadState(null);
            setShowPlaylistSubmenu(false);
        } else {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const menuHeight = 400; 
            const isBottom = spaceBelow < menuHeight;
            
            setMenuPosition({ 
                x: rect.right, 
                y: isBottom ? rect.top : rect.bottom,
                isBottom 
            });
            
            setMenuTrackId(track.id);
            setMenuFavoriteState(null);
            setMenuDownloadState(null);
            setShowPlaylistSubmenu(false);
            try {
                const [isFav, isDownloaded] = await Promise.all([
                    window.ipcRenderer.invoke('check-local-favorite', track.id),
                    window.ipcRenderer.invoke('check-is-downloaded', track.id)
                ]);
                setMenuFavoriteState(isFav);
                setMenuDownloadState(isDownloaded);
                
                
                const playlists = await window.ipcRenderer.invoke('get-playlists');
                setLocalPlaylists(playlists);

                
                const inPlaylists = await window.ipcRenderer.invoke('get-track-playlists', track.id);
                setTrackPlaylists(inPlaylists);
            } catch (err) {
                console.error("Failed to check favorite status", err);
            }
        }
    };

    const handleTogglePlaylistTrack = async (pId: string, track: LuniqTrack) => {
        try {
            const isAlreadyIn = trackPlaylists.includes(pId);
            let success;
            if (isAlreadyIn) {
                success = await window.ipcRenderer.invoke('remove-track-from-playlist', {
                    playlistId: pId,
                    trackId: track.id
                });
            } else {
                success = await window.ipcRenderer.invoke('add-track-to-playlist', {
                    playlistId: pId,
                    track: track
                });
            }
            if (success) {
                window.dispatchEvent(new Event('luniq:playlist-tracks-update'));
                
                const updatedPlaylists = await window.ipcRenderer.invoke('get-track-playlists', track.id);
                setTrackPlaylists(updatedPlaylists);
            }
        } catch (err) {
            console.error('Failed to toggle track in playlist:', err);
        }
    };

    const handleToggleFavorite = async (track: LuniqTrack) => {
        try {
            if (menuFavoriteState) {
                await window.ipcRenderer.invoke('remove-local-favorite', track.id);
                setMenuFavoriteState(false);
            } else {
                await window.ipcRenderer.invoke('add-local-favorite', track);
                setMenuFavoriteState(true);
            }
            window.dispatchEvent(new Event('luniq:playlist-update'));
        } catch (e) {
            console.error("Failed to toggle favorite", e);
        }
    };

    const handleToggleDownload = async (track: LuniqTrack) => {
        try {
            if (menuDownloadState) {
                const success = await window.ipcRenderer.invoke('remove-download', track.id);
                if (success) setMenuDownloadState(false);
            } else {
                const success = await window.ipcRenderer.invoke('download-track', track);
                if (success) setMenuDownloadState(true);
            }
        } catch (e) {
            console.error("Failed to toggle download", e);
        }
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuTrackId && trackMenuRef.current && !trackMenuRef.current.contains(event.target as Node) && !(event.target as HTMLElement).closest('.luniq-dropdown')) {
                setMenuTrackId(null);
                setMenuPosition(null);
                setShowPlaylistSubmenu(false);
            }
        };

        if (menuTrackId) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [menuTrackId]);

    
    const profile = artistData?.profile;
    const name = profile?.name || 'Unknown Artist';
    const isVerified = profile?.verified || false;

    const visuals = artistData?.visuals;
    const headerImage = visuals?.headerImage?.sources?.[0]?.url 
        || visuals?.avatarImage?.sources?.[0]?.url 
        || '';

    const stats = artistData?.stats;
    const monthlyListeners = stats?.monthlyListeners || 0;

                               
    const topTracksData = artistData?.discography?.topTracks?.items || [];
    const topTracks: LuniqTrack[] = topTracksData.map((item: any) => {
        const tr = item.track || item;
        const normalized = normalizeTrack(tr, lowDataMode);
        if (item.playcount || tr.playcount) {
            (normalized as any).playcount = item.playcount || tr.playcount;
        }
        return normalized;
    }).slice(0, 10);

                                     
    const albums = artistData?.discography?.albums?.items?.map((item: any) => {
        const release = item.releases?.items?.[0] || item;
        const id = (release.id || release.uri?.split(':').pop());
        if (!id) return null;
        return {
            id,
            name: release.name || item.name,
            uri: release.uri || item.uri,
            year: release.date?.year || release.year || 'Unknown',
            images: release.coverArt?.sources || release.images || [],
            type: release.type || 'Album',
        };
    }).filter(Boolean) || [];

    const singles = artistData?.discography?.singles?.items?.map((item: any) => {
        const release = item.releases?.items?.[0] || item;
        const id = (release.id || release.uri?.split(':').pop());
        if (!id) return null;
        return {
            id,
            name: release.name || item.name,
            uri: release.uri || item.uri,
            year: release.date?.year || release.year || 'Unknown',
            images: release.coverArt?.sources || release.images || [],
            type: 'Single',
        };
    }).filter(Boolean) || [];

    const relatedArtists = (artistData?.relatedArtists?.items || []).map((item: any) => ({
        id: item.id || item.uri?.split(':').pop(),
        name: item.profile?.name,
        image: item.visuals?.avatarImage?.sources?.[0]?.url || ARTIST_PLACEHOLDER,
    }));

    const bio = profile?.biography?.text || "";

    const [isPlayStarting, setIsPlayStarting] = useState(false);

    const playFullArtistCatalog = async (startingTrack?: any) => {
        if (!onTrackSelect || isPlayStarting) return;
        
        setIsPlayStarting(true);
        try {
                                                                                             
            const releases = [...albums.slice(0, 5), ...singles.slice(0, 5)];
            let extraTracks: any[] = [];
            
            if (releases.length > 0) {
                const albumPromises = releases.map(r => api.album.getAlbum(r.id).catch(() => null));
                const albumResults = await Promise.all(albumPromises);
                
                for (const albumData of albumResults) {
                    const trackItems = albumData?.tracksV2?.items || albumData?.tracks?.items || albumData?.tracks || [];
                    const coverUrl = albumData?.coverArt?.sources?.[0]?.url
                                  || albumData?.images?.items?.[0]?.sources?.[0]?.url
                                  || albumData?.images?.[0]?.url || '';
                                  
                    const tracks = trackItems.map((item: any) => {
                        const tr = item.track || item;
                        if (!tr) return null;
                        const normalized = normalizeTrack(tr, lowDataMode);
                                                                                            
                        if (!normalized.albumArt || normalized.albumArt.includes('data:image/svg')) normalized.albumArt = coverUrl;
                        return normalized;
                    }).filter((t: any): t is LuniqTrack => t !== null);
                    
                    extraTracks = [...extraTracks, ...tracks];
                }
            }

                                                                             
            const allTracks = [...topTracks, ...extraTracks];
            const uniqueTracks = allTracks.filter((track, index, self) =>
                index === self.findIndex((t: any) => t.id === track.id && track.id)
            );
            
            const first = startingTrack || uniqueTracks[0];
            if (first) {
                onTrackSelect(first, uniqueTracks);
            }
        } catch (e) {
            console.error("Failed to fetch extended artist tracks:", e);
                                 
            const first = startingTrack || topTracks[0];
            if (first) {
                onTrackSelect(first, topTracks);
            }
        } finally {
            setIsPlayStarting(false);
        }
    };

    const handlePlayTopTracks = () => {
        if (topTracks.length > 0) playFullArtistCatalog();
    };

                                                                 
    const handleTrackPlay = (track: LuniqTrack, _index: number) => {
        if (onTrackSelect && track) {
            onTrackSelect(track, topTracks);
        }
    };

    const handleDownloadPopular = async () => {
        if (!topTracks || topTracks.length === 0 || !artistId) return;

        const id = `artist-${artistId}`;
        if (isDownloading) {
            stopBulkDownload(id);
        } else {
            startBulkDownload(id, topTracks);
        }
    };

    const handleAlbumClick = (album: any) => {
        if (onPlaylistSelect && album.id) {
            onPlaylistSelect(album.id, true);
        }
    };

    const handleArtistClick = (id: string) => {
        if (onArtistSelect) {
            onArtistSelect(id);
        }
    };

    const handleDescriptionClick = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        const anchor = target.closest('a');
        if (anchor) {
            const href = anchor.getAttribute('href');
            if (href && href.startsWith('spotify:')) {
                e.preventDefault();
                const parts = href.split(':');
                const type = parts[1];
                const id = parts[2];
                if (type === 'playlist' || type === 'album') {
                    onPlaylistSelect?.(id, type === 'album');
                } else if (type === 'artist') {
                    onArtistSelect?.(id);
                }
            }
        }
    };


    if (loading) {
        return (
            <div className="artist-view-container">
                <div className="luniq-loading-container">
                    <div className="luniq-loading-animation">
                        <div className="bar bar1"></div>
                        <div className="bar bar2"></div>
                        <div className="bar bar3"></div>
                    </div>
                    <span style={{ marginTop: '16px', fontWeight: 500, letterSpacing: '0.5px', opacity: 0.6 }}>{t('home.loading')}</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="artist-view-container">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px' }}>
                    <h2>{t('error.title')}</h2>
                    <p style={{ color: 'var(--text-dim)' }}>{error}</p>
                    <div className="luniq-nav-btn-container">
                        <button onClick={onBack} className="luniq-nav-btn" title="Back">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                        </button>
                        {onHome && (
                            <button onClick={onHome} className="luniq-nav-btn" title="Home">
                                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="artist-view-container">

            {}
            <div className="artist-view-hero" style={headerImage ? { backgroundImage: `url(${headerImage})` } : {}}>

                <div className="artist-view-header-content">
                    {isVerified && (
                        <div className="artist-verified">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                <path d="M10.814.5a1.658 1.658 0 0 1 2.372 0l2.512 2.572 3.595-.043a1.658 1.658 0 0 1 1.678 1.678l-.043 3.595 2.572 2.512c.667.65.667 1.722 0 2.372l-2.572 2.512.043 3.595a1.658 1.658 0 0 1-1.678 1.678l-3.595-.043-2.512 2.572a1.658 1.658 0 0 1-2.372 0l-2.512-2.572-3.595.043a1.658 1.658 0 0 1-1.678-1.678l.043-3.595L.5 13.186a1.658 1.658 0 0 1 0-2.372l2.572-2.512-.043-3.595a1.658 1.658 0 0 1 1.678-1.678l3.595.043L10.814.5z" fill="#3D91F4" />
                                <path d="M9.5 15.5L6 12l-1.06 1.06L9.5 17.62l10-10L18.44 6.56l-8.94 8.94z" fill="#fff" />
                            </svg>
                            Verified by Spotify
                        </div>
                    )}
                    <h1 className="artist-view-title">{name}</h1>
                    {monthlyListeners > 0 && (
                        <div className="artist-view-stats">
                            {formatMonthlyListeners(monthlyListeners)} {t('nowPlaying.monthlyListeners')}
                        </div>
                    )}
                </div>
            </div>

            {}
            <div className="artist-view-actions">
                <button className={`artist-view-play-btn ${isPlayStarting ? 'loading' : ''}`} onClick={handlePlayTopTracks} title="Play">
                    {isPlayStarting ? (
                        <div className="artist-view-play-spinner" />
                    ) : (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M7.05 3.606l13.49 7.788a.7.7 0 010 1.212L7.05 20.394A.7.7 0 016 19.788V4.212a.7.7 0 011.05-.606z" />
                        </svg>
                    )}
                </button>
                <button className={`artist-view-follow-btn${isFollowing ? ' following' : ''}`} onClick={handleFollow}>
                    {isFollowing ? t('search.following') : t('search.follow')}
                </button>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <button
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: isDownloading ? 'var(--accent-main)' : 'var(--text-dim)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '12px',
                            borderRadius: '50%',
                            transition: 'color 0.15s, background 0.15s'
                        }}
                        title={t('artist.downloadPopular')}
                        onClick={handleDownloadPopular}
                        onMouseOver={(e) => {
                            if (!isDownloading) {
                                e.currentTarget.style.color = 'var(--text-main)';
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.07)';
                            }
                        }}
                        onMouseOut={(e) => {
                            if (!isDownloading) {
                                e.currentTarget.style.color = 'var(--text-dim)';
                                e.currentTarget.style.background = 'transparent';
                            }
                        }}
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                    </button>
                    {isDownloading && (
                        <div className="luniq-download-circle-spinner" />
                    )}
                </div>
            </div>

            <div className="artist-view-content">
                {}
                {topTracks.length > 0 && (
                    <div className="artist-top-tracks">
                        <h2 className="artist-section-title">{t('artist.popular')}</h2>
                        <div className="artist-tracks-list">
                            {topTracks.map((track: any, index: number) => (
                                <div 
                                    key={track.id} 
                                    className={`artist-track-row ${menuTrackId === track.id ? 'menu-open' : ''}`} 
                                    onClick={() => handleTrackPlay(track, index)}
                                    onContextMenu={(e) => handleTrackMenuClick(e, track)}
                                >
                                    <div className="artist-track-index">
                                        <span className="artist-track-index-text">{index + 1}</span>
                                        <div className="artist-track-play-icon" onClick={() => handleTrackPlay(track, index)}>
                                            <svg role="img" height="16" width="16" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M7.05 3.606l13.49 7.788a.7.7 0 010 1.212L7.05 20.394A.7.7 0 016 19.788V4.212a.7.7 0 011.05-.606z"></path>
                                            </svg>
                                        </div>
                                    </div>
                                    <div className="artist-track-info">
                                        {track.albumArt && <img src={track.albumArt} alt={track.name} className="artist-track-image" loading="lazy" />}
                                        <div className="artist-track-name" style={{ display: 'flex', alignItems: 'center' }}>
                                            {track.name}
                                            <DownloadIndicator trackId={track.id} />
                                        </div>
                                    </div>
                                    <div className="artist-track-row-actions" ref={menuTrackId === track.id ? trackMenuRef : null}>
                                        <button className="artist-track-action-btn" title="More options" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleTrackMenuClick(e, track); }}>
                                             <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                                <circle cx="12" cy="5" r="2" />
                                                <circle cx="12" cy="12" r="2" />
                                                <circle cx="12" cy="19" r="2" />
                                            </svg>
                                        </button>
                                        {menuTrackId === track.id && (
                                            <div 
                                                className={`luniq-dropdown ${menuPosition?.isBottom ? 'open-up' : 'open-down'}`}
                                                style={menuPosition ? {
                                                    position: 'fixed',
                                                    top: menuPosition.isBottom ? 'auto' : `${menuPosition.y + 8}px`,
                                                    bottom: menuPosition.isBottom ? `${window.innerHeight - menuPosition.y + 8}px` : 'auto',
                                                    right: `${window.innerWidth - menuPosition.x}px`,
                                                    left: 'auto',
                                                    zIndex: 9999
                                                } : {}}
                                            >
                                                <button className="luniq-dropdown-item" onClick={(e) => {
                                                    e.stopPropagation();
                                                    onPlayNext?.(track);
                                                    setMenuTrackId(null);
                                                    setMenuPosition(null);
                                                }}>
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M13 12H3M13 6H3M13 18H3" />
                                                        <path d="M17 8l5 4-5 4V8z" />
                                                    </svg>
                                                    {t('search.playNext')}
                                                </button>
                                                <button className="luniq-dropdown-item" onClick={(e) => {
                                                    e.stopPropagation();
                                                    onAddToQueue?.(track);
                                                    setMenuTrackId(null);
                                                    setMenuPosition(null);
                                                }}>
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
                                                    {t('search.addToQueue')}
                                                </button>
                                                <button className="luniq-dropdown-item" onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleToggleFavorite(track);
                                                    setMenuTrackId(null);
                                                    setMenuPosition(null);
                                                }}>
                                                    {menuFavoriteState ? (
                                                        <>
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                                                            </svg>
                                                            {t('search.removeFromFavorites')}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.84-8.84 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                                                            </svg>
                                                            {t('search.saveToFavorites')}
                                                        </>
                                                    )}
                                                </button>
                                                {menuDownloadState !== null && (
                                                    <button className="luniq-dropdown-item" onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleToggleDownload(track);
                                                        setMenuTrackId(null);
                                                        setMenuPosition(null);
                                                    }}>
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                            <polyline points="7 10 12 15 17 10"></polyline>
                                                            <line x1="12" y1="15" x2="12" y2="3"></line>
                                                        </svg>
                                                        {menuDownloadState ? t('search.removeDownload') : t('search.download')}
                                                    </button>
                                                )}
                                                <div className="luniq-dropdown-divider" />
                                                <button 
                                                    className={`luniq-dropdown-item ${showPlaylistSubmenu ? 'active' : ''}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setShowPlaylistSubmenu(!showPlaylistSubmenu);
                                                    }}
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M8 6h13M8 12h13M8 18h5" />
                                                        <path d="M3 6h.01M3 12h.01M3 18h.01" />
                                                        <path d="M16 18h6M19 15v6" />
                                                    </svg>
                                                    {t('search.addToLocalPlaylist')}
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
                                                                            handleTogglePlaylistTrack(p.id, track);
                                                                        }}
                                                                    >
                                                                        {p.name}
                                                                        {isInPlaylist && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ marginLeft: 'auto' }}><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                                                    </button>
                                                                );
                                                            })
                                                        ) : (
                                                            <div className="luniq-dropdown-item disabled" style={{ opacity: 0.5, cursor: 'default' }}>{t('search.noLocalPlaylists')}</div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ textAlign: 'right', color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                                        {track.durationMs > 0 ? formatDuration(track.durationMs) : '--:--'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {}
                {albums.length > 0 && (
                    <div className="artist-releases">
                        <h2 className="artist-section-title">{t('artist.albums')}</h2>
                        <div className="artist-releases-grid">
                            {albums.map((release: any) => (
                                <div
                                    key={release.id}
                                    className="artist-release-card"
                                    onClick={() => handleAlbumClick(release)}
                                >
                                    {release.images?.[0]?.url && (
                                        <img
                                            src={release.images[0].url}
                                            alt={release.name}
                                            className="artist-release-img"
                                            loading="lazy"
                                        />
                                    )}
                                    <div className="artist-release-info">
                                        <div className="artist-release-name" title={release.name}>{release.name}</div>
                                        <div className="artist-release-year">
                                            {release.year}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {}
                {singles.length > 0 && (
                    <div className="artist-releases">
                        <h2 className="artist-section-title">{t('artist.singlesAndEPs')}</h2>
                        <div className="artist-releases-grid">
                            {singles.map((release: any) => (
                                <div
                                    key={release.id}
                                    className="artist-release-card"
                                    onClick={() => handleAlbumClick(release)}
                                >
                                    {release.images?.[0]?.url && (
                                        <img
                                            src={release.images[0].url}
                                            alt={release.name}
                                            className="artist-release-img"
                                            loading="lazy"
                                        />
                                    )}
                                    <div className="artist-release-info">
                                        <div className="artist-release-name" title={release.name}>{release.name}</div>
                                        <div className="artist-release-year">
                                            {release.year}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {}
                {relatedArtists.length > 0 && (
                    <div className="artist-releases">
                        <h2 className="artist-section-title">{t('artist.relatedArtists')}</h2>
                        <div className="artist-releases-grid">
                            {relatedArtists.slice(0, 8).map((artist: any) => (
                                <div
                                    key={artist.id}
                                    className="artist-release-card artist-circle-card"
                                    onClick={() => handleArtistClick(artist.id)}
                                >
                                    {artist.image && (
                                        <img
                                            src={artist.image}
                                            alt={artist.name}
                                            className="artist-release-img circle"
                                            loading="lazy"
                                        />
                                    )}
                                    <div className="artist-release-info" style={{ textAlign: 'center' }}>
                                        <div className="artist-release-name">{artist.name}</div>
                                        <div className="artist-release-year">{t('searchView.artist')}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {}
                {bio && (
                    <div className="artist-about-section" style={{ padding: '24px' }}>
                        <h2 className="artist-section-title">{t('artist.about')}</h2>
                        <div className="artist-about-card">
                            <div className="artist-about-bg" style={{ backgroundImage: `url(${headerImage || visuals?.avatarImage?.sources?.[0]?.url || ARTIST_PLACEHOLDER})` }} />
                            <div className="artist-about-content">
                                <div className="artist-about-listeners">{formatMonthlyListeners(monthlyListeners)} {t('nowPlaying.monthlyListeners')}</div>
                                <div 
                                    className="artist-about-bio" 
                                    dangerouslySetInnerHTML={{ __html: bio }} 
                                    onClick={handleDescriptionClick}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ArtistView;
