
import React, { useState, useEffect, useRef } from 'react';
import './Downloads.css';
import ShuffleButton from '../Shuffle/ShuffleButton';
import ShuffleIcon from '../Icons/ShuffleIcon';
import { LuneTrack, normalizeTrack } from '../../types/track';
import { usePlayer } from '../../context/PlayerContext';
import { DownloadIndicator } from '../DownloadIndicator/DownloadIndicator';
import { useLanguage } from '../../context/LanguageContext';
import { usePlayback } from '../../context/PlaybackContext';
import { Virtuoso } from 'react-virtuoso';

interface DownloadsProps {
    onTrackSelect?: (track: LuneTrack, playlistTracks: LuneTrack[]) => void;
}

import { formatDuration } from '../../utils/format';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const Downloads: React.FC<DownloadsProps> = ({ onTrackSelect: _onTrackSelect }) => {
    const { handleTrackSelect, handleAddToQueue, handlePlayNext, currentTrack, isShuffle, setIsShuffle } = usePlayer();
    const { lowDataMode } = usePlayback();
    const { t } = useLanguage();
    const currentTrackId = currentTrack?.id;
    const [downloads, setDownloads] = useState<LuneTrack[]>([]);
    const [loading, setLoading] = useState(true);
    const [showMenu, setShowMenu] = useState(false);

    const [trackMenu, setTrackMenu] = useState<string | null>(null);
    const [menuPosition, setMenuPosition] = useState<{ x: number, y: number, isBottom: boolean } | null>(null);
    const [menuFavoriteState, setMenuFavoriteState] = useState<boolean>(false);
    const [localPlaylists, setLocalPlaylists] = useState<any[]>([]);
    const [trackPlaylists, setTrackPlaylists] = useState<string[]>([]);
    const [showPlaylistSubmenu, setShowPlaylistSubmenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const trackMenuRef = useRef<HTMLDivElement>(null);
    
    const [scrollParent, setScrollParent] = useState<HTMLElement | null>(null);
    const containerCallbackRef = React.useCallback((el: HTMLDivElement | null) => {
        setScrollParent(el);
    }, []);

    const fetchDownloads = async () => {
        setLoading(true);
        try {
            const localTracks = await window.ipcRenderer.invoke('get-downloads');
            setDownloads((localTracks || []).map((t: any) => normalizeTrack({
                id: t.id,
                name: t.name,
                artist: t.artist,
                albumName: t.albumName,
                albumArt: t.albumArt,
                durationMs: t.durationMs,
                downloadedAt: t.downloadedAt
            }, lowDataMode)));
        } catch (error) {
            console.error("Failed to load downloads", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDownloads();

        const handleUpdate = () => fetchDownloads();
        
        // Listen for internal app events
        window.addEventListener('lune:download-update', handleUpdate);
        
        // Listen for window focus to catch any changes while app was backgrounded
        window.addEventListener('focus', handleUpdate);
        
        const ipc = window.ipcRenderer;
        if (ipc) {
            ipc.on('lune:download-status-changed', handleUpdate);
        }

        return () => {
            window.removeEventListener('lune:download-update', handleUpdate);
            window.removeEventListener('focus', handleUpdate);
            if (ipc) {
                ipc.off('lune:download-status-changed', handleUpdate);
            }
        };
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (showMenu && menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowMenu(false);
            }
            if (trackMenu && trackMenuRef.current && !trackMenuRef.current.contains(event.target as Node) && !(event.target as HTMLElement).closest('.lune-dropdown')) {
                setTrackMenu(null);
                setMenuPosition(null);
                setShowPlaylistSubmenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showMenu, trackMenu]);

    const handleTrackMenuClick = async (e: React.MouseEvent, track: LuneTrack) => {
        e.stopPropagation();
        if (trackMenu === track.id) {
            setTrackMenu(null);
            setMenuPosition(null);
            setShowPlaylistSubmenu(false);
        } else {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const menuHeight = 300;
            const isBottom = spaceBelow < menuHeight;
            
            setMenuPosition({ 
                x: rect.right, 
                y: isBottom ? rect.top : rect.bottom,
                isBottom 
            });
            setTrackMenu(track.id);
            
            // Fetch states
            try {
                const [isFav, playlists, trackLists] = await Promise.all([
                    window.ipcRenderer.invoke('check-local-favorite', track.id),
                    window.ipcRenderer.invoke('get-playlists'),
                    window.ipcRenderer.invoke('get-track-playlists', track.id)
                ]);
                setMenuFavoriteState(isFav);
                setLocalPlaylists(playlists);
                setTrackPlaylists(trackLists);
            } catch (err) {
                console.error("Failed to load menu states", err);
            }
        }
    };

    const handleToggleFavorite = async (track: LuneTrack) => {
        try {
            if (menuFavoriteState) {
                await window.ipcRenderer.invoke('remove-local-favorite', track.id);
                setMenuFavoriteState(false);
            } else {
                await window.ipcRenderer.invoke('add-local-favorite', track);
                setMenuFavoriteState(true);
            }
            window.dispatchEvent(new Event('lune:playlist-update'));
        } catch (e) {
            console.error("Failed to toggle favorite", e);
        }
    };

    const handleTogglePlaylistTrack = async (playlistId: string, track: LuneTrack) => {
        try {
            const isInPlaylist = trackPlaylists.includes(playlistId);
            if (isInPlaylist) {
                await window.ipcRenderer.invoke('remove-track-from-playlist', { playlistId, trackId: track.id });
                setTrackPlaylists(prev => prev.filter(id => id !== playlistId));
            } else {
                await window.ipcRenderer.invoke('add-track-to-playlist', { playlistId, track });
                setTrackPlaylists(prev => [...prev, playlistId]);
            }
            window.dispatchEvent(new Event('lune:playlist-update'));
        } catch (e) {
            console.error("Failed to toggle playlist track", e);
        }
    };

    const handleShufflePlay = () => {
        if (!downloads.length) return;
        setIsShuffle(true);
        const shuffled = [...downloads].sort(() => Math.random() - 0.5);
        handleTrackSelect(shuffled[0], shuffled); // pass full array so every song is in the loop context
        setShowMenu(false);
    };


    const handleRemoveTrack = async (id: string) => {
        try {
            const success = await window.ipcRenderer.invoke('remove-download', id);
            if (success) {
                fetchDownloads();
                window.dispatchEvent(new Event('lune:download-update'));
            }
        } catch (err) {
            console.error("Failed to remove download", err);
        }
    };


    return (
        <div className="downloads-container" ref={containerCallbackRef}>
            <div className="downloads-hero">
                <div
                    className="downloads-cover playlist-bg downloads-bg"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '220px',
                        minHeight: '220px',
                    }}
                >
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                </div>
                <div className="downloads-info">
                    <span className="downloads-type">{t('downloads.playlist')}</span>
                    <h1 className="downloads-title">{t('downloads.downloads')}</h1>
                    <div className="downloads-meta">
                        <b>{t('downloads.you')}</b>
                        <span>• {downloads.length} {t('downloads.songs')}</span>
                    </div>
                </div>
            </div>

            <div className="downloads-actions">
                <button 
                    className="play-all-btn" 
                    title={t('downloads.playAll')}
                    onClick={() => downloads.length > 0 && handleTrackSelect(downloads[0], downloads)}
                >
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M7.05 3.606l13.49 7.788a.7.7 0 010 1.212L7.05 20.394A.7.7 0 016 19.788V4.212a.7.7 0 011.05-.606z" />
                    </svg>
                </button>
                
                <ShuffleButton isShuffle={isShuffle} onToggle={() => setIsShuffle(!isShuffle)} className="playlist-dots-btn" size={24} />

                <div className="downloads-menu-wrapper" ref={menuRef}>
                    <button
                        className="playlist-dots-btn"
                        title={t('downloads.moreOptions')}
                        onClick={() => setShowMenu(!showMenu)}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="5" r="2" />
                            <circle cx="12" cy="12" r="2" />
                            <circle cx="12" cy="19" r="2" />
                        </svg>
                    </button>
                    {showMenu && (
                        <div className="lune-dropdown open-down" style={{ top: '100%', left: '0', bottom: 'auto', right: 'auto', marginTop: '8px' }} onClick={() => setShowMenu(false)}>
                            <button className="lune-dropdown-item" onClick={handleShufflePlay}>
                                <ShuffleIcon size={14} />
                                {t('downloads.shufflePlay')}
                            </button>
                            <button className="lune-dropdown-item" onClick={() => { if (downloads.length > 0) handleAddToQueue(downloads); setShowMenu(false); }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
                                {t('downloads.addAllToQueue')}
                            </button>
                            <button className="lune-dropdown-item" onClick={() => { if (downloads.length > 0) handlePlayNext(downloads); setShowMenu(false); }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M13 12H3M13 6H3M13 18H3" />
                                    <path d="M17 8l5 4-5 4V8z" />
                                </svg>
                                {t('downloads.playNext')}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="track-list">
                <div className="track-row header">
                    <div className="track-index">#</div>
                    <div className="track-title-col">{t('downloads.title')}</div>
                    <div className="track-album">{t('downloads.album')}</div>
                    <div className="track-date">{t('downloads.downloaded')}</div>
                    <div style={{ width: '40px' }}></div>
                    <div className="track-duration">
                        <svg role="img" height="16" width="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8z"></path>
                            <path d="M8 3.25a.75.75 0 0 1 .75.75v3.25H11a.75.75 0 0 1 0 1.5H7.25V4A.75.75 0 0 1 8 3.25z"></path>
                        </svg>
                    </div>
                </div>

                {loading ? (
                    <div className="lune-loading-container" style={{ padding: '60px 0' }}>
                        <div className="lune-loading-animation" style={{ transform: 'scale(1.5)' }}>
                            <div className="bar bar1"></div>
                            <div className="bar bar2"></div>
                            <div className="bar bar3"></div>
                        </div>
                        <span style={{ marginTop: '24px', fontWeight: 500, letterSpacing: '0.5px', opacity: 0.6 }}>{t('downloads.loadingDownloads')}</span>
                    </div>
                ) : downloads.length === 0 ? (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '60px 20px',
                        color: 'rgba(255,255,255,0.3)',
                        gap: '12px',
                    }}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                            <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                        </svg>
                        <span style={{ fontSize: '14px', fontWeight: 500 }}>{t('downloads.noDownloads')}</span>
                        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.15)' }}>{t('downloads.downloadHint')}</span>
                    </div>
                ) : (
                    scrollParent && (
                    <Virtuoso
                        customScrollParent={scrollParent}
                        data={downloads}
                        overscan={400}
                        useWindowScroll={false}
                        itemContent={(index, track) => {
                            const isActive = currentTrackId === track.id;
                            return (
                                <div 
                                    className={`track-row ${isActive ? 'active' : ''} ${trackMenu === track.id ? 'menu-open' : ''}`}
                                    onClick={() => handleTrackSelect(track, downloads)}
                                    // Make sure Virtuoso elements have a defined height or class
                                >
                                <div className="track-index">{index + 1}</div>
                                <div className="track-title-col">
                                    <img src={track.albumArt || 'placeholder.png'} alt="" className="track-img" loading="lazy" />
                                    <div className="track-info">
                                        <div className="track-name" style={{ display: 'flex', alignItems: 'center' }}>
                                            {track.name}
                                            <DownloadIndicator trackId={track.id} />
                                        </div>
                                        <div className="track-artist">{track.artist}</div>
                                    </div>
                                </div>
                                <div className="track-album">{track.albumName}</div>
                                <div className="track-date">{track.downloadedAt ? new Date(track.downloadedAt).toLocaleDateString() : t('downloads.unknown')}</div>
                                <div className="track-context-menu" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} ref={trackMenu === track.id ? trackMenuRef : null}>
                                    <button className="track-dots-btn" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleTrackMenuClick(e, track); }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                            <circle cx="12" cy="5" r="2" />
                                            <circle cx="12" cy="12" r="2" />
                                            <circle cx="12" cy="19" r="2" />
                                        </svg>
                                    </button>
                                </div>
                                <div className="track-duration">{formatDuration(track.durationMs)}</div>
                            </div>
                            );
                        }}
                    />
                    )
                )}
                
                {trackMenu && (
                    <div 
                        className={`lune-dropdown ${menuPosition?.isBottom ? 'open-up' : 'open-down'}`}
                        style={menuPosition ? {
                            position: 'fixed',
                            top: menuPosition.isBottom ? 'auto' : `${menuPosition.y + 8}px`,
                            bottom: menuPosition.isBottom ? `${window.innerHeight - menuPosition.y + 8}px` : 'auto',
                            right: `${window.innerWidth - menuPosition.x}px`,
                            left: 'auto',
                            zIndex: 9999
                        } : {}}
                        ref={trackMenuRef}
                    >
                        {/* We need the track context for the menu... so we pass the track ID from trackMenu back to the downloads array */}
                        {(() => {
                            const track = downloads.find(t => t.id === trackMenu);
                            if (!track) return null;
                            return (
                                <>
                                    <button className="lune-dropdown-item" onClick={() => { handlePlayNext(track); setTrackMenu(null); }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M13 12H3M13 6H3M13 18H3" />
                                            <path d="M17 8l5 4-5 4V8z" />
                                        </svg>
                                        {t('downloads.playNext')}
                                    </button>
                                    <button className="lune-dropdown-item" onClick={() => { handleAddToQueue(track); setTrackMenu(null); }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
                                        {t('downloads.addToQueue')}
                                    </button>
                                    <button className="lune-dropdown-item" onClick={() => { handleToggleFavorite(track); setTrackMenu(null); }}>
                                        {menuFavoriteState ? (
                                            <><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg> {t('downloads.removeFavorites')}</>
                                        ) : (
                                            <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.84-8.84 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg> {t('downloads.saveToFavorites')}</>
                                        )}
                                    </button>
                                    <div className="lune-dropdown-divider" />
                                    <button 
                                        className={`lune-dropdown-item ${showPlaylistSubmenu ? 'active' : ''}`}
                                        onClick={() => setShowPlaylistSubmenu(!showPlaylistSubmenu)}
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M8 6h13M8 12h13M8 18h5" />
                                            <path d="M3 6h.01M3 12h.01M3 18h.01" />
                                            <path d="M16 18h6M19 15v6" />
                                        </svg>
                                        {t('downloads.addToLocalPlaylist')}
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
                                                                handleTogglePlaylistTrack(p.id, track);
                                                            }}
                                                        >
                                                            {p.name}
                                                            {isInPlaylist && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ marginLeft: 'auto' }}><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                                        </button>
                                                    );
                                                })
                                            ) : (
                                                <div className="lune-dropdown-item disabled" style={{ opacity: 0.5, cursor: 'default' }}>{t('downloads.noLocalPlaylists')}</div>
                                            )}
                                        </div>
                                    )}
                                    <div className="lune-dropdown-divider" />
                                    <button className="lune-dropdown-item danger" onClick={() => handleRemoveTrack(track.id)}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                                        {t('downloads.removeDownload')}
                                    </button>
                                </>
                            );
                        })()}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Downloads;
