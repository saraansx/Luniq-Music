import React from 'react';
import './QueueView.css';





import { usePlayer } from '../../context/PlayerContext';
import { DownloadIndicator } from '../DownloadIndicator/DownloadIndicator';
import { ALBUM_PLACEHOLDER } from '../../constants/assets';
import { useLanguage } from '../../context/LanguageContext';
import { formatDuration } from '../../utils/format';

const QueueView: React.FC<{ onClose: () => void; onArtistSelect?: (id: string | null, name: string) => void }> = ({ 
    onClose, 
    onArtistSelect
}) => {
    const {
        queue,
        currentTrack,
        history,
        autoplayQueue,
        isRadioLoading,
        handleTrackSelect: onTrackSelect,
        clearQueue,
        clearHistory: onClearHistory,
        handleRemoveFromQueue: onRemoveFromQueue,
        handlePlayNext,
        handleAddToQueue
    } = usePlayer();
    const { t } = useLanguage();

    const onClearQueue = () => clearQueue();
    const [isClosing, setIsClosing] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState<'queue' | 'history'>('queue');
    const [contextMenu, setContextMenu] = React.useState<{ id: string, x: number, y: number, isBottom: boolean } | null>(null);
    const menuRef = React.useRef<HTMLDivElement | null>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setContextMenu(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleMenuClick = (e: React.MouseEvent, itemId: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (contextMenu?.id === itemId) {
            setContextMenu(null);
        } else {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const menuHeight = 120; 
            const isBottom = spaceBelow < menuHeight;
            setContextMenu({
                id: itemId,
                x: rect.left,
                y: isBottom ? rect.top : rect.bottom,
                isBottom
            });
        }
    };

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
        }, 300); 
    };




    return (
        <div className={`queue-panel ${isClosing ? 'closing' : ''}`}>
            <div className="queue-header">
                <div className="queue-tabs">
                    <button 
                        className={`queue-tab ${activeTab === 'queue' ? 'active' : ''}`}
                        onClick={() => setActiveTab('queue')}
                    >
                        {t('queue.queue')}
                    </button>
                    <button 
                        className={`queue-tab ${activeTab === 'history' ? 'active' : ''}`}
                        onClick={() => setActiveTab('history')}
                    >
                        {t('queue.recentlyPlayed')}
                    </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button className="close-queue" onClick={handleClose}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            </div>

            <div className="queue-content">
                {activeTab === 'queue' ? (
                    <>
                        {currentTrack && (
                            <div className="queue-section">
                                <h3 className="section-title">{t('queue.nowPlaying')}</h3>
                                <div className="queue-item playing">
                                    <img src={currentTrack.albumArt || ALBUM_PLACEHOLDER} alt="" className="queue-track-art" loading="lazy" />
                                    <div className="queue-track-info">
                                        <span className="queue-track-name" style={{ display: 'flex', alignItems: 'center' }}>
                                            {currentTrack.name}
                                            <DownloadIndicator trackId={currentTrack.id} />
                                        </span>
                                            <div className="queue-track-artist-container">
                                                {currentTrack.artists && currentTrack.artists.length > 0 ? (
                                                    currentTrack.artists.map((artist: any, i: number, arr: any[]) => (
                                                        <React.Fragment key={(artist.id || artist.name) + i}>
                                                            <span 
                                                                className="queue-track-artist"
                                                                onClick={(e) => {
                                                                    if (onArtistSelect) {
                                                                        e.stopPropagation();
                                                                        onArtistSelect(artist.id, artist.name);
                                                                    }
                                                                }}
                                                                style={{ cursor: onArtistSelect ? 'pointer' : 'default' }}
                                                            >
                                                                {artist.name}
                                                            </span>
                                                            {i < arr.length - 1 && <span className="artist-separator">, </span>}
                                                        </React.Fragment>
                                                    ))
                                                ) : (
                                                    currentTrack.artist.split(', ').map((artistName: string, i: number, arr: string[]) => (
                                                        <React.Fragment key={artistName + i}>
                                                            <span 
                                                                className="queue-track-artist"
                                                                onClick={(e) => {
                                                                    if (onArtistSelect) {
                                                                        e.stopPropagation();
                                                                        onArtistSelect(null, artistName);
                                                                    }
                                                                }}
                                                                style={{ cursor: onArtistSelect ? 'pointer' : 'default' }}
                                                            >
                                                                {artistName}
                                                            </span>
                                                            {i < arr.length - 1 && <span className="artist-separator">, </span>}
                                                        </React.Fragment>
                                                    ))
                                                )}
                                            </div>
                                    </div>
                                    {currentTrack.durationMs > 0 && <span className="queue-track-duration">{formatDuration(currentTrack.durationMs)}</span>}
                                </div>
                            </div>
                        )}

                        <div className="queue-section">
                            <h3 className="section-title">{t('queue.nextInQueue')}</h3>
                            {queue.length > 0 ? (
                                queue.map((track, index) => (
                                    <div 
                                        key={`queue-${track.id}-${index}`} 
                                        className="queue-item"
                                        onClick={() => onTrackSelect(track)}
                                        onContextMenu={(e) => handleMenuClick(e, `queue-${track.id}-${index}`)}
                                    >
                                        <img src={track.albumArt || ALBUM_PLACEHOLDER} alt="" className="queue-track-art" loading="lazy" />
                                        <div className="queue-track-info">
                                            <span className="queue-track-name" style={{ display: 'flex', alignItems: 'center' }}>
                                                {track.name}
                                                <DownloadIndicator trackId={track.id} />
                                            </span>
                                            <div className="queue-track-artist-container">
                                                {track.artists && track.artists.length > 0 ? (
                                                    track.artists.map((artist: any, i: number, arr: any[]) => (
                                                        <React.Fragment key={(artist.id || artist.name) + i}>
                                                            <span 
                                                                className="queue-track-artist"
                                                                onClick={(e) => {
                                                                    if (onArtistSelect) {
                                                                        e.stopPropagation();
                                                                        onArtistSelect(artist.id, artist.name);
                                                                    }
                                                                }}
                                                                style={{ cursor: onArtistSelect ? 'pointer' : 'default' }}
                                                            >
                                                                {artist.name}
                                                            </span>
                                                            {i < arr.length - 1 && <span className="artist-separator">, </span>}
                                                        </React.Fragment>
                                                    ))
                                                ) : (
                                                    track.artist.split(', ').map((artistName: string, i: number, arr: string[]) => (
                                                        <React.Fragment key={artistName + i}>
                                                            <span 
                                                                className="queue-track-artist"
                                                                onClick={(e) => {
                                                                    if (onArtistSelect) {
                                                                        e.stopPropagation();
                                                                        onArtistSelect(null, artistName);
                                                                    }
                                                                }}
                                                                style={{ cursor: onArtistSelect ? 'pointer' : 'default' }}
                                                            >
                                                                {artistName}
                                                            </span>
                                                            {i < arr.length - 1 && <span className="artist-separator">, </span>}
                                                        </React.Fragment>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                        <div className="queue-item-right">
                                            {track.durationMs > 0 && <span className="queue-track-duration">{formatDuration(track.durationMs)}</span>}
                                            <button 
                                                className="remove-track-btn" 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onRemoveFromQueue(index);
                                                }}
                                                title={t('queue.removeFromQueue')}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="queue-empty">
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.2, marginBottom: '8px' }}>
                                        <line x1="8" y1="6" x2="21" y2="6"></line>
                                        <line x1="8" y1="12" x2="21" y2="12"></line>
                                        <line x1="8" y1="18" x2="21" y2="18"></line>
                                        <line x1="3" y1="6" x2="3.01" y2="6"></line>
                                        <line x1="3" y1="12" x2="3.01" y2="12"></line>
                                        <line x1="3" y1="18" x2="3.01" y2="18"></line>
                                    </svg>
                                    <p style={{ fontSize: '0.8rem', opacity: 0.5 }}>{t('queue.emptyQueue')}</p>
                                </div>
                            )}
                        </div>
                        {queue.length > 0 && (
                            <div className="queue-footer">
                                <button className="clear-queue-btn" onClick={onClearQueue}>{t('queue.clearQueue')}</button>
                            </div>
                        )}

                        {autoplayQueue.length > 0 && (
                            <div className="queue-section autoplay-section">
                                <div className="autoplay-divider">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.5 }}>
                                        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8zm-1-5h2v2h-2zm0-8h2v6h-2z"/>
                                    </svg>
                                    <h3 className="section-title" style={{ margin: 0 }}>Next in Autoplay</h3>
                                    {isRadioLoading && (
                                        <span className="autoplay-loading-dot" />
                                    )}
                                </div>
                                {autoplayQueue.map((track, index) => (
                                    <div
                                        key={`autoplay-${track.id}-${index}`}
                                        className="queue-item autoplay-item"
                                        onClick={() => onTrackSelect(track)}
                                    >
                                        <img src={track.albumArt || ALBUM_PLACEHOLDER} alt="" className="queue-track-art" loading="lazy" />
                                        <div className="queue-track-info">
                                            <span className="queue-track-name">{track.name}</span>
                                            <span className="queue-track-artist">{track.artist}</span>
                                        </div>
                                        {track.durationMs > 0 && <span className="queue-track-duration">{formatDuration(track.durationMs)}</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="queue-section">
                        <h3 className="section-title">{t('queue.recentlyPlayed')}</h3>
                        {history.length > 0 ? (
                            history.map((track, index) => (
                                <div 
                                    key={`history-${track.id}-${index}`} 
                                    className="queue-item"
                                    onClick={() => onTrackSelect(track)}
                                    onContextMenu={(e) => handleMenuClick(e, `history-${track.id}-${index}`)}
                                >
                                    <img src={track.albumArt || ALBUM_PLACEHOLDER} alt="" className="queue-track-art" loading="lazy" />
                                    <div className="queue-track-info">
                                        <span className="queue-track-name" style={{ display: 'flex', alignItems: 'center' }}>
                                            {track.name}
                                            <DownloadIndicator trackId={track.id} />
                                        </span>
                                        <div className="queue-track-artist-container">
                                            {track.artists && track.artists.length > 0 ? (
                                                track.artists.map((artist: any, i: number, arr: any[]) => (
                                                    <React.Fragment key={(artist.id || artist.name) + i}>
                                                        <span 
                                                            className="queue-track-artist"
                                                            onClick={(e) => {
                                                                if (onArtistSelect) {
                                                                    e.stopPropagation();
                                                                    onArtistSelect(artist.id, artist.name);
                                                                }
                                                            }}
                                                            style={{ cursor: onArtistSelect ? 'pointer' : 'default' }}
                                                        >
                                                            {artist.name}
                                                        </span>
                                                        {i < arr.length - 1 && <span className="artist-separator">, </span>}
                                                    </React.Fragment>
                                                ))
                                            ) : (
                                                track.artist.split(', ').map((artistName: string, i: number, arr: string[]) => (
                                                    <React.Fragment key={artistName + i}>
                                                        <span 
                                                            className="queue-track-artist"
                                                            onClick={(e) => {
                                                                if (onArtistSelect) {
                                                                    e.stopPropagation();
                                                                    onArtistSelect(null, artistName);
                                                                }
                                                            }}
                                                            style={{ cursor: onArtistSelect ? 'pointer' : 'default' }}
                                                        >
                                                            {artistName}
                                                        </span>
                                                        {i < arr.length - 1 && <span className="artist-separator">, </span>}
                                                    </React.Fragment>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                    <div className="queue-item-right">
                                        {track.durationMs > 0 && <span className="queue-track-duration">{formatDuration(track.durationMs)}</span>}
                                        <div className="history-actions" ref={contextMenu?.id === `history-${track.id}-${index}` ? menuRef : null}>
                                            <button 
                                                className={`more-btn ${contextMenu?.id === `history-${track.id}-${index}` ? 'active' : ''}`}
                                                onClick={(e) => handleMenuClick(e, `history-${track.id}-${index}`)}
                                                title={t('queue.moreOptions')}
                                            >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                                    <circle cx="12" cy="5" r="2" />
                                                    <circle cx="12" cy="12" r="2" />
                                                    <circle cx="12" cy="19" r="2" />
                                                </svg>
                                            </button>
                                            {contextMenu?.id === `history-${track.id}-${index}` && (
                                                <div 
                                                    className={`lune-dropdown history-dropdown ${contextMenu.isBottom ? 'open-up' : 'open-down'}`}
                                                    style={{
                                                        position: 'fixed',
                                                        top: contextMenu.isBottom ? 'auto' : `${contextMenu.y + 8}px`,
                                                        bottom: contextMenu.isBottom ? `${window.innerHeight - contextMenu.y + 8}px` : 'auto',
                                                        right: '48px',
                                                        left: 'auto',
                                                        width: '180px',
                                                        zIndex: 1000
                                                    }}
                                                >
                                                    <button className="lune-dropdown-item" onClick={(e) => {
                                                        e.stopPropagation();
                                                        handlePlayNext(track);
                                                        setContextMenu(null);
                                                    }}>
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M13 12H3M13 6H3M13 18H3" />
                                                            <path d="M17 8l5 4-5 4V8z" />
                                                        </svg>
                                                        {t('queue.playNext')}
                                                    </button>
                                                    <button className="lune-dropdown-item" onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleAddToQueue(track);
                                                        setContextMenu(null);
                                                    }}>
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
                                                        {t('queue.addToQueue')}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="queue-empty">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.2, marginBottom: '8px' }}>
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="12 6 12 12 16 14"></polyline>
                                </svg>
                                <p style={{ fontSize: '0.8rem', opacity: 0.5 }}>{t('queue.noRecent')}</p>
                            </div>
                        )}
                        {history.length > 0 && (
                            <div className="queue-footer">
                                <button className="clear-queue-btn" onClick={onClearHistory}>{t('queue.clearHistory')}</button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default QueueView;
