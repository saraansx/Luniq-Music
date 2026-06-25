import React, { useEffect, useState } from 'react';
import './NowPlayingView.css';
import { useApi } from '../../context/ApiContext';
import { useLanguage } from '../../context/LanguageContext';

import { formatMonthlyListeners } from '../../utils/format';

interface ArtistInfo {
    name: string;
    image: string;
    monthlyListeners?: string;
    bio?: string;
    isVerified?: boolean;
}

import { usePlayer } from '../../context/PlayerContext';

const NowPlayingView: React.FC<{ 
    accessToken: string; 
    cookies: any; 
    isFullscreen?: boolean;
    onArtistSelect?: (id: string | null, name: string) => void;
    onPlaylistSelect?: (id: string, isAlbum?: boolean) => void;
}> = ({ accessToken, cookies: _cookies, isFullscreen, onArtistSelect, onPlaylistSelect }) => {
    const {
        currentTrack,
        showFullNowPlaying: isOpen,
        setShowFullNowPlaying
    } = usePlayer();
    const { t } = useLanguage();
    const api = useApi();

    const onClose = () => setShowFullNowPlaying(false);
    const [artistInfo, setArtistInfo] = useState<ArtistInfo | null>(null);
    const [canvasUrl, setCanvasUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!currentTrack || !accessToken) return;

        const fetchInfo = async () => {
            setLoading(true);
            setArtistInfo(null);
            setCanvasUrl(null);

            try {
                const gql = api;

                
                let artistId = currentTrack.artists?.[0]?.id;

                if (!artistId && currentTrack.id) {
                    
                    try {
                        const trackData = await gql.track.getTrack(currentTrack.id);
                        
                        if (trackData && trackData.firstArtist && trackData.firstArtist.items && trackData.firstArtist.items.length > 0) {
                            artistId = trackData.firstArtist.items[0].id; 
                        } else if (trackData && trackData.artists && trackData.artists.items && trackData.artists.items.length > 0) {
                            artistId = trackData.artists.items[0].id;
                        }
                    } catch (e) {
                        console.error("Failed to fetch track details for artist ID", e);
                    }
                }

                if (artistId) {
                    const artistData = await gql.artist.getArtist(artistId);
                    if (artistData) {
                        const profile = artistData.profile || {};
                        const stats = artistData.stats || {};
                        const visuals = artistData.visuals || {};

                        setArtistInfo({
                            name: profile.name || currentTrack.artist,
                            image: visuals.avatarImage?.sources?.[0]?.url || visuals.headerImage?.sources?.[0]?.url || '',
                            monthlyListeners: stats.monthlyListeners ? formatMonthlyListeners(stats.monthlyListeners) : undefined,
                            bio: profile.biography?.text || t('nowPlaying.noBio')
                        });
                    }
                }

                
                if (currentTrack.id) {
                    try {
                        const canvasData = await gql.track.getCanvas(currentTrack.id);
                        
                        const canvas = canvasData?.canvas || canvasData?.trackUnion?.canvas;
                        if (canvas && canvas.url) {
                            setCanvasUrl(canvas.url);
                        }
                    } catch (e) {
                        console.log("Track may not have a canvas available.");
                    }
                }

            } catch (err) {
                console.error("NowPlaying fetch error:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchInfo();
    }, [currentTrack?.id, accessToken]);


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

    return (
        <div className={`now-playing-panel ${isFullscreen ? 'fullscreen' : ''} ${isFullscreen && isOpen ? 'open' : ''}`}>
            {isFullscreen && currentTrack && (
                <div 
                    className="fullscreen-bg" 
                    style={{ backgroundImage: `url(${currentTrack.albumArt})` }}
                />
            )}

            <div className="np-header">
                <span className="np-header-title">
                    {isFullscreen ? t('nowPlaying.title') : (currentTrack?.name || t('nowPlaying.title'))}
                </span>
                
                {isFullscreen && onClose && (
                    <button className="np-close-btn" onClick={onClose} title={t('nowPlaying.close')}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                )}
            </div>

            {currentTrack ? (
                <div className={isFullscreen ? "fullscreen-content" : ""}>
                    <div className={isFullscreen ? "fullscreen-main-layout" : ""}>
                        <div className="np-visual-container">
                            {canvasUrl ? (
                                <video
                                    src={canvasUrl}
                                    autoPlay
                                    loop
                                    muted
                                    playsInline
                                    className="np-track-video"
                                />
                            ) : (
                                <img
                                    src={currentTrack.albumArt}
                                    alt={currentTrack.name}
                                    className="np-track-image"
                                />
                            )}
                        </div>
                        
                        <div className="np-details-column">
                            <div className="np-track-info">
                                <div className="np-track-title" title={currentTrack.name}>{currentTrack.name}</div>
                                <div className="np-track-artist-container">
                                    {currentTrack.artists && currentTrack.artists.length > 0 ? (
                                        currentTrack.artists.map((artist: any, i: number, arr: any[]) => (
                                            <React.Fragment key={(artist.id || artist.name) + i}>
                                                <span 
                                                    className="np-track-artist"
                                                    onClick={() => onArtistSelect?.(artist.id, artist.name)}
                                                    style={{ cursor: onArtistSelect ? 'pointer' : 'default' }}
                                                >
                                                    {artist.name}
                                                </span>
                                                {i < arr.length - 1 && <span className="artist-separator">, </span>}
                                            </React.Fragment>
                                        ))
                                    ) : (
                                        currentTrack.artist.split(', ').map((name: string, i: number, arr: string[]) => (
                                            <React.Fragment key={name + i}>
                                                <span 
                                                    className="np-track-artist"
                                                    onClick={() => onArtistSelect?.(null, name)}
                                                    style={{ cursor: onArtistSelect ? 'pointer' : 'default' }}
                                                >
                                                    {name}
                                                </span>
                                                {i < arr.length - 1 && <span className="artist-separator">, </span>}
                                            </React.Fragment>
                                        ))
                                    )}
                                </div>
                            </div>

                            {}
                            <div className="np-section">
                                <div className="np-section-title">{t('nowPlaying.aboutArtist')}</div>
                                {loading ? (
                                    <div className="loading-skeleton" />
                                ) : artistInfo ? (
                                    <>
                                        {artistInfo.image && (
                                            <div className="np-artist-header">
                                                <img src={artistInfo.image} alt={artistInfo.name} className="np-artist-bg" />
                                                <div className="np-artist-name-overlay">{artistInfo.name}</div>
                                            </div>
                                        )}
                                        {artistInfo.monthlyListeners && (
                                            <div className="np-monthly-listeners">
                                                <span>{artistInfo.monthlyListeners} {t('nowPlaying.monthlyListeners')}</span>
                                            </div>
                                        )}
                                        {artistInfo.bio && (
                                            <div
                                                className="np-artist-bio"
                                                dangerouslySetInnerHTML={{ __html: artistInfo.bio }}
                                                onClick={handleDescriptionClick}
                                            />
                                        )}
                                    </>
                                ) : (
                                    <div style={{ color: 'var(--text-dim)' }}>{t('nowPlaying.artistUnavailable')}</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="np-empty-state">
                    {t('nowPlaying.playTrack')}
                </div>
            )}

        </div>
    );
};

export default NowPlayingView;
