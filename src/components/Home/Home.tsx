
import { useEffect, useState, useMemo } from 'react';
import './Home.css';
import { useApi } from '../../context/ApiContext';
import type { BrowseSectionItem } from '../../../Plugin/gql/types/gql-api';

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
import { LuneTrack, normalizeTrack } from '../../types/track';
import { usePlayback } from '../../context/PlaybackContext';

interface HomeProps {
    accessToken: string;
    cookies: PlatformCookie[];
    onPlaylistSelect?: (id: string, isAlbum?: boolean) => void;
    onTrackViewSelect?: (trackInfo: { id: string; name: string; image: string; artists: string[] }) => void;
    onArtistSelect?: (id: string) => void;
}

const Home = ({ accessToken: _accessToken, cookies, onPlaylistSelect, onTrackViewSelect, onArtistSelect }: HomeProps) => {
    const { 
        handleTrackSelect: onTrackSelect
    } = usePlayer();
    const { lowDataMode } = usePlayback();
    const { t } = useLanguage();
    const [sections, setSections] = useState<BrowseSectionItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [activeSection, setActiveSection] = useState<{ id: string; title: string } | null>(null);
    const [sectionItems, setSectionItems] = useState<any[]>([]);

    const api = useApi();

    const [userName, setUserName] = useState<string>('');

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const profile = await api.user.me();
                if (profile?.display_name) {
                    setUserName(profile.display_name);
                }
            } catch (err) {
                console.error('Failed to fetch user profile for greeting:', err);
            }
        };
        fetchUser();
    }, [api]);

    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        let base = '';
        if (hour < 12) base = t('home.goodMorning');
        else if (hour < 18) base = t('home.goodAfternoon');
        else base = t('home.goodEvening');
        
        return userName ? `${base}, ${userName}` : base;
    }, [t, userName]);

    const fetchHomeData = async () => {
        try {
            setLoading(true);
            if (!cookies || !Array.isArray(cookies)) {
                throw new Error('No session cookies found. Please re-login.');
            }

            const spT = cookies.find(c => c.name === 'sp_t')?.value;

            if (!spT) {
                throw new Error('Spotify "sp_t" cookie not found. Please try logging in again.');
            }

            const data = await api.browse.home({
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                spTCookie: spT,
            });

            setSections(data);
        } catch (err: any) {
            console.error('Failed to fetch home data:', err);
            setError(err.message || 'Failed to load content');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!activeSection) {
            fetchHomeData();
        }
    }, [api, cookies, activeSection]);

    const handleShowAll = async (section: BrowseSectionItem) => {
        try {
            setLoading(true);
            setActiveSection({ id: section.id, title: section.title });

            const spT = cookies?.find(c => c.name === 'sp_t')?.value;
            if (!spT) throw new Error('No sp_t cookie');

            const data = await api.browse.homeSection(section.id, {
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                spTCookie: spT,
                limit: 50 
            });

            setSectionItems(data.items);
        } catch (err: any) {
            console.error('Failed to load section:', err);
            setError('Failed to load section content');
        } finally {
            setLoading(false);
        }
    };

    const handleBackToHome = () => {
        setActiveSection(null);
        setSectionItems([]);
        setError(null);
        
        
    };

    if (loading) {
        return (
            <div className="home-container">
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
            <div className="home-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
                <h2>{t('home.error')}</h2>
                <p>{error}</p>
                <button onClick={async () => {
                    if (activeSection) {
                        handleBackToHome();
                    } else {
                        
                        if (error && error.includes('401')) {
                            try {
                                console.log('Encountered 401, forcing token refresh...');
                                await window.ipcRenderer?.invoke('get-spotify-credentials', true);
                            } catch (e) {
                                console.error('Failed to force refresh:', e);
                            }
                        }
                        window.location.reload();
                    }
                }}>
                    {activeSection ? t('home.backToHome') : t('home.retry')}
                </button>
                {!activeSection && (
                    <button
                        style={{ marginTop: '16px', background: 'transparent', border: '1px solid #ffffff55' }}
                        onClick={async () => {
                            await window.ipcRenderer?.invoke('logout');
                            window.location.reload();
                        }}
                    >
                        {t('home.reLogin')}
                    </button>
                )}
            </div>
        );
    }

    const handleCardClick = (item: any) => {
        const uriType = item.uri?.split(':')?.[1];
        const isTrack = item.objectType === 'Track' || uriType === 'track';
        const isPlaylist = item.objectType === 'Playlist' || uriType === 'playlist';
        const isAlbum = item.objectType === 'Album' || uriType === 'album';
        const isArtist = item.objectType === 'Artist' || uriType === 'artist';

        console.log('[Home] Card clicked:', { objectType: item.objectType, uri: item.uri, uriType, isTrack, isPlaylist, isAlbum, isArtist, name: item.name });

        if (isTrack && onTrackViewSelect) {
            
            onTrackViewSelect({
                id: item.uri?.split(':').pop() || item.id,
                name: item.name,
                image: item.images?.[0]?.url || '',
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
        } else if (onTrackViewSelect) {
                                                                
            console.log('[Home] Unknown type, opening as track view');
            onTrackViewSelect({
                id: item.uri?.split(':').pop() || item.id,
                name: item.name,
                image: item.images?.[0]?.url || '',
                artists: item.artists?.map((a: any) => a.name) || [],
            });
        }
    };

    const fetchTracksForItem = async (item: any): Promise<LuneTrack[]> => {
        const uriType = item.uri?.split(':')?.[1];
        const isTrack = item.objectType === 'Track' || uriType === 'track';
        const isAlbum = item.objectType === 'Album' || uriType === 'album';
        const isArtist = item.objectType === 'Artist' || uriType === 'artist';

        if (isTrack) {
            return [normalizeTrack(item, lowDataMode)];
        }

        try {
            const id = item.uri?.split(':').pop() || item.id;
            
            if (isArtist) {
                const artistOverview = await api.artist.getArtist(id);
                const topTracks = (artistOverview?.discography?.topTracks?.items || [])
                    .map((tItem: any) => normalizeTrack(tItem.track, lowDataMode))
                    .filter((t: any) => t && t.id);
                return topTracks.length > 0 ? topTracks : [normalizeTrack(item, lowDataMode)];
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
                
                return mapped.length > 0 ? mapped : [normalizeTrack(item, lowDataMode)];
            } else {
                const data = await api.playlist.getPlaylist(id);
                if (!data?.content?.items?.length) {
                    return [normalizeTrack(item, lowDataMode)];
                }

                return (data.content?.items || [])
                    .map((trackItem: any) => {
                        const trackData = trackItem.itemV2?.data;
                        if (!trackData) return null;
                        return normalizeTrack(trackData, lowDataMode);
                    })
                    .filter((t: any): t is LuneTrack => t !== null);
            }
        } catch (err) {
            console.error('Failed to fetch tracks for item:', err);
            return [normalizeTrack(item, lowDataMode)];
        }
    };

    const handlePlayButtonClick = async (e: React.MouseEvent, item: any) => {
        e.stopPropagation();
        const tracks = await fetchTracksForItem(item);
        if (tracks.length > 0 && onTrackSelect) {
            onTrackSelect(tracks[0], tracks);
        }
    };



    
    if (activeSection) {
        return (
            <div className="home-container">
                <header className="home-header" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button
                        onClick={handleBackToHome}
                        style={{
                            background: 'rgba(255,255,255,0.1)',
                            border: 'none',
                            color: 'white',
                            borderRadius: '50%',
                            width: '32px',
                            height: '32px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M11.03.47a.75.75 0 010 1.06L4.56 8l6.47 6.47a.75.75 0 11-1.06 1.06L2.44 8 9.97.47a.75.75 0 011.06 0z"></path>
                        </svg>
                    </button>
                    <h1 className="home-title" style={{ fontSize: '2rem' }}>{activeSection.title}</h1>
                </header>

                <div className="section-list">
                    <div className="items-grid">
                        {sectionItems.map((item) => (
                            <div key={item.uri || item.id} className="card" onClick={() => handleCardClick(item)}>
                                <div className="card-image-wrapper">
                                    <img
                                        src={item.images[0]?.url || 'placeholder.png'}
                                        alt={item.name}
                                        className="card-image"
                                        loading="lazy"
                                    />
                                    <div className="play-button" onClick={(e) => handlePlayButtonClick(e, item)}>
                                        <svg role="img" height="24" width="24" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M7.05 3.606l13.49 7.788a.7.7 0 010 1.212L7.05 20.394A.7.7 0 016 19.788V4.212a.7.7 0 011.05-.606z"></path>
                                        </svg>
                                    </div>

                                </div>
                                <div className="card-content">
                                    <h3 className="card-title">{item.name}</h3>
                                    <p className="card-subtitle">
                                        {item.objectType === 'Playlist'
                                            ? (item.owner?.display_name ? `${t('home.by')} ${item.owner.display_name}` : item.description)
                                            : item.objectType === 'Album'
                                                ? (item.artists && item.artists.length > 0 ? item.artists[0].name : t('home.album'))
                                                : t('home.artist')}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="home-container">
            <header className="home-header">
                <h1 className="home-title">{greeting}</h1>
            </header>

            <div className="section-list">
                {!loading && !error && sections.length === 0 && (
                    <div className="empty-state" style={{ textAlign: 'center', marginTop: '40px', opacity: 0.7 }}>
                        <h3>{t('home.emptyTitle')}</h3>
                        <p>{t('home.emptyDesc')}</p>
                        <button
                            style={{
                                marginTop: '16px',
                                padding: '8px 16px',
                                background: 'white',
                                color: 'black',
                                borderRadius: '20px',
                                fontSize: '14px',
                                fontWeight: 600
                            }}
                            onClick={() => window.location.reload()}
                        >
                            {t('home.reload')}
                        </button>
                    </div>
                )}
                {sections
                    .filter(s => {
                        if (!s.items || s.items.length === 0 || !s.title) return false;
                        const title = s.title.toLowerCase();
                        if (title.includes("unknown") || title.includes("recently")) return false;
                        if (title.includes("episode") || title.includes("podcast") || title.includes("show") || title.includes("audiobook")) return false;
                        return true;
                    })
                    .map((section, index) => {
                        const isSixPack = index === 0;
                        const displayTitle = section.title || (isSixPack ? t('home.jumpBackIn') : t('home.recommended'));
                        const filteredItems = section.items.filter(item => {
                            const uri = item.uri || "";
                            return !uri.includes(":episode:") && !uri.includes(":show:");
                        });
                        
                        if (filteredItems.length === 0) return null;

                        return (
                            <section key={section.id} className="browse-section">
                                <div className="section-header">
                                    <h2 className="home-section-title">{displayTitle}</h2>
                                    <button
                                        className="show-all-btn"
                                        onClick={() => handleShowAll(section)}
                                    >
                                        {t('home.showAll')}
                                    </button>
                                </div>
                                <div className={`items-grid ${isSixPack ? 'six-pack' : ''}`}>
                                    {filteredItems.map((item) => (
                                        <div key={item.uri || item.id} className="card" onClick={() => handleCardClick(item)}>
                                            <div className="card-image-wrapper">
                                                <img
                                                    src={item.images[0]?.url || 'placeholder.png'}
                                                    alt={item.name}
                                                    className="card-image"
                                                    loading="lazy"
                                                />
                                                <div className="play-button" onClick={(e) => handlePlayButtonClick(e, item)}>
                                                    <svg role="img" height="24" width="24" viewBox="0 0 24 24" fill="currentColor">
                                                        <path d="M7.05 3.606l13.49 7.788a.7.7 0 010 1.212L7.05 20.394A.7.7 0 016 19.788V4.212a.7.7 0 011.05-.606z"></path>
                                                    </svg>
                                                </div>

                                            </div>
                                            <div className="card-content">
                                                <h3 className="card-title">{item.name}</h3>
                                                <p className="card-subtitle">
                                                    {item.objectType === 'Playlist'
                                                        ? (item.owner?.display_name ? `${t('home.by')} ${item.owner.display_name}` : item.description)
                                                        : item.objectType === 'Album'
                                                            ? (item.artists && item.artists.length > 0 ? item.artists[0].name : t('home.album'))
                                                            : t('home.artist')}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        );
                    })}
            </div>
        </div>
    );
};

export default Home;
