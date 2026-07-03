import React, { useState, useRef, useCallback, useEffect } from 'react';
import './PreviewCarousel.css';
import { useApi } from '../../context/ApiContext';

interface PreviewTrack {
    id: string;
    name: string;
    uri: string;
    image?: string;
    artists?: string[];
    previewUrl?: string;
    duration?: number;
}

interface PreviewCarouselProps {
    tracks: PreviewTrack[];
    onClose: () => void;
    playlistName?: string;
}

const PreviewCarousel: React.FC<PreviewCarouselProps> = ({ tracks, onClose, playlistName }) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    const [canvasUrls, setCanvasUrls] = useState<Record<string, string>>({});
    const api = useApi();

    const currentTrack = tracks[activeIndex];

    const stopPlayback = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
        if (progressInterval.current) {
            clearInterval(progressInterval.current);
            progressInterval.current = null;
        }
        setProgress(0);
    }, []);

    const playPreview = useCallback((index: number) => {
        const track = tracks[index];
        if (!track.previewUrl) return;

        stopPlayback();

        const audio = new Audio(track.previewUrl);
        audio.volume = 0.8;
        audioRef.current = audio;

        audio.addEventListener('loadedmetadata', () => {
            progressInterval.current = setInterval(() => {
                if (audioRef.current) {
                    setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
                }
            }, 100);
        });

        audio.addEventListener('ended', () => {
            stopPlayback();
            const nextIndex = index + 1;
            if (nextIndex < tracks.length && tracks[nextIndex].previewUrl) {
                setTimeout(() => {
                    setActiveIndex(nextIndex);
                }, 300);
            }
        });

        audio.play().catch(() => {
            console.warn('[PreviewCarousel] Failed to play preview');
            stopPlayback();
        });
    }, [tracks, stopPlayback]);

    useEffect(() => {
        return () => {
            stopPlayback();
        };
    }, [stopPlayback]);

    useEffect(() => {
        if (currentTrack?.previewUrl) {
            playPreview(activeIndex);
        }
        return () => {
            stopPlayback();
        };
    }, [activeIndex]);

    useEffect(() => {
        const fetchCanvases = async () => {
            for (const track of tracks) {
                if (canvasUrls[track.id]) continue;
                try {
                    const data = await api.track.getCanvas(track.id);
                    const canvas = data?.canvas || data?.trackUnion?.canvas;
                    if (canvas?.url) {
                        setCanvasUrls(prev => ({ ...prev, [track.id]: canvas.url }));
                    }
                } catch {
                    // Track may not have canvas
                }
            }
        };
        fetchCanvases();
    }, [tracks]);

    const goNext = () => {
        if (activeIndex < tracks.length - 1) {
            setActiveIndex(prev => prev + 1);
        }
    };

    const goPrev = () => {
        if (activeIndex > 0) {
            setActiveIndex(prev => prev - 1);
        }
    };

    const isFirst = activeIndex === 0;
    const isLast = activeIndex === tracks.length - 1;

    if (!currentTrack) return null;

    return (
        <div className="preview-overlay">
            <div className="preview-container">
                {/* Close button top right */}
                <button className="preview-close-btn" onClick={onClose}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                    </svg>
                </button>

                <div className="preview-layout">
                    {/* Ambient blurred background */}
                    {currentTrack.image && (
                        <div
                            className="preview-ambient-bg"
                            style={{ backgroundImage: `url(${currentTrack.image})` }}
                        />
                    )}

                    {/* Left panel */}
                    <div className="preview-left-panel">
                        <div className="preview-playlist-name">{playlistName || 'Playlist'}</div>

                        <div className="preview-track-info">
                            <div className="preview-track-name">{currentTrack.name}</div>
                            {currentTrack.artists && currentTrack.artists.length > 0 && (
                                <div className="preview-track-artist">{currentTrack.artists.join(', ')}</div>
                            )}
                        </div>

                        <div className="preview-mini-player">
                            {currentTrack.image ? (
                                <img src={currentTrack.image} alt={currentTrack.name} className="preview-mini-artwork" />
                            ) : (
                                <div className="preview-mini-artwork preview-mini-placeholder">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(255,255,255,0.3)">
                                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                                    </svg>
                                </div>
                            )}
                            <div className="preview-mini-progress-track">
                                <div className="preview-mini-progress-fill" style={{ width: `${progress}%` }} />
                            </div>
                        </div>
                    </div>

                    {/* Right panel - Canvas / Video */}
                    <div className="preview-right-panel">
                        <div className="preview-canvas-glow" />
                        {canvasUrls[currentTrack.id] ? (
                            <video
                                src={canvasUrls[currentTrack.id]}
                                autoPlay
                                loop
                                muted
                                playsInline
                                className="preview-canvas-video"
                            />
                        ) : currentTrack.image ? (
                            <img src={currentTrack.image} alt={currentTrack.name} className="preview-canvas-image" />
                        ) : (
                            <div className="preview-canvas-placeholder">
                                <svg width="64" height="64" viewBox="0 0 24 24" fill="rgba(255,255,255,0.15)">
                                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                                </svg>
                            </div>
                        )}

                        {/* Navigation buttons */}
                        <div className="preview-nav-buttons">
                            {isFirst ? (
                                <button className="preview-next-btn" onClick={goNext}>
                                    Next
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
                                    </svg>
                                </button>
                            ) : (
                                <>
                                    {!isFirst && (
                                        <button className="preview-arrow-btn" onClick={goPrev}>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
                                            </svg>
                                        </button>
                                    )}
                                    {!isLast && (
                                        <button className="preview-arrow-btn" onClick={goNext}>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
                                            </svg>
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Track counter dots */}
                <div className="preview-dots">
                    {tracks.slice(Math.max(0, activeIndex - 4), Math.min(tracks.length, activeIndex + 5)).map((track, i) => {
                        const actualIndex = Math.max(0, activeIndex - 4) + i;
                        return (
                            <div
                                key={track.id}
                                className={`preview-dot ${actualIndex === activeIndex ? 'active' : ''}`}
                                onClick={() => setActiveIndex(actualIndex)}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default PreviewCarousel;
