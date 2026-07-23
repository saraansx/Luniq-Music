
import React, { useEffect, useState, useRef } from 'react';
import './LyricsView.css';
import { usePlayer } from '../../context/PlayerContext';
import { useLanguage } from '../../context/LanguageContext';
import { parseSyncedLyrics, LyricLine } from '../../services/lyrics/parser';
import { fetchLyricsSmart as fetchLyrics } from '../../services/lyricshelper';

const LyricsView: React.FC = () => {
    const { 
        currentTrack, 
        showLyrics, 
        setShowLyrics 
    } = usePlayer();
    const { t } = useLanguage();
    
    const [lyrics, setLyrics] = useState<LyricLine[]>([]);
    const [isSynced, setIsSynced] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleTimeUpdate = (e: Event) => {
            const customEvent = e as CustomEvent;
            setCurrentTime(customEvent.detail.currentTime);
        };
        window.addEventListener('luniq:timeupdate', handleTimeUpdate);
        return () => window.removeEventListener('luniq:timeupdate', handleTimeUpdate);
    }, []);
    
    useEffect(() => {
        if (!currentTrack) return;

        const getLyrics = async () => {
            setLoading(true);
            setError(null);
            setLyrics([]);
            setIsSynced(false);
            
            const data = await fetchLyrics(
                currentTrack.name, 
                currentTrack.artist, 
                currentTrack.durationMs ? currentTrack.durationMs / 1000 : undefined,
                undefined,
                currentTrack.id
            );

            if (data) {
                if (data.syncedLyrics) {
                    const mainLines = parseSyncedLyrics(data.syncedLyrics);
                    const romLines = data.romanizedLyrics ? parseSyncedLyrics(data.romanizedLyrics) : [];
                    const merged = mainLines.map(line => {
                        const matchingRom = romLines.find(r => Math.abs(r.time - line.time) < 0.8);
                        const hasNonLatin = /[^\x00-\x7F]/.test(line.text);
                        return {
                            ...line,
                            romanizedText: (hasNonLatin && matchingRom && matchingRom.text !== line.text) ? matchingRom.text : undefined
                        };
                    });
                    setLyrics(merged);
                    setIsSynced(true);
                } else if (data.plainLyrics) {
                    const mainLines = data.plainLyrics.split('\n');
                    const romLines = data.romanizedLyrics ? data.romanizedLyrics.split('\n') : [];
                    const merged = mainLines.map((text, idx) => {
                        const matchingRom = romLines[idx];
                        const hasNonLatin = /[^\x00-\x7F]/.test(text);
                        return {
                            time: 0,
                            text,
                            romanizedText: (hasNonLatin && matchingRom && matchingRom !== text) ? matchingRom : undefined
                        };
                    });
                    setLyrics(merged);
                    setIsSynced(false);
                } else {
                    setError(t('lyrics.notFound'));
                }
            } else {
                setError(t('lyrics.notFound'));
            }
            setLoading(false);
        };

        getLyrics();
    }, [currentTrack?.id]);

    let activeIndex = -1;
    if (isSynced && lyrics.length > 0) {
        for (let i = 0; i < lyrics.length; i++) {
            if (currentTime >= lyrics[i].time) {
                activeIndex = i;
            } else {
                break;
            }
        }
    }

    useEffect(() => {
        if (isSynced && activeIndex !== -1 && scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            const activeEl = container.querySelector(
                `[data-index="${activeIndex}"]`
            ) as HTMLElement;
            if (activeEl) {
                const containerRect = container.getBoundingClientRect();
                const elRect = activeEl.getBoundingClientRect();
                const targetScrollTop =
                    container.scrollTop +
                    (elRect.top - containerRect.top) -
                    containerRect.height / 2 +
                    elRect.height / 2;
                container.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
            }
        }
    }, [activeIndex, isSynced]);

    if (!showLyrics) return null;

    return (
        <div className={`lyrics-view-overlay ${showLyrics ? 'active' : ''}`}>
            <div 
                className="lyrics-background-blur" 
                style={{ backgroundImage: `url(${currentTrack?.albumArt})` }}
            />
            
            <div className="lyrics-header">
                <div className="track-info">
                    <img src={currentTrack?.albumArt} alt="" className="mini-art" />
                    <div className="text">
                        <span className="name">{currentTrack?.name}</span>
                        <span className="artist">{currentTrack?.artist}</span>
                    </div>
                </div>
                <button className="close-lyrics-btn" onClick={() => setShowLyrics(false)}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>

            <div className="lyrics-content" ref={scrollContainerRef}>
                {loading && <div className="lyrics-status">{t('lyrics.searching')}</div>}
                {error && <div className="lyrics-status">{error}</div>}
                
                {lyrics.length > 0 && (
                    <div className="lyrics-container">
                        {lyrics.map((line, index) => {
                            const isActive = index === activeIndex;
                            const hasRom = !!line.romanizedText;
                            return (
                                <div 
                                    key={index} 
                                    data-index={index}
                                    className={isSynced ? `lyric-line ${isActive ? 'active' : ''} ${hasRom ? 'has-romanized' : ''}` : `lyric-line-static ${hasRom ? 'has-romanized' : ''}`}
                                >
                                    <div className="lyric-main-text">{line.text}</div>
                                    {hasRom && <div className="lyric-romanized-text">{line.romanizedText}</div>}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            
            <div className="lyrics-footer-gradient" />
        </div>
    );
};

export default LyricsView;
