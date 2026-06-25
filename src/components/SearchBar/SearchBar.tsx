import { useState, useEffect, useRef, useMemo } from 'react';
import './SearchBar.css';
import { useApi } from '../../context/ApiContext';
import { usePlayer } from '../../context/PlayerContext';
import { useLanguage } from '../../context/LanguageContext';
import { normalizeTrack, LuneTrack } from '../../types/track';
import { ARTIST_PLACEHOLDER, ALBUM_PLACEHOLDER } from '../../constants/assets';
import { usePlayback } from '../../context/PlaybackContext';

interface SearchBarProps {
    accessToken: string;
    cookies: any[];
    onTrackViewSelect?: (trackInfo: { id: string; name: string; image: string; artists: string[] }) => void;
    onArtistSelect?: (id: string) => void;
    onPlaylistSelect?: (id: string, isAlbum?: boolean) => void;
    onSearch?: (query: string) => void;
}

const SearchBar = ({ 
    accessToken: _accessToken, 
    cookies: _cookies, 
    onTrackViewSelect, 
    onArtistSelect, 
    onPlaylistSelect,
    onSearch
}: SearchBarProps) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<{
        albums: any[];
        artists: any[];
        playlists: any[];
        tracks: any[];
    } | null>(null);
    const [followingState, setFollowingState] = useState<Record<string, boolean>>({});
    const [isSearching, setIsSearching] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    
                 
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
    const [menuFavoriteState, setMenuFavoriteState] = useState<boolean | null>(null);
    const [menuDownloadState, setMenuDownloadState] = useState<boolean | null>(null);
    const [showPlaylistSubmenu, setShowPlaylistSubmenu] = useState(false);
    const [localPlaylists, setLocalPlaylists] = useState<any[]>([]);
    const [trackPlaylists, setTrackPlaylists ] = useState<string[]>([]);
    const menuRef = useRef<HTMLDivElement>(null);
    
    const wrapperRef = useRef<HTMLDivElement>(null);

    const { handleTrackSelect: onTrackPlaySelect, handleAddToQueue: contextAddToQueue, handlePlayNext } = usePlayer();
    const { lowDataMode } = usePlayback();
    const { t } = useLanguage();

    const api = useApi();

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsFocused(false);
            }
            if (activeMenuId && menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setActiveMenuId(null);
                setShowPlaylistSubmenu(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef, activeMenuId]);

    useEffect(() => {
        const timeoutId = setTimeout(async () => {
            if (query.trim().length > 0) {
                setIsSearching(true);
                try {
                    const res = await api.search.all(query, { limit: 15, topResults: 5 });
                    setResults(res);
                    
                                                         
                    if (res?.artists?.length > 0) {
                        const ids = res.artists.map((a: any) => a.id).filter(Boolean);
                        const follows = await api.user.isInLibrary(ids, { itemType: 'artist' });
                        setFollowingState(prev => {
                            const newState = { ...prev };
                            ids.forEach((id: string, idx: number) => {
                                newState[id] = follows[idx];
                            });
                            return newState;
                        });
                    }
                } catch (err) {
                    console.error('Search error:', err);
                } finally {
                    setIsSearching(false);
                }
            } else {
                setResults(null);
            }
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [query, api]);

    const handleItemClick = (item: any) => {
        setIsFocused(false); 
        const uriType = item.uri?.split(':')?.[1];
        const isTrack = item.objectType === 'Track' || uriType === 'track';
        const isPlaylist = item.objectType === 'Playlist' || uriType === 'playlist';
        const isAlbum = item.objectType === 'Album' || uriType === 'album';
        const isArtist = item.objectType === 'Artist' || uriType === 'artist';

        if (isTrack && onTrackViewSelect) {
            onTrackViewSelect({
                id: item.uri?.split(':').pop() || item.id,
                name: item.name,
                image: item.images?.[0]?.url || (item as any).album?.images?.[0]?.url || '',
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
        }
    };

    const toggleFollow = async (e: React.MouseEvent, artistId: string) => {
        e.stopPropagation();
        const isFollowing = followingState[artistId];
        try {
            if (isFollowing) {
                await api.artist.unfollow([artistId]);
            } else {
                await api.artist.follow([artistId]);
            }
            setFollowingState(prev => ({ ...prev, [artistId]: !isFollowing }));
        } catch (err) {
            console.error('Error toggling follow:', err);
        }
    };

    const handleMenuClick = async (e: React.MouseEvent, item: any) => {
        e.stopPropagation();
        const itemId = item.uri?.split(':').pop() || item.id;
        
        if (activeMenuId === itemId) {
            setActiveMenuId(null);
            setShowPlaylistSubmenu(false);
        } else {
                                                   
            const liked = await window.ipcRenderer.invoke('check-local-favorite', itemId);
            setMenuFavoriteState(liked);
            
            const isDownloaded = await window.ipcRenderer.invoke('check-is-downloaded', itemId);
            setMenuDownloadState(isDownloaded);

            
            const playlists = await window.ipcRenderer.invoke('get-playlists');
            setLocalPlaylists(playlists);

            
            const inPlaylists = await window.ipcRenderer.invoke('get-track-playlists', itemId);
            setTrackPlaylists(inPlaylists);
            
            setActiveMenuId(itemId);
            setShowPlaylistSubmenu(false);
        }
    };

    const handleToggleDownload = async (track: any) => {
        try {
            const trackIdToUse = track.uri?.split(':').pop() || track.id;
            const formattedTrack = {
                id: trackIdToUse,
                name: track.name,
                artists: track.artists?.map((a: any) => a.name) || [],
                albumArt: track.images?.[0]?.url || track.album?.images?.[0]?.url || '',
                durationMs: track.duration_ms || track.duration?.totalMilliseconds || track.trackDuration?.totalMilliseconds || 0
            };

            const success = menuDownloadState
                ? await window.ipcRenderer.invoke('remove-download', trackIdToUse)
                : await window.ipcRenderer.invoke('download-track', formattedTrack);

            if (success !== false) {
                setMenuDownloadState(!menuDownloadState);
                window.dispatchEvent(new Event('lune:download-update'));
            }
        } catch (e) {
            console.error("Failed to toggle download:", e);
        }
    };

    const handleTogglePlaylistTrack = async (playlistId: string, item: any) => {
        try {
            const isAlreadyIn = trackPlaylists.includes(playlistId);
            let success;
            if (isAlreadyIn) {
                success = await window.ipcRenderer.invoke('remove-track-from-playlist', {
                    playlistId,
                    trackId: item.uri?.split(':').pop() || item.id
                });
            } else {
                success = await window.ipcRenderer.invoke('add-track-to-playlist', {
                    playlistId,
                    track: item
                });
            }
            if (success) {
                window.dispatchEvent(new Event('lune:playlist-tracks-update'));
                
                const updatedPlaylists = await window.ipcRenderer.invoke('get-track-playlists', item.uri?.split(':').pop() || item.id);
                setTrackPlaylists(updatedPlaylists);
            }
        } catch (err) {
            console.error('Failed to toggle track in playlist:', err);
        }
    };

    const handlePlayButtonClick = async (e: React.MouseEvent, item: any) => {
        e.stopPropagation(); 
        const uriType = item.uri?.split(':')?.[1];
        const isTrack = item.objectType === 'Track' || uriType === 'track' || (!item.objectType && !uriType);
        const isArtist = item.objectType === 'Artist' || uriType === 'artist';
        const isAlbum = item.objectType === 'Album' || uriType === 'album';

        const playAsTrack = () => {
            if (!onTrackPlaySelect) return;
            const trackToPlay = normalizeTrack({
                ...item,
                id: item.uri?.split(':').pop() || item.id,
                durationMs: item.duration_ms || item.duration?.totalMilliseconds || 0,
                albumArt: item.images?.[0]?.url || item.album?.images?.[0]?.url || ''
            }, lowDataMode);
            onTrackPlaySelect(trackToPlay, []); 
        };

        if (isTrack) {
            playAsTrack();
            setIsFocused(false);
            return;
        }

        try {
            const id = item.uri?.split(':').pop() || item.id;
            
            if (isArtist) {
                const artistOverview = await api.artist.getArtist(id);
                const topTracks = (artistOverview?.discography?.topTracks?.items || [])
                    .map((tItem: any) => normalizeTrack({
                        ...tItem.track,
                        albumArt: item.images?.[0]?.url || ''
                    }, lowDataMode))
                    .filter((t: any) => t && t.id);

                if (topTracks.length > 0 && onTrackPlaySelect) {
                    onTrackPlaySelect(topTracks[0], topTracks);
                } else {
                    playAsTrack();
                }
                setIsFocused(false);
                return;
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
                
                if (mapped.length > 0 && onTrackPlaySelect) {
                    onTrackPlaySelect(mapped[0], mapped);
                } else {
                    playAsTrack();
                }
                setIsFocused(false);
                return;
            } else {
                const data = await api.playlist.getPlaylist(id);
                if (!data?.content?.items?.length) {
                    playAsTrack();
                    setIsFocused(false);
                    return;
                }

                const tracks = (data.content?.items || [])
                    .map((trackItem: any) => {
                        const trackData = trackItem.itemV2?.data;
                        if (!trackData) return null;
                        return normalizeTrack(trackData, lowDataMode);
                    })
                    .filter((t: any): t is LuneTrack => t !== null);

                if (tracks.length > 0 && onTrackPlaySelect) {
                    onTrackPlaySelect(tracks[0], tracks);
                    setIsFocused(false);
                } else {
                    playAsTrack();
                    setIsFocused(false);
                }
            }
        } catch (err) {
            console.error('Failed to play collection:', err);
            playAsTrack();
            setIsFocused(false);
        }
    };

    const handleToggleFavorite = async (track: any) => {
        try {
            const trackIdToUse = track.uri?.split(':').pop() || track.id;
            const isLiked = await window.ipcRenderer.invoke('check-local-favorite', trackIdToUse);
            
            
            const formattedTrack = {
                id: trackIdToUse,
                name: track.name,
                artists: track.artists?.map((a: any) => a.name) || [],
                albumArt: track.images?.[0]?.url || track.album?.images?.[0]?.url || '',
                durationMs: track.duration_ms || track.duration?.totalMilliseconds || track.trackDuration?.totalMilliseconds || 0
            };

            let success;
            if (isLiked) {
                success = await window.ipcRenderer.invoke('remove-local-favorite', trackIdToUse);
            } else {
                success = await window.ipcRenderer.invoke('add-local-favorite', formattedTrack);
            }
            if (success) {
                setMenuFavoriteState(!isLiked);
                window.dispatchEvent(new Event('lune:playlist-update'));
            }
        } catch (e) {
            console.error("Failed to toggle favorite:", e);
        }
    };

    
    const allResults = useMemo(() => {
        if (!results) return [];
        const tracks = results.tracks || [];
        const artists = results.artists || [];
        const albums = results.albums || [];
        const playlists = results.playlists || [];

        
        const interleaved: any[] = [
            ...tracks.slice(0, 4),        
            ...artists.slice(0, 2),       
            ...albums.slice(0, 2),        
            ...playlists.slice(0, 2),     
            ...tracks.slice(4),           
            ...artists.slice(2),          
            ...albums.slice(2),           
            ...playlists.slice(2),        
        ];

        
        const seen = new Set<string>();
        return interleaved.filter(item => {
            const key = item.uri || item.id;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        }).slice(0, 30);
    }, [results]);

    return (
        <div className="search-bar-wrapper" ref={wrapperRef}>
            <div className={`search-bar-input-container ${isFocused ? 'focused' : ''}`}>
                <div className="search-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M10.533 1.279c-5.18 0-9.407 4.14-9.407 9.279s4.226 9.279 9.407 9.279c2.234 0 4.29-.77 5.907-2.058l4.353 4.353a1 1 0 101.414-1.414l-4.344-4.344a9.157 9.157 0 002.077-5.816c0-5.14-4.226-9.28-9.407-9.28zm-7.407 9.279c0-4.006 3.302-7.28 7.407-7.28s7.407 3.274 7.407 7.28-3.302 7.28-7.407 7.28-7.407-3.274-7.407-7.28z"></path></svg>
                </div>
                <input
                    type="text"
                    placeholder={t('search.placeholder')}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    spellCheck="false"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && query.trim() && onSearch) {
                            setIsFocused(false);
                            onSearch(query.trim());
                        }
                    }}
                />
                {query && (
                    <button className="search-clear-btn" onClick={() => setQuery('')}>
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.293 3.293a1 1 0 011.414 0L12 10.586l7.293-7.293a1 1 0 111.414 1.414L13.414 12l7.293 7.293a1 1 0 01-1.414 1.414L12 13.414l-7.293 7.293a1 1 0 01-1.414-1.414L10.586 12 3.293 4.707a1 1 0 010-1.414z"></path></svg>
                    </button>
                )}
            </div>

            {isFocused && query.trim().length > 0 && (
                <div className="search-dropdown">
                    <h3 className="search-dropdown-header">{t('search.results')}</h3>
                    {isSearching ? (
                        <div className="search-loading" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0' }}>
                            <div className="lune-loading-animation">
                                <div className="bar bar1"></div>
                                <div className="bar bar2"></div>
                                <div className="bar bar3"></div>
                            </div>
                            <span style={{ marginTop: '16px', fontSize: '13px', color: 'var(--text-dim)', fontWeight: 500 }}>{t('search.searching')}</span>
                        </div>
                    ) : allResults.length > 0 ? (
                        <div className="search-results-list">
                            {allResults.map((item, idx) => {
                                const isArtist = item.objectType === 'Artist';
                                const imageUrl = item.images?.[0]?.url || (item as any).album?.images?.[0]?.url || (isArtist ? ARTIST_PLACEHOLDER : ALBUM_PLACEHOLDER);
                                return (
                                    <div key={`${item.uri}-${idx}`} className="search-result-item" onClick={() => handleItemClick(item)}>
                                        <div className={`result-image ${isArtist ? 'artist-circle' : ''}`} 
                                             onClick={(e) => {
                                                 if (!isArtist) {
                                                     handlePlayButtonClick(e, item);
                                                 }
                                             }}>
                                            <img src={imageUrl} alt={item.name} loading="lazy" />
                                            {!isArtist && (
                                                <div className="result-play-overlay">
                                                    <svg viewBox="0 0 24 24" fill="currentColor">
                                                        <path d="M7.05 3.606l13.49 7.788a.7.7 0 010 1.212L7.05 20.394A.7.7 0 016 19.788V4.212a.7.7 0 011.05-.606z" />
                                                    </svg>
                                                </div>
                                            )}
                                        </div>
                                        <div className="result-info">
                                            <div className="result-name">{item.name}</div>
                                            <div className="result-sub">
                                                {item.objectType === 'Track' || !item.objectType ? t('search.song') : item.objectType} 
                                                {item.artists && Array.isArray(item.artists) ? ` • ${item.artists.map((a:any) => a.name).join(', ')}` : ''}
                                                {item.owner?.display_name ? ` • ${item.owner.display_name}` : ''}
                                            </div>
                                        </div>
                                        {isArtist ? (
                                            <button 
                                                className={`search-bar-follow-btn ${followingState[item.id] ? 'following' : ''}`}
                                                onClick={(e) => toggleFollow(e, item.id)}
                                            >
                                                {followingState[item.id] ? t('search.following') : t('search.follow')}
                                            </button>
                                        ) : (
                                            (!item.objectType || item.objectType === 'Track') && (
                                                <div className="search-result-actions" ref={activeMenuId === (item.uri?.split(':').pop() || item.id) ? menuRef : null}>
                                                    <button 
                                                        className={`search-result-more-btn ${activeMenuId === (item.uri?.split(':').pop() || item.id) ? 'active' : ''}`}
                                                        onClick={(e) => handleMenuClick(e, item)}
                                                        title={t('search.moreOptions')}
                                                    >
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                                            <circle cx="12" cy="5" r="2" />
                                                            <circle cx="12" cy="12" r="2" />
                                                            <circle cx="12" cy="19" r="2" />
                                                        </svg>
                                                    </button>
                                                    {activeMenuId === (item.uri?.split(':').pop() || item.id) && (
                                                        <div className="lune-dropdown">
                                                             <button className="lune-dropdown-item" onClick={(e) => {
                                                                 e.stopPropagation();
                                                                 const trackToPlay = normalizeTrack({
                                                                     ...item,
                                                                     id: item.uri?.split(':').pop() || item.id,
                                                                     durationMs: item.duration_ms || item.duration?.totalMilliseconds || 0,
                                                                     albumArt: item.images?.[0]?.url || item.album?.images?.[0]?.url || ''
                                                                 }, lowDataMode);
                                                                 handlePlayNext(trackToPlay);
                                                                 setActiveMenuId(null);
                                                             }}>
                                                                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                                     <path d="M13 12H3M13 6H3M13 18H3" />
                                                                     <path d="M17 8l5 4-5 4V8z" />
                                                                 </svg>
                                                                 {t('search.playNext')}
                                                             </button>
                                                            <button className="lune-dropdown-item" onClick={(e) => {
                                                                e.stopPropagation();
                                                                const trackToAdd = normalizeTrack({
                                                                    ...item,
                                                                    id: item.uri?.split(':').pop() || item.id,
                                                                    durationMs: item.duration_ms || item.duration?.totalMilliseconds || 0,
                                                                    albumArt: item.images?.[0]?.url || item.album?.images?.[0]?.url || ''
                                                                }, lowDataMode);
                                                                contextAddToQueue?.(trackToAdd);
                                                                setActiveMenuId(null);
                                                            }}>
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
                                                                {t('search.addToQueue')}
                                                            </button>
                                                            {menuFavoriteState !== null && (
                                                                <button className="lune-dropdown-item" onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleToggleFavorite(item);
                                                                    setActiveMenuId(null);
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
                                                                    handleToggleDownload(item);
                                                                    setActiveMenuId(null);
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
                                                                                        handleTogglePlaylistTrack(p.id, item);
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
                                            )
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="search-no-results">{t('search.noResults')} "{query}"</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SearchBar;
