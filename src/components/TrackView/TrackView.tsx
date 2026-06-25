
import React, { useEffect, useState, useRef } from 'react';
import './TrackView.css';
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
import { normalizeTrack } from '../../types/track';
import { DownloadIndicator } from '../DownloadIndicator/DownloadIndicator';
import { formatDuration } from '../../utils/format';
import { usePlayback } from '../../context/PlaybackContext';

interface TrackViewProps {
    accessToken: string;
    cookies: PlatformCookie[];
    trackId: string;
    trackName?: string;
    trackImage?: string;
    trackArtists?: string[];
    onBack: () => void;
    onHome?: () => void;
    onPlaylistSelect?: (id: string, isAlbum?: boolean) => void;
    onArtistSelect?: (id: string) => void;
}

const TrackView: React.FC<TrackViewProps> = ({
    accessToken: _accessToken,
    cookies: _cookies,
    trackId,
    trackName,
    trackImage,
    trackArtists,
    onBack,
    onHome,
    onPlaylistSelect,
    onArtistSelect,
}) => {
    const { 
        handleTrackSelect: onTrackSelect, 
        handleAddToQueue: onAddToQueue,
        handlePlayNext: onPlayNext 
    } = usePlayer();
    const { lowDataMode } = usePlayback();
    const { t } = useLanguage();
    const [trackData, setTrackData] = useState<any>(null);
    const [artistAlbums, setArtistAlbums] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showMenu, setShowMenu] = useState(false);
    const [menuFavoriteState, setMenuFavoriteState] = useState<boolean | null>(null);
    const [menuDownloadState, setMenuDownloadState] = useState<boolean | null>(null);
    const [localPlaylists, setLocalPlaylists] = useState<any[]>([]);
    const [trackPlaylists, setTrackPlaylists] = useState<string[]>([]);
    const [showPlaylistSubmenu, setShowPlaylistSubmenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const api = useApi();

    useEffect(() => {
        const fetchTrackDetails = async () => {
            try {
                setLoading(true);
                setError(null);
                setArtistAlbums([]); 

                
                const data = await api.track.getTrack(trackId);

                if (data) {
                    setTrackData(data);

                    
                    const firstArtistUri = data.firstArtist?.items?.[0]?.uri
                        || data.artists?.items?.[0]?.uri;
                    if (firstArtistUri) {
                        const artistId = firstArtistUri.split(':').pop();
                        try {
                            const artistData = await api.artist.getArtist(artistId);

                            
                            const albums = artistData?.discography?.albums?.items
                                ?.map((item: any) => {
                                    const release = item.releases?.items?.[0];
                                    if (!release) return null;
                                    return {
                                        id: release.uri?.split(':').pop(),
                                        name: release.name,
                                        uri: release.uri,
                                        year: release.date?.year,
                                        images: release.coverArt?.sources || [],
                                        type: release.type || 'Album',
                                    };
                                })
                                .filter(Boolean)
                                .slice(0, 7) || [];

                            
                            const singles = artistData?.discography?.singles?.items
                                ?.map((item: any) => {
                                    const release = item.releases?.items?.[0];
                                    if (!release) return null;
                                    return {
                                        id: release.uri?.split(':').pop(),
                                        name: release.name,
                                        uri: release.uri,
                                        year: release.date?.year,
                                        images: release.coverArt?.sources || [],
                                        type: 'Single',
                                    };
                                })
                                .filter(Boolean)
                                .slice(0, 7) || [];

                            setArtistAlbums([...albums, ...singles].slice(0, 7));
                        } catch (err) {
                            console.error('[TrackView] Failed to fetch artist data:', err);
                        }
                    }
                }
            } catch (err: any) {
                console.error('[TrackView] Failed to fetch track:', err);
                setError(err.message || 'Failed to load track details');
            } finally {
                setLoading(false);
            }
        };

        if (trackId) {
            fetchTrackDetails();
        }
    }, [trackId, api]);

    
    const coverUrl = trackData?.albumOfTrack?.coverArt?.sources?.[0]?.url
        || trackData?.album?.coverArt?.sources?.[0]?.url
        || trackImage || '';

    const title = trackData?.name || trackName || 'Unknown Track';

    const artistsData = trackData?.firstArtist?.items || trackData?.artists?.items || [];
    const artistObjects = artistsData.length > 0
        ? artistsData.map((a: any) => ({ name: a.profile?.name || '', id: a.uri?.split(':').pop() || '' }))
        : (trackArtists || []).map(name => ({ name, id: '' }));
    
                                                        
    const artistNames = artistObjects.map((a: any) => a.name).filter(Boolean);

    const albumType = trackData?.albumOfTrack?.albumType
        || trackData?.album?.albumType || 'Single';

    const releaseDate = trackData?.albumOfTrack?.date?.isoString
        || trackData?.album?.date?.isoString || '';

    const releaseYear = releaseDate ? new Date(releaseDate).getFullYear() : '';

    const durationMs = trackData?.duration?.totalMilliseconds
        || trackData?.trackDuration?.totalMilliseconds || 0;


    const formatDurationLong = (ms: number) => {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        if (minutes === 0) return `${seconds} ${t('trackView.sec')}`;
        return `${minutes} ${t('trackView.min')} ${seconds} ${t('trackView.sec')}`;
    };

    const formatReleaseDate = (dateStr: string) => {
        if (!dateStr) return '';
        try {
            return new Date(dateStr).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });
        } catch {
            return dateStr;
        }
    };

    const handlePlay = () => {
        if (onTrackSelect && trackData) {
            onTrackSelect(normalizeTrack(trackData, lowDataMode), []);
        }
    };

    const handleAlbumClick = (album: any) => {
        if (onPlaylistSelect && album.id) {
            onPlaylistSelect(album.id, true);
        }
    };

    const handleToggleFavorite = async (track: any) => {
        try {
            const trackIdToUse = track.trackId || track.id;
            const isLiked = await window.ipcRenderer.invoke('check-local-favorite', trackIdToUse);
            let success;
            if (isLiked) {
                success = await window.ipcRenderer.invoke('remove-local-favorite', trackIdToUse);
            } else {
                success = await window.ipcRenderer.invoke('add-local-favorite', normalizeTrack(track, lowDataMode));
            }
            if (success) {
                setMenuFavoriteState(!isLiked);
                                                                      
                window.dispatchEvent(new Event('lune:playlist-update'));
            }
        } catch (e) {
            console.error("Failed to toggle favorite:", e);
        }
    };

    const handleMenuClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!showMenu) {
                                                   
            const liked = await window.ipcRenderer.invoke('check-local-favorite', trackId);
            setMenuFavoriteState(liked);
            
            const isDownloaded = await window.ipcRenderer.invoke('check-is-downloaded', trackId);
            setMenuDownloadState(isDownloaded);

                                   
            const playlists = await window.ipcRenderer.invoke('get-playlists');
            setLocalPlaylists(playlists);

                                                     
            const inPlaylists = await window.ipcRenderer.invoke('get-track-playlists', trackId);
            setTrackPlaylists(inPlaylists);
        } else {
            setShowPlaylistSubmenu(false);
        }
        setShowMenu(!showMenu);
    };

    const handleToggleDownload = async (track: any) => {
        try {
            const trackIdToUse = track.trackId || track.id;
            const success = menuDownloadState
                ? await window.ipcRenderer.invoke('remove-download', trackIdToUse)
                : await window.ipcRenderer.invoke('download-track', normalizeTrack({ ...track, id: trackIdToUse }, lowDataMode));

            if (success !== false) { // Sometimes remove-download might not return strict true
                setMenuDownloadState(!menuDownloadState);
                window.dispatchEvent(new Event('lune:download-update'));
            }
        } catch (e) {
            console.error("Failed to toggle download:", e);
        }
    };

    const handleTogglePlaylistTrack = async (pId: string) => {
        try {
            const isAlreadyIn = trackPlaylists.includes(pId);
            let success;
            if (isAlreadyIn) {
                success = await window.ipcRenderer.invoke('remove-track-from-playlist', {
                    playlistId: pId,
                    trackId
                });
            } else {
                const track = {
                    id: trackId,
                    name: title,
                    artists: artistNames,
                    albumArt: coverUrl,
                    durationMs
                };
                success = await window.ipcRenderer.invoke('add-track-to-playlist', {
                    playlistId: pId,
                    track
                });
            }
            if (success) {
                window.dispatchEvent(new Event('lune:playlist-tracks-update'));
                                                          
                const updatedPlaylists = await window.ipcRenderer.invoke('get-track-playlists', trackId);
                setTrackPlaylists(updatedPlaylists);
            }
        } catch (err) {
            console.error('Failed to toggle track in playlist:', err);
        }
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (showMenu && menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowMenu(false);
                setShowPlaylistSubmenu(false);
            }
        };

        if (showMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showMenu]);

    if (loading) {
        return (
            <div className="track-view-container">
                <div className="lune-loading-container">
                    <div className="lune-loading-animation">
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
            <div className="track-view-container">
                <div className="track-view-error">
                    <h2>{t('error.title')}</h2>
                    <p style={{ color: 'var(--text-dim)' }}>{error}</p>
                <div className="lune-nav-btn-container">
                    <button onClick={onBack} className="lune-nav-btn" title="Back">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    </button>
                    {onHome && (
                        <button onClick={onHome} className="lune-nav-btn" title="Home">
                            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
                        </button>
                    )}
                </div>
                </div>
            </div>
        );
    }

    return (
        <div className="track-view-container">

            {/* Hero */}
            <div className="track-view-hero">

                {coverUrl && (
                    <img src={coverUrl} alt={title} className="track-view-cover" />
                )}

                <div className="track-view-info">
                    <span className="track-view-type">{albumType}</span>
                    <h1 className="track-view-title">{title}</h1>
                    <div className="track-view-meta">
                        <b>
                            {artistObjects.map((artist: any, index: number) => (
                                <React.Fragment key={index}>
                                    {artist.id ? (
                                        <span onClick={() => onArtistSelect?.(artist.id)} style={{ cursor: 'pointer', textDecoration: 'none' }} className="track-view-artist-link"
                                              onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                              onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
                                        >
                                            {artist.name}
                                        </span>
                                    ) : (
                                        <span>{artist.name}</span>
                                    )}
                                    {index < artistObjects.length - 1 && ', '}
                                </React.Fragment>
                            ))}
                            {artistObjects.length === 0 && 'Unknown Artist'}
                        </b>
                        {releaseYear && <><span>•</span><span>{releaseYear}</span></>}
                        {durationMs > 0 && <><span>•</span><span>1 {t('trackView.song')}, {formatDurationLong(durationMs)}</span></>}
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="track-view-actions">
                <button className="track-view-play-btn" onClick={handlePlay} title="Play">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M7.05 3.606l13.49 7.788a.7.7 0 010 1.212L7.05 20.394A.7.7 0 016 19.788V4.212a.7.7 0 011.05-.606z" />
                    </svg>
                </button>
            </div>

            {/* Track Row */}
            <div className="track-view-list">
                <div className="track-view-row header">
                    <div style={{ textAlign: 'center' }}>#</div>
                    <div>{t('trackView.title')}</div>
                    <div></div>
                    <div style={{ textAlign: 'right' }}>
                        <svg role="img" height="16" width="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8z"></path>
                            <path d="M8 3.25a.75.75 0 0 1 .75.75v3.25H11a.75.75 0 0 1 0 1.5H7.25V4A.75.75 0 0 1 8 3.25z"></path>
                        </svg>
                    </div>
                </div>

                <div className="track-view-row" onClick={handlePlay}>
                    <div style={{ textAlign: 'center', color: 'var(--text-dim)' }}>1</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', overflow: 'hidden' }}>
                        {coverUrl && (
                            <img src={coverUrl} alt={title} style={{
                                width: '40px', height: '40px', borderRadius: '4px', objectFit: 'cover', minWidth: '40px'
                            }} />
                        )}
                        <div style={{ overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-main)', fontWeight: 500, fontSize: '15px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {title}
                                <DownloadIndicator trackId={trackId} />
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', gap: '4px' }}>
                                {artistObjects.map((artist: any, i: number) => (
                                    <React.Fragment key={(artist.id || artist.name) + i}>
                                        <span 
                                            onClick={(e) => {
                                                if (onArtistSelect) {
                                                    e.stopPropagation();
                                                    onArtistSelect(artist.id || artist.name);
                                                }
                                            }}
                                            style={{ cursor: onArtistSelect ? 'pointer' : 'default' }}
                                            onMouseOver={(e) => { if (onArtistSelect) e.currentTarget.style.textDecoration = 'underline'; }}
                                            onMouseOut={(e) => { if (onArtistSelect) e.currentTarget.style.textDecoration = 'none'; }}
                                        >
                                            {artist.name}
                                        </span>
                                        {i < artistObjects.length - 1 && <span>,</span>}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="track-view-row-actions" style={{ position: 'relative' }} ref={menuRef}>
                        <button className="track-view-row-icon-btn" title="More options" onClick={handleMenuClick} style={{ opacity: showMenu ? 1 : undefined }}>
                             <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <circle cx="12" cy="5" r="2" />
                                <circle cx="12" cy="12" r="2" />
                                <circle cx="12" cy="19" r="2" />
                            </svg>
                        </button>
                        {showMenu && (
                            <div className="lune-dropdown">
                                <button className="lune-dropdown-item" onClick={(e) => {
                                    e.stopPropagation();
                                    onPlayNext?.(normalizeTrack(trackData, lowDataMode));
                                    setShowMenu(false);
                                }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M13 12H3M13 6H3M13 18H3" />
                                        <path d="M17 8l5 4-5 4V8z" />
                                    </svg>
                                    {t('search.playNext')}
                                </button>
                                <button className="lune-dropdown-item" onClick={(e) => {
                                    e.stopPropagation();
                                    onAddToQueue?.(normalizeTrack(trackData, lowDataMode));
                                    setShowMenu(false);
                                }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
                                    {t('search.addToQueue')}
                                </button>
                                {menuFavoriteState !== null && (
                                    <button className="lune-dropdown-item" onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleFavorite({ id: trackId, name: title, artists: artistNames, albumArt: coverUrl, durationMs });
                                        setShowMenu(false);
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
                                        )}
                                        {menuDownloadState !== null && (
                                            <button className="lune-dropdown-item" onClick={(e) => {
                                                e.stopPropagation();
                                                handleToggleDownload({ id: trackId, name: title, artists: artistNames, albumArt: coverUrl, durationMs });
                                                setShowMenu(false);
                                            }}>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                    <polyline points="7 10 12 15 17 10"></polyline>
                                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                                </svg>
                                                {menuDownloadState ? t('search.removeDownload') : t('search.download')}
                                            </button>
                                        )}
                                        <div className="lune-dropdown-divider" />
                                        <button 
                                            className={`lune-dropdown-item ${showPlaylistSubmenu ? 'active' : ''}`}
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
                                            <div className="lune-submenu">
                                                {localPlaylists.length > 0 ? (
                                                    localPlaylists.map((p) => {
                                                        const isInPlaylist = trackPlaylists.includes(p.id);
                                                        return (
                                                            <button 
                                                                key={p.id} 
                                                                className={`lune-dropdown-item ${isInPlaylist ? 'active' : ''}`}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleTogglePlaylistTrack(p.id);
                                                                }}
                                                            >
                                                                {p.name}
                                                                {isInPlaylist && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ marginLeft: 'auto' }}><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                                            </button>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="lune-dropdown-item disabled" style={{ opacity: 0.5, cursor: 'default' }}>{t('search.noLocalPlaylists')}</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                    <div style={{ textAlign: 'right', color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                        {durationMs > 0 ? formatDuration(durationMs) : '--:--'}
                    </div>
                </div>
            </div>

            {}
            {releaseDate && (
                <div className="track-view-release-info">
                    <div className="track-view-release-date">{formatReleaseDate(releaseDate)}</div>
                    {trackData?.albumOfTrack?.copyright?.items?.map((c: any, i: number) => (
                        <div key={i} className="track-view-copyright">{c.text || c.type}</div>
                    ))}
                </div>
            )}

            {}
            {artistAlbums.length > 0 && artistObjects.length > 0 && (
                <div className="track-view-more">
                    <div className="track-view-more-header">
                        <h2 className="track-view-more-title">{t('trackView.moreBy')} {artistObjects[0].name}</h2>
                    </div>
                    <div className="track-view-more-grid">
                        {artistAlbums.map((album) => (
                            <div
                                key={album.id}
                                className="track-view-album-card"
                                onClick={() => handleAlbumClick(album)}
                            >
                                {album.images?.[0]?.url && (
                                    <img
                                        src={album.images[0].url}
                                        alt={album.name}
                                        className="track-view-album-img"
                                        loading="lazy"
                                    />
                                )}
                                <div className="track-view-album-name">{album.name}</div>
                                <div className="track-view-album-year">
                                    {album.year} • {album.type}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TrackView;
