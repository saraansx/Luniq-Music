
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { createPortal } from 'react-dom';
import './Playlist.css';
import { useApi } from '../../context/ApiContext';
import CreatePlaylistModal from '../CreatePlaylist/CreatePlaylistModal';
import ShuffleIcon from '../Icons/ShuffleIcon';
import ShuffleButton from '../Shuffle/ShuffleButton';
import { DownloadIndicator } from '../DownloadIndicator/DownloadIndicator';
import PreviewCarousel from './PreviewCarousel';

import { formatDuration } from '../../utils/format';

import { usePlayer } from '../../context/PlayerContext';
import { useLanguage } from '../../context/LanguageContext';
import { LuniqTrack, normalizeTrack } from '../../types/track';
import { usePlayback } from '../../context/PlaybackContext';

interface PlaylistProps {
    accessToken: string | null;
    cookies: any[];
    playlistId: string;
    isAlbum?: boolean;
    onBack: () => void;
    onHome?: () => void;
    onPlaylistSelect?: (id: string, isAlbum?: boolean) => void;
    onArtistSelect?: (id: string | null, name: string) => void;
}

const Playlist: React.FC<PlaylistProps> = ({ accessToken: _accessToken, cookies: _cookies, playlistId, isAlbum: isAlbumProp, onBack, onHome, onPlaylistSelect, onArtistSelect }) => {
    const {
        currentTrack,
        isShuffle,
        setIsShuffle,
        handleTrackSelect: onTrackSelect,
        handleAddToQueue: onAddToQueue,
        handlePlayNext: onPlayNext,
        activeBulkDownloads,
        startBulkDownload,
        stopBulkDownload
    } = usePlayer();
    const { lowDataMode } = usePlayback();
    const { t } = useLanguage();

    const currentTrackId = currentTrack?.id;
    const onToggleShuffle = () => setIsShuffle(!isShuffle);
    const [playlist, setPlaylist] = useState<any>(null);
    const [tracks, setTracks] = useState<LuniqTrack[]>([]);
    const [artistAlbums, setArtistAlbums] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showMenu, setShowMenu] = useState(false);
    const [trackMenu, setTrackMenu] = useState<string | null>(null); 
    const [menuTrack, setMenuTrack] = useState<LuniqTrack | null>(null); 
    const [menuPosition, setMenuPosition] = useState<{ x: number, y: number, isBottom: boolean } | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [isInLibrary, setIsInLibrary] = useState<boolean | null>(null);
    const [localPlaylists, setLocalPlaylists] = useState<any[]>([]);
    const [trackPlaylists, setTrackPlaylists] = useState<string[]>([]);
    const [showPlaylistSubmenu, setShowPlaylistSubmenu] = useState(false);
    const isDownloading = activeBulkDownloads.has(playlistId || '');
    const [isInLocalLibrary, setIsInLocalLibrary] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [previewTracks, setPreviewTracks] = useState<any[]>([]);
    const lastPreviewPlaylistId = useRef<string | null>(null);

                                                                                                
    const containerRef = useRef<HTMLDivElement | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [scrollParent, setScrollParent] = useState<HTMLElement | null>(null);
    const containerCallbackRef = useCallback((el: HTMLDivElement | null) => {
        containerRef.current = el;
        setScrollParent(el);
    }, []);

    const api = useApi();

    const fetchPreviewTracks = async () => {
        if (previewTracks.length > 0 && lastPreviewPlaylistId.current === playlistId) {
            setShowPreview(true);
            return;
        }
        try {
            if (tracks.length === 0) return;

            const trackUris = tracks.map(t => `spotify:track:${t.id}`);
            const data = await api.track.getTrackPreviews(trackUris);

            const lookups = data?.trackPreview?.lookup || data?.lookup || [];

            const mapped = tracks.map((track, index) => {
                const lookup = lookups[index] || {};
                const previewUrl = lookup?.data?.previews?.audioPreviewsV2?.items?.[0]?.url || null;
                const firstArtist = Array.isArray(track.artists) && track.artists.length > 0 ? track.artists[0] : null;
                return {
                    id: track.id,
                    name: track.name,
                    uri: `spotify:track:${track.id}`,
                    image: track.albumArt || '',
                    artists: track.artist ? [track.artist] : [],
                    artistId: firstArtist?.id || null,
                    previewUrl,
                };
            }).filter((t) => t.previewUrl);

            lastPreviewPlaylistId.current = playlistId;
            setPreviewTracks(mapped);
            setShowPreview(true);
        } catch (err) {
            console.error('[Playlist] Failed to fetch track previews:', err);
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
                    onArtistSelect?.(id, '');                         
                }
            }
        }
    };

    useEffect(() => {
        if (containerRef.current) containerRef.current.scrollTop = 0;
        const fetchData = async () => {
            try {
                setLoading(true);
                setArtistAlbums([]);                                            

                                         
                if (playlistId.startsWith('local-')) {
                    if (playlistId === 'local-favorites') {
                        try {
                            const favorites = await window.ipcRenderer.invoke('get-local-favorites');
                            setPlaylist({
                                name: t('playlist.favorites'),
                                description: t('playlist.localMusic'),
                                coverUrl: '', // Uses the gradient
                                ownerName: t('downloads.you'),
                                followerCount: 0,
                                totalTracks: favorites.length || 0,
                                isLocal: true,
                            });
                            setTracks(favorites.map((f: any) => normalizeTrack(f, lowDataMode)));
                        } catch (e) {
                            console.error("Failed to fetch local favorites", e);
                            setTracks([]);
                        }
                        setLoading(false);
                        return;
                    }

                    try {
                        const local = await window.ipcRenderer.invoke('get-playlist', playlistId);
                        if (local) {
                            const localTracks = await window.ipcRenderer.invoke('get-playlist-tracks', playlistId);
                            setPlaylist({
                                name: local.name,
                                description: local.description || '',
                                coverUrl: local.artwork || '',
                                ownerName: t('downloads.you'),
                                followerCount: 0,
                                totalTracks: localTracks.length,
                                isLocal: true,
                            });
                            setTracks(localTracks.map((t: any) => normalizeTrack(t, lowDataMode)));
                            setLoading(false);
                            return;
                        }
                    } catch (_e) {
                        console.error("Failed to load local playlist", _e);
                    }
                    setError(t('playlist.localNotFound'));
                    setLoading(false);
                    return;
                }

                
                if (playlistId === 'liked-songs') {
                    try {
                        const firstPage = await api.library.tracks({ limit: 50 });

                        setPlaylist({
                            name: t('playlist.likedSongs'),
                            description: t('playlist.yourLikedSongs'),
                            coverUrl: '', // Will default to gradient
                            ownerName: t('downloads.you'),
                            followerCount: 0,
                            totalTracks: firstPage.total,
                        });

                        const mapLikedSongs = (items: any[]) => items
                            .map((t: any) => normalizeTrack(t, lowDataMode))
                            .filter((t: LuniqTrack) => t.id);

                        let allTracks = mapLikedSongs(firstPage.items);
                        const totalTracks = firstPage.total;

                        if (allTracks.length < totalTracks) {
                            const PAGE_SIZE = 50;
                            const promises = [];
                            
                            
                            
                            
                            
                            for (let offset = allTracks.length; offset < totalTracks; offset += PAGE_SIZE) {
                                promises.push(
                                    api.library.tracks({ offset, limit: PAGE_SIZE })
                                        .then(res => res.items)
                                        .catch(() => [])
                                );
                            }
                            const results = await Promise.all(promises);
                            
                            
                            
                            for (const r of results) {
                                allTracks = [...allTracks, ...mapLikedSongs(r)];
                            }
                        }

                        setTracks(allTracks);
                        setLoading(false);
                        return;

                    } catch (e) {
                        console.error("Failed to load liked songs", e);
                        setError(t('playlist.failedLikedSongs'));
                        setLoading(false);
                        return;
                    }
                }

                
                const mapPlaylistItems = (items: any[]) => items.map((item: any) => {
                    const trackData = item.itemV2?.data;
                    if (!trackData) return null;
                    return normalizeTrack(trackData, lowDataMode);
                }).filter((t: any): t is LuniqTrack => t !== null);

                
                const mapAlbumItems = (items: any[], albumCover: string, albumTitle: string) => items.map((item: any) => {
                    const track = item.track || item;
                    if (!track) return null;
                    
                    const normalized = normalizeTrack(track, lowDataMode);
                    if (!normalized.albumArt || normalized.albumArt.includes('data:image/svg')) normalized.albumArt = albumCover;
                    if (!normalized.albumName) normalized.albumName = albumTitle;
                    return normalized;
                }).filter((t: any): t is LuniqTrack => t !== null);

                let success = false;

                
                if (!isAlbumProp) {
                    try {
                        const data = await api.playlist.getPlaylist(playlistId);
                        if (data && data.name) {
                            const coverUrl = data.images?.items?.[0]?.sources?.[0]?.url
                                || data.images?.items?.[0]?.url || '';
                            const ownerName = data.ownerV2?.data?.name || data.owner?.name || 'Unknown';
                            const totalTracks = data.content?.totalCount || 0;
                            const followerCount = typeof data.followers === 'number'
                                ? data.followers : data.followers?.total || 0;

                            setPlaylist({
                                name: data.name,
                                description: data.description || '',
                                coverUrl,
                                ownerName,
                                followerCount,
                                totalTracks,
                            });

                            const firstBatch = data.content?.items || [];
                            let allTracks = mapPlaylistItems(firstBatch);

                            const loaded = firstBatch.length;
                            if (loaded < totalTracks) {
                                const PAGE_SIZE = 343;
                                const promises = [];
                                for (let offset = loaded; offset < totalTracks; offset += PAGE_SIZE) {
                                    promises.push(
                                        api.playlist.tracks(playlistId, { offset, limit: PAGE_SIZE })
                                            .then((content: any) => ({ offset, items: content?.items || [] }))
                                            .catch(() => ({ offset, items: [] }))
                                    );
                                }
                                const results = await Promise.all(promises);
                                results.sort((a, b) => a.offset - b.offset);
                                for (const r of results) {
                                    allTracks = [...allTracks, ...mapPlaylistItems(r.items)];
                                }
                            }

                            setTracks(allTracks);
                            success = true;
                        }
                    } catch (playlistErr) {
                        console.error("[Playlist] Playlist fetch failed:", playlistErr);
                        console.log("[Playlist] Failed ID was:", playlistId);
                    }
                }

                                                                             
                if (!success) {
                    try {
                        console.log("[Playlist] Attempting album fetch for ID:", playlistId);
                        const albumData = await api.album.getAlbum(playlistId);
                        console.log("[Playlist] Album GQL raw response:", albumData);

                        if (albumData && albumData.name) {
                            const coverUrl = albumData.coverArt?.sources?.[0]?.url
                                || albumData.images?.items?.[0]?.sources?.[0]?.url
                                || albumData.images?.[0]?.url || '';
                            const artistName = albumData.artists?.items?.[0]?.profile?.name
                                || albumData.artist?.name
                                || 'Unknown';
                            const releaseYear = albumData.date?.year || albumData.release_date?.split('-')[0] || '';
                            const albumType = albumData.albumType || albumData.type || 'Album';
                            const trackItems = albumData.tracksV2?.items || albumData.tracks?.items || albumData.tracks || [];
                            const totalTracks = albumData.tracksV2?.totalCount || trackItems.length;

                            setPlaylist({
                                name: albumData.name,
                                description: `${albumType} • ${releaseYear}`,
                                coverUrl,
                                ownerName: artistName,
                                followerCount: 0,
                                totalTracks,
                                isAlbum: true,
                            });

                            setTracks(mapAlbumItems(trackItems, coverUrl, albumData.name));

                            
                            const artistUri = albumData.artists?.items?.[0]?.uri || albumData.artist?.uri;
                            if (artistUri) {
                                const artistId = artistUri.split(':').pop();
                                try {
                                    const artistData = await api.artist.getArtist(artistId);
                                    const albums = artistData?.discography?.albums?.items
                                        ?.map((item: any) => {
                                            const release = item.releases?.items?.[0];
                                            if (!release || release.uri?.split(':').pop() === playlistId) return null;
                                            return {
                                                id: release.uri?.split(':').pop(),
                                                name: release.name,
                                                uri: release.uri,
                                                year: release.date?.year,
                                                images: release.coverArt?.sources || [],
                                                type: release.type || 'Album',
                                            };
                                        }).filter(Boolean) || [];

                                    const singles = artistData?.discography?.singles?.items
                                        ?.map((item: any) => {
                                            const release = item.releases?.items?.[0];
                                            if (!release || release.uri?.split(':').pop() === playlistId) return null;
                                            return {
                                                id: release.uri?.split(':').pop(),
                                                name: release.name,
                                                uri: release.uri,
                                                year: release.date?.year,
                                                images: release.coverArt?.sources || [],
                                                type: 'Single',
                                            };
                                        }).filter(Boolean) || [];

                                    setArtistAlbums([...albums, ...singles].slice(0, 7));
                                } catch (artistErr) {
                                    console.error("[Playlist] Failed to fetch artist albums:", artistErr);
                                }
                            }

                            success = true;
                        } else {
                            console.warn("[Playlist] Album data returned but missing name:", albumData);
                        }
                    } catch (albumErr) {
                        console.error("[Playlist] Album fetch also failed:", albumErr);
                    }
                }

                if (!success) {
                    throw new Error("Could not load as playlist or album");
                }
            } catch (err: any) {
                console.error("[Playlist] Final failure:", err);
                setError(`Failed: ${err.message || JSON.stringify(err)}`);
            } finally {
                setLoading(false);
            }
        };

        if (api && playlistId) {
            fetchData();
        }

        
        const handleUpdate = () => {
            if (playlistId === 'local-favorites' || playlistId.startsWith('local-')) {
                fetchData();
            }
        };
        window.addEventListener('luniq:playlist-update', handleUpdate);
        window.addEventListener('luniq:playlist-tracks-update', handleUpdate);
        return () => {
            window.removeEventListener('luniq:playlist-update', handleUpdate);
            window.removeEventListener('luniq:playlist-tracks-update', handleUpdate);
        };
    }, [api, playlistId, isAlbumProp]);

    useEffect(() => {
        if (!api || !playlistId || playlistId === 'liked-songs' || playlistId === 'downloads' || playlistId.startsWith('local-')) return;
        const checkLibrary = async () => {
            try {
                if (playlist?.isAlbum) {
                    const [saved] = await api.user.isInLibrary([playlistId], { itemType: 'album' });
                    setIsInLibrary(saved);
                }
            } catch (e) {
                console.error("Failed to check library status", e);
            }
        };
        if (playlist) {
            checkLibrary();
        }
    }, [api, playlistId, playlist]);

    const toggleLibrary = async () => {
        try {
            if (playlist?.isAlbum) {
                if (isInLibrary) {
                    await api.album.unsave([playlistId]);
                    setIsInLibrary(false);
                } else {
                    await api.album.save([playlistId]);
                    setIsInLibrary(true);
                }
            } else {
                if (isInLibrary) {
                    await api.playlist.unfollow([playlistId]);
                    setIsInLibrary(false);
                } else {
                    await api.playlist.follow([playlistId]);
                    setIsInLibrary(true);
                }
            }
            window.dispatchEvent(new Event('luniq:playlist-update'));
        } catch (e) {
            console.error("Failed to toggle library status", e);
        }
    };

    
    useEffect(() => {
        if (!playlistId || playlistId === 'liked-songs' || playlistId === 'downloads' || playlistId.startsWith('local-')) return;
        const checkLocalLibrary = async () => {
            try {
                const saved = await window.ipcRenderer.invoke('check-in-library', playlistId);
                setIsInLocalLibrary(saved);
            } catch (e) {
                console.error("Failed to check local library status", e);
            }
        };
        checkLocalLibrary();
    }, [playlistId]);

    const toggleLocalLibrary = async () => {
        try {
            if (isInLocalLibrary) {
                await window.ipcRenderer.invoke('remove-from-library', playlistId);
                setIsInLocalLibrary(false);
            } else {
                await window.ipcRenderer.invoke('save-to-library', {
                    id: playlistId,
                    name: playlist?.name || 'Unknown',
                    type: playlist?.isAlbum ? 'album' : 'playlist',
                    image: playlist?.coverUrl || playlist?.images?.[0]?.url || '',
                    owner: playlist?.ownerName || '',
                    description: playlist?.description || '',
                    totalTracks: playlist?.totalTracks || tracks.length,
                });
                setIsInLocalLibrary(true);
            }
            window.dispatchEvent(new Event('luniq:library-update'));
        } catch (e) {
            console.error("Failed to toggle local library", e);
        }
    };

    const handleDownloadAll = async () => {
        if (!tracks || tracks.length === 0 || !playlistId) return;

        if (isDownloading) {
            stopBulkDownload(playlistId);
        } else {
            
            startBulkDownload(playlistId, tracks);
        }
    };

    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;

            
            if (showMenu && menuRef.current && !menuRef.current.contains(target as Node)) {
                setShowMenu(false);
            }

            
            if (trackMenu) {
                if (!target.closest('.track-context-menu') && !target.closest('.luniq-dropdown') && !target.closest('.luniq-submenu')) {
                    setTrackMenu(null);
                    setMenuTrack(null);
                    setShowPlaylistSubmenu(false);
                }
            }
        };

        if (showMenu || trackMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showMenu, trackMenu]);

    const [menuFavoriteState, setMenuFavoriteState] = useState<boolean | null>(null);
    const [menuDownloadState, setMenuDownloadState] = useState<boolean | null>(null);

    const handleTrackMenuClick = async (e: React.MouseEvent, tId: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (trackMenu === tId) {
            setTrackMenu(null);
            setMenuTrack(null);
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
            
            setTrackMenu(tId);
            setMenuTrack(tracks.find(t => t.id === tId) || null);
            setMenuFavoriteState(null);
            setMenuDownloadState(null);
            setShowPlaylistSubmenu(false);
            try {
                const isFav = await window.ipcRenderer.invoke('check-local-favorite', tId);
                setMenuFavoriteState(isFav);
                
                const isDownloaded = await window.ipcRenderer.invoke('check-is-downloaded', tId);
                setMenuDownloadState(isDownloaded);
                
                
                const playlists = await window.ipcRenderer.invoke('get-playlists');
                setLocalPlaylists(playlists);
 
                
                const inPlaylists = await window.ipcRenderer.invoke('get-track-playlists', tId);
                setTrackPlaylists(inPlaylists);
            } catch (err) {
                console.error("Failed checking status", err);
            }
        }
    };

    const handleTogglePlaylistTrack = async (pId: string, item: LuniqTrack) => {
        try {
            const isAlreadyIn = trackPlaylists.includes(pId);
            let success;
            if (isAlreadyIn) {
                success = await window.ipcRenderer.invoke('remove-track-from-playlist', {
                    playlistId: pId,
                    trackId: item.id
                });
            } else {
                success = await window.ipcRenderer.invoke('add-track-to-playlist', {
                    playlistId: pId,
                    track: item
                });
            }
            if (success) {
                window.dispatchEvent(new Event('luniq:playlist-tracks-update'));
                
                const updatedPlaylists = await window.ipcRenderer.invoke('get-track-playlists', item.id);
                setTrackPlaylists(updatedPlaylists);
            }
        } catch (err) {
            console.error('Failed to toggle track in playlist:', err);
        }
    };

    const handleRemoveFromPlaylist = async (tId: string) => {
        try {
            const success = await window.ipcRenderer.invoke('remove-track-from-playlist', {
                playlistId,
                trackId: tId
            });
            if (success) {
                window.dispatchEvent(new Event('luniq:playlist-tracks-update'));
                setTrackMenu(null);
            }
        } catch (err) {
            console.error('Failed to remove track from playlist:', err);
        }
    };

    const handleToggleFavorite = async (item: LuniqTrack) => {
        try {
            if (menuFavoriteState) {
                await window.ipcRenderer.invoke('remove-local-favorite', item.id);
            } else {
                await window.ipcRenderer.invoke('add-local-favorite', item);
            }
            window.dispatchEvent(new Event('luniq:playlist-update'));
            setMenuFavoriteState(!menuFavoriteState);
        } catch (e) {
            console.error("Failed to toggle favorite from menu", e);
        }
    };

    const handleToggleDownload = async (item: LuniqTrack) => {
        try {
            if (menuDownloadState) {
                await window.ipcRenderer.invoke('remove-download', item.id);
            } else {
                await window.ipcRenderer.invoke('download-track', item);
            }
            window.dispatchEvent(new Event('luniq:download-update'));
            setMenuDownloadState(!menuDownloadState);
        } catch (e) {
            console.error("Failed to toggle download from menu", e);
        }
    };

    const handleShufflePlay = () => {
        if (!tracks.length) return;
        if (!isShuffle) onToggleShuffle?.();
        const randomIndex = Math.floor(Math.random() * tracks.length);
        
        onTrackSelect?.(tracks[randomIndex], tracks);
    };

    const totalDurationText = useMemo(() => {
        const totalMs = tracks.reduce((acc, t) => acc + (t.durationMs || 0), 0);
        if (!totalMs) return '';
        const totalMinutes = Math.floor(totalMs / 60000);
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        if (hours > 0) {
            return `, ${hours} hr ${mins} min`;
        }
        return `, ${mins} min`;
    }, [tracks]);

    if (loading) {
        return (
            <div className="luniq-loading-container" style={{ background: 'linear-gradient(to bottom, rgba(135, 61, 118, 0.03) 0%, transparent 100%)' }}>
                <div className="luniq-loading-animation" style={{ transform: 'scale(1.5)' }}>
                    <div className="bar bar1"></div>
                    <div className="bar bar2"></div>
                    <div className="bar bar3"></div>
                </div>
                <span style={{ marginTop: '24px', fontWeight: 500, letterSpacing: '0.5px', opacity: 0.6 }}>{t('playlist.loadingPlaylist')}</span>
            </div>
        );
    }

    if (error || !playlist) {
        return (
            <div className="playlist-error" style={{ background: 'linear-gradient(to bottom, rgba(var(--accent-rgb), 0.05) 0%, transparent 100%)' }}>
                <div className="error-icon-wrapper">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.2 }}>
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                </div>
                <h2>{error || t('playlist.notFound')}</h2>
                <p style={{ color: 'var(--text-dim)', marginTop: '-8px', fontSize: '14px' }}>{t('playlist.notFoundDesc')}</p>
                <button 
                    onClick={onHome || onBack} 
                    className="luniq-dropdown-item active" 
                    style={{ 
                        marginTop: '12px', 
                        width: 'auto', 
                        padding: '10px 24px', 
                        borderRadius: '20px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}
                >
                    {t('playlist.goBackHome')}
                </button>
            </div>
        );
    }

    return (
        <div className="playlist-container" ref={containerCallbackRef}>

            <div className="playlist-hero">
                {playlist.coverUrl ? (
                    <img
                        src={playlist.coverUrl}
                        alt={playlist.name}
                        className="playlist-cover"
                    />
                ) : (
                    <div
                        className={`playlist-cover ${playlistId === 'liked-songs' ? 'liked-songs-bg' : 'downloads-bg'}`}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: '220px',
                            minHeight: '220px',
                        }}
                    >
                        {playlistId === 'liked-songs' || playlistId === 'local-favorites' ? (
                            <div className="heart-icon" style={{ fontSize: '72px' }}>{'\u2665'}</div>
                        ) : (
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.2">
                                <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                            </svg>
                        )}
                    </div>
                )}
                <div className="playlist-info">
                    <span className="playlist-type">{playlist.isAlbum ? playlist.description?.split(' • ')[0] || t('home.album') : t('playlist.playlist')}</span>
                    <h1 className="playlist-title">{playlist.name}</h1>
                    {playlist.description && !playlist.isAlbum && (
                        <p 
                            className="playlist-description"
                            dangerouslySetInnerHTML={{ __html: playlist.description }}
                            onClick={handleDescriptionClick}
                        />
                    )}
                    <div className="playlist-meta">
                        <b 
                            onClick={playlist.isAlbum ? () => onArtistSelect?.(null, playlist.ownerName) : undefined}
                            style={{ cursor: playlist.isAlbum ? 'pointer' : 'default' }}
                            onMouseOver={(e) => { if (playlist.isAlbum) e.currentTarget.style.textDecoration = 'underline'; }}
                            onMouseOut={(e) => { if (playlist.isAlbum) e.currentTarget.style.textDecoration = 'none'; }}
                        >
                            {playlist.ownerName}
                        </b>
                        {playlist.isLocal ? (
                            <span>• {playlist.totalTracks} {playlist.totalTracks !== 1 ? t('playlist.songs') : t('playlist.song')}{totalDurationText}</span>
                        ) : playlist.isAlbum ? (
                            <>
                                {playlist.description?.split(' • ')[1] && <span>• {playlist.description.split(' • ')[1]}</span>}
                                <span>• {playlist.totalTracks} {playlist.totalTracks !== 1 ? t('playlist.songs') : t('playlist.song')}{totalDurationText}</span>
                            </>
                        ) : (
                            <>
                                <span>• {playlist.followerCount.toLocaleString()} {t('playlist.likes')}</span>
                                <span>• {playlist.totalTracks} {t('playlist.songs')}{totalDurationText}</span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="playlist-actions">
                <button
                    className="play-all-btn"
                    title={t('playlist.playAll')}
                    onClick={() => tracks.length > 0 && onTrackSelect?.(tracks[0], tracks)}
                >
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M7.05 3.606l13.49 7.788a.7.7 0 010 1.212L7.05 20.394A.7.7 0 016 19.788V4.212a.7.7 0 011.05-.606z" />
                    </svg>
                </button>
                <ShuffleButton
                    isShuffle={isShuffle}
                    onToggle={onToggleShuffle}
                    className="playlist-dots-btn"
                    size={24}
                />

                <button
                    className="playlist-dots-btn"
                    title="Scroll through previews"
                    onClick={fetchPreviewTracks}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="2" y="4" width="6" height="16" rx="1" />
                        <rect x="10" y="4" width="6" height="16" rx="1" />
                        <polygon points="18,8 24,4 24,20 18,16" />
                    </svg>
                </button>

                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <button
                        className="playlist-dots-btn"
                        title={t('playlist.downloadAll')}
                        onClick={handleDownloadAll}
                        style={{ color: isDownloading ? 'var(--accent-main)' : 'inherit' }}
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

                <div className="playlist-menu-wrapper" ref={menuRef}>
                    <button
                        className="playlist-dots-btn"
                        title={t('playlist.moreOptions')}
                        onClick={() => setShowMenu(!showMenu)}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="5" r="2" />
                            <circle cx="12" cy="12" r="2" />
                            <circle cx="12" cy="19" r="2" />
                        </svg>
                    </button>
                    {showMenu && (
                        <div className="luniq-dropdown open-down" style={{ top: '100%', left: '0', bottom: 'auto', right: 'auto', marginTop: '8px' }} onClick={() => setShowMenu(false)}>
                            <button className="luniq-dropdown-item" onClick={handleShufflePlay}>
                                <ShuffleIcon size={14} />
                                {t('playlist.shufflePlay')}
                            </button>

                            <button className="luniq-dropdown-item" onClick={() => { if (tracks.length > 0) onAddToQueue?.(tracks); }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
                                {t('playlist.addAllToQueue')}
                            </button>

                            <button className="luniq-dropdown-item" onClick={() => { if (tracks.length > 0) onPlayNext?.(tracks); }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M13 12H3M13 6H3M13 18H3" />
                                    <path d="M17 8l5 4-5 4V8z" />
                                </svg>
                                {t('playlist.playNext')}
                            </button>

                            {playlist?.isAlbum && (
                                <button className="luniq-dropdown-item" onClick={() => toggleLibrary()}>
                                    {isInLibrary ? (
                                        <>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="12" cy="12" r="10"></circle>
                                                <polyline points="8 12 11 15 16 9"></polyline>
                                            </svg>
                                            {t('playlist.removeFromSpotify')}
                                        </>
                                    ) : (
                                        <>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="12" cy="12" r="10"></circle>
                                                <line x1="12" y1="8" x2="12" y2="16"></line>
                                                <line x1="8" y1="12" x2="16" y2="12"></line>
                                            </svg>
                                            {t('playlist.saveToSpotify')}
                                        </>
                                    )}
                                </button>
                            )}

                            {!playlist?.isLocal && !playlistId.startsWith('local-') && playlistId !== 'liked-songs' && (
                                <button 
                                    className="luniq-dropdown-item" 
                                    onClick={() => toggleLocalLibrary()}
                                    disabled={loading}
                                    style={{ opacity: loading ? 0.5 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
                                >
                                    {isInLocalLibrary ? (
                                        <>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" fill="currentColor"></path>
                                            </svg>
                                            {t('playlist.removeFromLibrary')}
                                        </>
                                    ) : (
                                        <>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                                            </svg>
                                            {loading ? t('home.loading') : t('playlist.saveToLibrary')}
                                        </>
                                    )}
                                </button>
                            )}

                            {playlist?.isLocal && playlistId !== 'local-favorites' && (
                                <>
                                    <div className="luniq-dropdown-divider" />
                                    <button className="luniq-dropdown-item" onClick={() => setShowEditModal(true)}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                        {t('playlist.editDetails')}
                                    </button>
                                    <button className="luniq-dropdown-item danger" style={{ color: '#dc2626' }} onClick={async () => {
                                        try {
                                            const idToDelete = playlistId;
                                            setPlaylist(null);
                                            setError('Playlist deleted');
                                            await window.ipcRenderer.invoke('delete-playlist', idToDelete);
                                            window.dispatchEvent(new Event('luniq:playlist-update'));
                                            onBack();
                                        } catch (e) {
                                            console.error("Failed to delete playlist", e);
                                        }
                                    }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                                        {t('playlist.deletePlaylist')}
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="track-list">
                <div className="track-row header">
                    <div className="track-index">#</div>
                    <div>{t('playlist.title')}</div>
                    <div>{t('playlist.album')}</div>
                    <div>{t('playlist.dateAdded')}</div>
                    <div style={{ width: '40px' }}></div> {}
                    <div className="track-duration">
                        <svg role="img" height="16" width="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8z"></path>
                            <path d="M8 3.25a.75.75 0 0 1 .75.75v3.25H11a.75.75 0 0 1 0 1.5H7.25V4A.75.75 0 0 1 8 3.25z"></path>
                        </svg>
                    </div>
                </div>

                {tracks.length > 0 && scrollParent && (
                    <Virtuoso
                        customScrollParent={scrollParent}
                        data={tracks}
                        overscan={400}
                        itemContent={(index, item: LuniqTrack) => {
                    const isActive = currentTrackId === item.id;
                    return (
                        <div
                            className={`track-row ${isActive ? 'active' : ''} ${trackMenu === item.id ? 'menu-open' : ''}`}
                            onClick={() => onTrackSelect?.(item, tracks)}
                            onContextMenu={(e) => { e.preventDefault(); handleTrackMenuClick(e, item.id); }}
                        >
                            <div className="track-index">
                                {isActive ? (
                                    <div className="playing-animation">
                                        <div className="bar bar1"></div>
                                        <div className="bar bar2"></div>
                                        <div className="bar bar3"></div>
                                    </div>
                                ) : (
                                    index + 1
                                )}
                            </div>
                            <div className="track-title-col">
                                <img src={item.albumArt || 'placeholder.png'} className="track-img" alt="" loading="lazy" />
                                <div className="track-text">
                                    <span className="track-name" style={{ display: 'flex', alignItems: 'center' }}>
                                        {item.name}
                                        <DownloadIndicator trackId={item.id} />
                                    </span>
                                    <span className="track-artist">
                                        {item.artists.map((artist: any, i: number) => (
                                            <React.Fragment key={i}>
                                                <span 
                                                    onClick={(e) => {
                                                        if (onArtistSelect) {
                                                            e.stopPropagation();
                                                            onArtistSelect(artist.id, artist.name);
                                                        }
                                                    }}
                                                    style={{ cursor: onArtistSelect ? 'pointer' : 'default', textDecoration: 'none' }}
                                                    onMouseOver={(e) => { if (onArtistSelect) e.currentTarget.style.textDecoration = 'underline'; }}
                                                    onMouseOut={(e) => { if (onArtistSelect) e.currentTarget.style.textDecoration = 'none'; }}
                                                >
                                                    {artist.name || artist}
                                                </span>
                                                {i < item.artists.length - 1 && ', '}
                                            </React.Fragment>
                                        ))}
                                    </span>
                                </div>
                            </div>
                            <div className="track-album">{item.albumName}</div>
                            <div className="track-date">{item.addedAt ? new Date(item.addedAt).toLocaleDateString() : ''}</div>
                            <div className="track-context-menu" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                                    <button className="track-dots-btn" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleTrackMenuClick(e, item.id); }} title={t('playlist.more')}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                            <circle cx="12" cy="5" r="2" />
                                            <circle cx="12" cy="12" r="2" />
                                            <circle cx="12" cy="19" r="2" />
                                        </svg>
                                    </button>
                            </div>
                            <div className="track-duration">{formatDuration(item.durationMs)}</div>
                        </div>
                    );
                        }}
                    />
                )}

                {}
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
                    >
                        <button className="luniq-dropdown-item" onClick={() => { onPlayNext?.(menuTrack); setTrackMenu(null); }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M13 12H3M13 6H3M13 18H3" />
                                <path d="M17 8l5 4-5 4V8z" />
                            </svg>
                            {t('playlist.playNext')}
                        </button>
                        <button className="luniq-dropdown-item" onClick={() => { onAddToQueue?.(menuTrack); setTrackMenu(null); }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
                            {t('playlist.addToQueue')}
                        </button>
                        {menuFavoriteState !== null && (
                            <button className="luniq-dropdown-item" onClick={() => { handleToggleFavorite(menuTrack); setTrackMenu(null); }}>
                                {menuFavoriteState ? (
                                    <>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                                        </svg>
                                        {t('playlist.removeFromFavorites')}
                                    </>
                                ) : (
                                    <>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.84-8.84 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                                        </svg>
                                        {t('playlist.saveToFavorites')}
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
                                {menuDownloadState ? t('playlist.removeDownload') : t('playlist.download')}
                            </button>
                        )}
                        {playlist.isLocal && playlistId !== 'local-favorites' && (
                            <button className="luniq-dropdown-item danger" onClick={() => handleRemoveFromPlaylist(menuTrack.id)}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                                {t('playlist.removeFromPlaylist')}
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
                            {t('playlist.addToLocalPlaylist')}
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
                                    <div className="luniq-dropdown-item disabled" style={{ opacity: 0.5, cursor: 'default' }}>{t('playlist.noLocalPlaylists')}</div>
                                )}
                            </div>
                        )}
                    </div>,
                    document.body
                )}

                {tracks.length === 0 && (
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
                        <span style={{ fontSize: '14px', fontWeight: 500 }}>
                            {playlist?.isLocal ? t('playlist.emptyPlaylist') : t('playlist.noTracks')}
                        </span>
                        {playlist?.isLocal && (
                            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.15)' }}>
                                {t('playlist.addSongs')}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {}
            {playlist.isAlbum && artistAlbums.length > 0 && (
                <div className="playlist-more-by">
                    <div className="more-by-header">
                        <h2>{t('playlist.moreBy')} {playlist.ownerName}</h2>
                    </div>
                    <div className="more-by-grid">
                        {artistAlbums.map((album) => (
                            <div
                                key={album.id}
                                className="more-by-card"
                                onClick={() => onPlaylistSelect?.(album.id, true)}
                            >
                                <div className="card-image-wrapper">
                                    <img src={album.images?.[0]?.url || 'placeholder.png'} alt={album.name} loading="lazy" />
                                </div>
                                <div className="card-info">
                                    <span className="card-name">{album.name}</span>
                                    <span className="card-year">{album.year}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {}
            {showEditModal && playlist?.isLocal && (
                <CreatePlaylistModal
                    onClose={() => setShowEditModal(false)}
                    editData={{
                        name: playlist.name,
                        description: playlist.description || '',
                        artwork: playlist.coverUrl || null,
                    }}
                    onCreate={async (updated) => {
                                          
                        try {
                            await window.ipcRenderer.invoke('update-playlist', {
                                id: playlistId,
                                name: updated.name,
                                description: updated.description,
                                artwork: updated.artwork
                            });
                            window.dispatchEvent(new Event('luniq:playlist-update'));
                        } catch (e) {
                            console.error("Failed to update playlist", e);
                        }

                        
                        setPlaylist((prev: any) => ({
                            ...prev,
                            name: updated.name,
                            description: updated.description,
                            coverUrl: updated.artwork || '',
                        }));
                        setShowEditModal(false);
                    }}
                />
            )}
            {showPreview && previewTracks.length > 0 && (
                <PreviewCarousel
                    tracks={previewTracks}
                    onClose={() => setShowPreview(false)}
                    playlistName={playlist?.name}
                />
            )}
        </div>
    );
};

export default Playlist;
