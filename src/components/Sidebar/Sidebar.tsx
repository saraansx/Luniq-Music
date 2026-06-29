
import React, { useEffect, useState, useRef, useCallback } from 'react';
import './Sidebar.css';
import { useApi } from '../../context/ApiContext';

import type { GqlPlaylistSimplified } from '../../../Plugin/gql/types/gql-api';

import type { Album, Artist } from '../../../Plugin/gql/types/web-api';
import CreatePlaylistModal from '../CreatePlaylist/CreatePlaylistModal';
import { useLanguage } from '../../context/LanguageContext';

interface LocalPlaylist {
    id: string;
    name: string;
    description: string;
    artwork: string | null;
    createdAt: number;
}

interface SidebarProps {
    accessToken: string | null;
    cookies: any[];
    onPlaylistSelect: (id: string, isAlbum?: boolean) => void;
    onArtistSelect?: (id: string) => void;
    onAddToQueue?: (tracks: any[]) => void;
    isOnline: boolean;
}

type FilterType = 'Playlists' | 'Albums' | 'Artists' | 'Local' | 'Downloads';

const Sidebar: React.FC<SidebarProps> = ({ accessToken: _accessToken, cookies, onPlaylistSelect, onArtistSelect, isOnline }) => {
    const { t } = useLanguage();
    const [items, setItems] = useState<(GqlPlaylistSimplified | Album | Artist)[]>([]);
    const [activeFilter, setActiveFilter] = useState<FilterType>('Playlists');
    const [loading, setLoading] = useState(isOnline);
    const [error, setError] = useState<string | null>(null);
    const [isCollapsed, setIsCollapsed] = useState(false);

    const [localPlaylists, setLocalPlaylists] = useState<LocalPlaylist[]>([]);
    const [savedLibrary, setSavedLibrary] = useState<any[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [createTarget, setCreateTarget] = useState<'local' | 'spotify'>('local');
    
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const sentinelRef = useRef<HTMLDivElement>(null);

    
    useEffect(() => {
        if (!isOnline) {
            setActiveFilter('Local');
            setLoading(false);
            setItems([]); 
        } else {
            setLoading(true);
        }
    }, [isOnline]);

    const api = useApi();

    const fetchLocalPlaylists = async () => {
        try {
            const playlists = await window.ipcRenderer.invoke('get-playlists');
            setLocalPlaylists(playlists || []);
        } catch (e) {
            console.error("Failed to fetch local playlists:", e);
        }
    };

    const fetchSavedLibrary = async () => {
        try {
            const saved = await window.ipcRenderer.invoke('get-saved-library');
            setSavedLibrary(saved || []);
        } catch (e) {
            console.error("Failed to fetch saved library:", e);
        }
    };

    const fetchLibrary = useCallback(async (isMore = false) => {
        if (!api || !cookies || !isOnline) return;
        if (isMore && (!hasMore || isLoadingMore)) return;
        
        try {
            if (isMore) setIsLoadingMore(true);
            else {
                setLoading(true);
                setOffset(0);
                setHasMore(true);
            }
            setError(null);
            
            let data: any[] = [];
            let total = 0;
            const currentOffset = isMore ? offset : 0;
            const limit = 50;

            if (activeFilter === 'Playlists') {
                const res = await api.user.savedPlaylists({ limit, offset: currentOffset });
                data = res.items;
                total = res.total;
            } else if (activeFilter === 'Albums') {
                const res = await api.user.savedAlbums({ limit, offset: currentOffset });
                data = res.items;
                total = res.total;
            } else if (activeFilter === 'Artists') {
                const res = await api.user.savedArtists({ limit, offset: currentOffset });
                data = res.items;
                total = res.total;
            } else if (activeFilter === 'Local') {
                data = []; 
                total = 0;
                setHasMore(false);
            }

            if (isMore) {
                setItems(prev => {
                    const existingIds = new Set(prev.map(i => i.id));
                    const uniqueNew = data.filter(i => !existingIds.has(i.id));
                    return [...prev, ...uniqueNew];
                });
                setOffset(prev => prev + data.length);
            } else {
                
                const seen = new Set<string>();
                const unique = data.filter(i => {
                    if (seen.has(i.id)) return false;
                    seen.add(i.id);
                    return true;
                });
                setItems(unique);
                setOffset(data.length);
            }
            
            
            setHasMore(data.length > 0 && (isMore ? offset + data.length : data.length) < total);

        } catch (err: any) {
            console.error("Failed to load sidebar content:", err);
            setError(t('sidebar.couldNotLoad'));
        } finally {
            setLoading(false);
            setIsLoadingMore(false);
        }
    }, [api, cookies, activeFilter, isOnline, hasMore, isLoadingMore, offset]);

    useEffect(() => {
        fetchLibrary(false);
    }, [activeFilter, isOnline, api]);

    
    useEffect(() => {
        if (!hasMore || loading || isLoadingMore) return;

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                fetchLibrary(true);
            }
        }, { threshold: 0.1 });

        const currentSentinel = sentinelRef.current;
        if (currentSentinel) {
            observer.observe(currentSentinel);
        }

        return () => {
            if (currentSentinel) {
                observer.unobserve(currentSentinel);
            }
        };
    }, [hasMore, loading, isLoadingMore, fetchLibrary]);

    useEffect(() => {
        fetchLocalPlaylists();
        fetchSavedLibrary();

        const handlePlaylistUpdate = () => {
             fetchLocalPlaylists();
             fetchLibrary(false);
        };

        const handleLibraryUpdate = () => {
            fetchSavedLibrary();
        };

        window.addEventListener('lune:playlist-update', handlePlaylistUpdate);
        window.addEventListener('lune:library-update', handleLibraryUpdate);
        return () => {
            window.removeEventListener('lune:playlist-update', handlePlaylistUpdate);
            window.removeEventListener('lune:library-update', handleLibraryUpdate);
        };
    }, [api, cookies, activeFilter]);

    const handleAddClick = () => {
        setShowAddMenu(prev => !prev);
    };

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.sidebar-actions')) {
                setShowAddMenu(false);
            }
        };
        if (showAddMenu) {
            document.addEventListener('click', handleClickOutside);
        }
        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, [showAddMenu]);

    const handleCreatePlaylist = async (playlist: { name: string; description: string; artwork: string | null }) => {
        try {
            if (createTarget === 'local') {
                const newPlaylist = await window.ipcRenderer.invoke('create-playlist', playlist);
                if (newPlaylist && newPlaylist.id) {
                    setLocalPlaylists(prev => [newPlaylist, ...prev]);
                    setShowCreateModal(false);
                }
            } else {
                const newPlaylist = await api.playlist.create({
                    name: playlist.name,
                    description: playlist.description
                });
                if (newPlaylist && newPlaylist.uri) {
                    fetchLibrary(false);
                    setShowCreateModal(false);
                }
            }
        } catch (error) {
            console.error("Failed to create playlist:", error);
        }
    };

    const handleItemClick = (item: GqlPlaylistSimplified | Album | Artist) => {
        if (activeFilter === 'Playlists') {
            onPlaylistSelect(item.id);
        } else if (activeFilter === 'Albums' || activeFilter === 'Local') {
            onPlaylistSelect(item.id, true);
        } else {
            onArtistSelect?.(item.id);
        }
    };



    const getImageUrl = (item: GqlPlaylistSimplified | Album | Artist) => {
        if ('images' in item && Array.isArray(item.images) && item.images.length > 0) {
            return item.images[0].url;
        }
        return 'placeholder.png';
    };

    const getSubtitle = (item: GqlPlaylistSimplified | Album | Artist) => {
        if (activeFilter === 'Playlists') {
            const pl = item as GqlPlaylistSimplified;
            return `Playlist • ${pl.owner?.display_name || 'Spotify'}`;
        } else if (activeFilter === 'Albums' || activeFilter === 'Local') {
            const al = item as Album;
            return `${t('home.album')} • ${al.artists?.[0]?.name || t('home.artist')}`;
        } else {
            return t('home.artist');
        }
    };

    return (
        <div className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
            <div className="sidebar-header">
                <div className="header-left" onClick={() => setIsCollapsed(!isCollapsed)} title={isCollapsed ? t('sidebar.expandLibrary') : t('sidebar.collapseLibrary')}>
                    <svg role="img" height="24" width="24" viewBox="0 0 24 24" fill="currentColor" className="library-icon">
                        <path d="M3 22a1 1 0 0 1-1-1V3a1 1 0 0 1 2 0v18a1 1 0 0 1-1 1zM15.5 2.134A1 1 0 0 0 14 3v18a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V6.464a1 1 0 0 0-.5-.866l-6-3.464zM9 2a1 1 0 0 0-1 1v18a1 1 0 1 0 2 0V3a1 1 0 0 0-1-1z"></path>
                    </svg>
                    {!isCollapsed && <h2>{t('sidebar.yourLibrary')}</h2>}
                </div>
                {!isCollapsed && (
                    <div className="sidebar-actions" style={{ position: 'relative' }}>
                        <button
                            className="add-btn"
                            title={t('sidebar.createPlaylist')}
                            onClick={handleAddClick}
                        >
                            <svg role="img" height="16" width="16" viewBox="0 0 16 16" fill="currentColor"><path d="M15.25 8a.75.75 0 01-.75.75H8.75v5.75a.75.75 0 01-1.5 0V8.75H1.5a.75.75 0 010-1.5h5.75V1.5a.75.75 0 011.5 0v5.75h5.75a.75.75 0 01.75.75z"></path></svg>
                        </button>
                        {showAddMenu && (
                            <div className="sidebar-add-menu">
                                <button onClick={() => {
                                    setCreateTarget('local');
                                    setShowAddMenu(false);
                                    setShowCreateModal(true);
                                }}>Create local playlist</button>
                                {isOnline && (
                                    <button onClick={() => {
                                        setCreateTarget('spotify');
                                        setShowAddMenu(false);
                                        setShowCreateModal(true);
                                    }}>Create spotify playlist</button>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {!isCollapsed && (
                <div className="library-filters">
                    {isOnline && (
                        <>
                            <button
                                className={`filter-pill ${activeFilter === 'Playlists' ? 'active' : ''}`}
                                onClick={() => setActiveFilter('Playlists')}
                            >
                                {t('sidebar.playlists')}
                            </button>
                            <button
                                className={`filter-pill ${activeFilter === 'Albums' ? 'active' : ''}`}
                                onClick={() => setActiveFilter('Albums')}
                            >
                                {t('sidebar.albums')}
                            </button>
                            <button
                                className={`filter-pill ${activeFilter === 'Artists' ? 'active' : ''}`}
                                onClick={() => setActiveFilter('Artists')}
                            >
                                {t('sidebar.artists')}
                            </button>
                        </>
                    )}
                    <button
                        className={`filter-pill ${activeFilter === 'Local' ? 'active' : ''}`}
                        onClick={() => setActiveFilter('Local')}
                    >
                        {t('sidebar.local')}
                    </button>
                </div>
            )}

            <div className="library-list">
                {error && <p className="error-text" style={{ padding: '8px', color: '#ff5555', fontSize: '12px' }}>{error}</p>}

                {activeFilter === 'Local' && (
                    <>
                        <div 
                            className="library-item" 
                            onClick={() => onPlaylistSelect('downloads-view')} 
                            title={t('sidebar.downloads')}
                        >
                            <div className="library-img-wrapper downloads-bg">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                            </div>
                            <div className="library-text">
                                <span className="library-title">{t('sidebar.downloads')}</span>
                                <span className="library-subtitle">{t('sidebar.offlineMusic')}</span>
                            </div>
                        </div>

                        {}
                        {isOnline && (
                            <div 
                                className="library-item" 
                                onClick={() => onPlaylistSelect('local-favorites')} 
                                title={t('sidebar.favorites')}
                            >
                                <div className="library-img-wrapper downloads-bg">
                                    <div className="liked-heart" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{'\u2665'}</div>
                                </div>
                                <div className="library-text">
                                    <span className="library-title">{t('sidebar.favorites')}</span>
                                    <span className="library-subtitle">{t('sidebar.localMusic')}</span>
                                </div>
                            </div>
                        )}

                        {localPlaylists.map(lp => (
                            <div 
                                key={lp.id} 
                                className="library-item" 
                                onClick={() => onPlaylistSelect(lp.id)} 
                                title={lp.name}
                            >
                                <div className="library-img-wrapper">
                                    {lp.artwork ? (
                                        <img src={lp.artwork} alt={lp.name} className="library-img" loading="lazy" />
                                    ) : (
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5">
                                            <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                                        </svg>
                                    )}
                                </div>
                                <div className="library-text" style={{ flex: 1 }}>
                                    <span className="library-title">{lp.name}</span>
                                    <span className="library-subtitle">{t('sidebar.playlistLocal')}</span>
                                </div>
                            </div>
                        ))}
                    </>
                )}

                {!isOnline && activeFilter === 'Local' && localPlaylists.length === 0 && (
                    <div className="offline-local-empty" style={{ padding: '20px', textAlign: 'center', opacity: 0.5, fontSize: '13px' }}>
                        {t('sidebar.offlineModeActive')}
                    </div>
                )}

                {activeFilter === 'Playlists' && (
                    <div 
                        className="library-item liked-songs" 
                        onClick={() => onPlaylistSelect('liked-songs')}
                    >
                        <div className="library-img-wrapper liked-songs-bg">
                            <div className="liked-heart">{'\u2665'}</div>
                        </div>
                        <div className="library-text">
                            <span className="library-title">Liked Songs</span>
                            <span className="library-subtitle">Playlist • You</span>
                        </div>
                    </div>
                )}

                {(activeFilter === 'Playlists' || activeFilter === 'Albums' || activeFilter === 'Artists') && !loading && items.map(item => (
                   <div 
                       key={item.id} 
                       className="library-item" 
                       onClick={() => handleItemClick(item)}
                   >
                       <div className={`library-img-wrapper ${activeFilter === 'Artists' ? 'artist-style' : ''}`} style={activeFilter === 'Artists' ? { borderRadius: '50%' } : {}}>
                           <img
                               src={getImageUrl(item)}
                               alt={item.name}
                               className="library-img"
                               style={activeFilter === 'Artists' ? { borderRadius: '50%' } : {}}
                           />
                       </div>
                       <div className="library-text">
                           <span className="library-title">{item.name}</span>
                           <span className="library-subtitle">
                               {getSubtitle(item)}
                           </span>
                       </div>
                   </div>
                ))}

                {}
                {(activeFilter === 'Playlists' || activeFilter === 'Albums') && !loading && savedLibrary
                    .filter(sl => activeFilter === 'Albums' ? sl.type === 'album' : sl.type === 'playlist')
                    .filter(sl => !items.some(i => i.id === sl.id))
                    .map(sl => (
                    <div 
                        key={`saved-${sl.id}`} 
                        className="library-item" 
                        onClick={() => onPlaylistSelect(sl.id, sl.type === 'album')}
                    >
                        <div className="library-img-wrapper">
                            {sl.image ? (
                                <img src={sl.image} alt={sl.name} className="library-img" loading="lazy" />
                            ) : (
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5">
                                    <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                                </svg>
                            )}
                        </div>
                        <div className="library-text">
                            <span className="library-title">{sl.name}</span>
                            <span className="library-subtitle">
                                {sl.type === 'album' ? t('home.album') : t('sidebar.playlist')} • {sl.owner || t('sidebar.saved')}
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" style={{ marginLeft: '4px', opacity: 0.5, verticalAlign: 'middle' }}>
                                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                                </svg>
                            </span>
                        </div>
                    </div>
                ))}

                {}
                {isOnline && loading && (
                    <div className="loading-skeletons">
                        {[1, 2, 3].map(i => <div key={i} className="skeleton-item"></div>)}
                    </div>
                )}
                
                {}
                {!isCollapsed && hasMore && (
                    <div ref={sentinelRef} className="library-load-more" style={{ height: '20px', minHeight: '20px' }}>
                        {isLoadingMore && <div className="skeleton-item" style={{ height: '40px', margin: '8px', opacity: 0.3 }} />}
                    </div>
                )}
            </div>

            {showCreateModal && (
                <CreatePlaylistModal
                    onClose={() => setShowCreateModal(false)}
                    onCreate={handleCreatePlaylist}
                />
            )}
        </div>
    );
};

export default Sidebar;
