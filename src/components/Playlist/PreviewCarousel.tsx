import React, { useState, useRef, useCallback, useEffect } from 'react';
import './PreviewCarousel.css';

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
}

const PreviewCarousel: React.FC<PreviewCarouselProps> = ({ tracks, onClose }) => {
    const [activeIndex, setActiveIndex] = useState<number>(-1);
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [progress, setProgress] = useState(0);
    const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);

    const stopPlayback = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
        if (progressInterval.current) {
            clearInterval(progressInterval.current);
            progressInterval.current = null;
        }
        setIsPlaying(false);
        setProgress(0);
    }, []);

    const playPreview = useCallback((track: PreviewTrack, index: number) => {
        if (activeIndex === index && isPlaying) {
            stopPlayback();
            setActiveIndex(-1);
            return;
        }

        stopPlayback();
        setActiveIndex(index);

        if (!track.previewUrl) return;

        const audio = new Audio(track.previewUrl);
        audio.volume = 0.8;
        audioRef.current = audio;

        audio.addEventListener('loadedmetadata', () => {
            setIsPlaying(true);
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
                setTimeout(() => playPreview(tracks[nextIndex], nextIndex), 300);
            }
        });

        audio.play().catch(() => {
            console.warn('[PreviewCarousel] Failed to play preview');
            stopPlayback();
        });
    }, [activeIndex, isPlaying, stopPlayback, tracks]);

    useEffect(() => {
        return () => {
            stopPlayback();
        };
    }, [stopPlayback]);

    const scrollToCard = (direction: 'left' | 'right') => {
        if (scrollRef.current) {
            const scrollAmount = 200;
            scrollRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth',
            });
        }
    };

    return (
        <div className="preview-carousel-overlay" onClick={onClose}>
            <div className="preview-carousel-container" onClick={(e) => e.stopPropagation()}>
                <div className="preview-carousel-header">
                    <div className="preview-carousel-title">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                        </svg>
                        Scroll through previews
                    </div>
                    <button className="preview-carousel-close" onClick={onClose}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                        </svg>
                    </button>
                </div>

                <div className="preview-carousel-scroll-wrapper">
                    <button
                        className="preview-carousel-nav preview-carousel-nav-left"
                        onClick={() => scrollToCard('left')}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
                        </svg>
                    </button>

                    <div className="preview-carousel-track" ref={scrollRef}>
                        {tracks.map((track, index) => (
                            <div
                                key={track.id}
                                className={`preview-card ${activeIndex === index ? 'active' : ''} ${!track.previewUrl ? 'no-preview' : ''}`}
                                onClick={() => track.previewUrl && playPreview(track, index)}
                            >
                                <div className="preview-card-image-wrapper">
                                    {track.image ? (
                                        <img src={track.image} alt={track.name} className="preview-card-image" />
                                    ) : (
                                        <div className="preview-card-image preview-card-placeholder">
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="rgba(255,255,255,0.3)">
                                                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                                            </svg>
                                        </div>
                                    )}
                                    {activeIndex === index && isPlaying && (
                                        <div className="preview-card-playing">
                                            <div className="preview-eq-bar" />
                                            <div className="preview-eq-bar" />
                                            <div className="preview-eq-bar" />
                                        </div>
                                    )}
                                    {track.previewUrl && (
                                        <div className="preview-card-play-btn">
                                            {activeIndex === index && isPlaying ? (
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                                                </svg>
                                            ) : (
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M8 5v14l11-7z" />
                                                </svg>
                                            )}
                                        </div>
                                    )}
                                    {activeIndex === index && isPlaying && (
                                        <div className="preview-progress-bar">
                                            <div className="preview-progress-fill" style={{ width: `${progress}%` }} />
                                        </div>
                                    )}
                                </div>
                                <div className="preview-card-info">
                                    <div className="preview-card-name">{track.name}</div>
                                    {track.artists && track.artists.length > 0 && (
                                        <div className="preview-card-artist">{track.artists.join(', ')}</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    <button
                        className="preview-carousel-nav preview-carousel-nav-right"
                        onClick={() => scrollToCard('right')}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PreviewCarousel;
