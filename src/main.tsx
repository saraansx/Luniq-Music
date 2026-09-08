import React from 'react'
import ReactDOM from 'react-dom/client'
import Login from './components/Login/Login'
import SplashScreen from './components/SplashScreen/SplashScreen'
import TitleBar from './components/TitleBar/TitleBar'

import Sidebar from './components/Sidebar/Sidebar';
import Home from './components/Home/Home';
import Playlist from './components/Playlist/Playlist';
import SearchBar from './components/SearchBar/SearchBar';
import { PlayerProvider, usePlayer } from './context/PlayerContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { PlaybackProvider } from './context/PlaybackContext';
import { ApiProvider } from './context/ApiContext';
import { SpotifyGqlApi } from '../Plugin/gql/index';

const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

console.log = (...args: any[]) => {
  originalLog(...args);
  if (window.ipcRenderer) {
    window.ipcRenderer.invoke('add-log', 'info', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')).catch(() => {});
  }
};

console.warn = (...args: any[]) => {
  originalWarn(...args);
  if (window.ipcRenderer) {
    window.ipcRenderer.invoke('add-log', 'warn', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')).catch(() => {});
  }
};

console.error = (...args: any[]) => {
  originalError(...args);
  if (window.ipcRenderer) {
    window.ipcRenderer.invoke('add-log', 'error', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')).catch(() => {});
  }
};

import './index.css'

import PlayerBar from './components/PlayerBar/PlayerBar';

const TrackView = React.lazy(() => import('./components/TrackView/TrackView'));
const Downloads = React.lazy(() => import('./components/Downloads/Downloads'));
const ArtistView = React.lazy(() => import('./components/ArtistView/ArtistView'));
const SearchView = React.lazy(() => import('./components/SearchView/SearchView'));
const NowPlayingView = React.lazy(() => import('./components/NowPlayingView/NowPlayingView'));
const QueueView = React.lazy(() => import('./components/QueueView/QueueView'));
const LyricsView = React.lazy(() => import('./components/LyricsView/LyricsView'));
import Settings from './Settings/settings/Settings';
import updatesImg from './assets/Updates.png';
import mainLogo from './assets/Main.png';
import { HomeSkeleton } from './components/Skeleton/Skeleton';

const MiniPlayerView = React.lazy(() => import('./components/MiniPlayer/MiniPlayerView'));
const FloatingLyrics = React.lazy(() => import('./components/FloatingLyrics/FloatingLyrics'));

const FallbackLoader = () => <HomeSkeleton />;

const CustomWallpaperLayer: React.FC = () => {
  const { customBackground, bgBlur, bgOpacity, bgFit } = useTheme();
  if (!customBackground) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundImage: `url("${customBackground}")`,
        backgroundSize: bgFit,
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        filter: `blur(${bgBlur}px)`,
        opacity: bgOpacity / 100,
        pointerEvents: 'none',
        zIndex: 0,
        transform: 'scale(1.05)',
        transition: 'opacity 0.3s ease, filter 0.3s ease',
      }}
      aria-hidden="true"
    />
  );
};

const DynamicColorSync: React.FC = () => {
  const { currentTrack } = usePlayer();
  const { dynamicColor, applyDynamicColor } = useTheme();
  const lastAppliedUrl = React.useRef<string | null>(null);
  const debounceRef    = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (!dynamicColor) {
      lastAppliedUrl.current = null;
      return;
    }
    const url = currentTrack?.albumArt;
    if (!url || url === lastAppliedUrl.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      lastAppliedUrl.current = url;
      applyDynamicColor(url);
      debounceRef.current = null;
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [currentTrack?.albumArt, dynamicColor, applyDynamicColor]);

  React.useEffect(() => {
    if (dynamicColor && currentTrack?.albumArt) {
      lastAppliedUrl.current = currentTrack.albumArt;
      applyDynamicColor(currentTrack.albumArt);
    }
  }, [dynamicColor]);

  return null;
};

const MainLayout = ({ 
  credentials, 
  handlePopBack, 
  handleBackToHome, 
  view, 
  selectedTrackInfo, 
  selectedArtistId, 
  searchQuery, 
  selectedPlaylistId, 
  selectedIsAlbum, 
  handlePlaylistSelect, 
  handleTrackViewSelect, 
  handleArtistSelect, 
  handleSearch, 
  handlePlayerArtistClick, 
  handleSettingsClick,
  isSettingsClosing,
  viewStack,
  isOnline
}: any) => {
  const { 
    showQueue, 
    setShowQueue, 
  } = usePlayer();
  const { t } = useLanguage();
  const [isMiniPlayer, setIsMiniPlayer] = React.useState(false);
  const [isFloatingLyrics, setIsFloatingLyrics] = React.useState(false);

  React.useEffect(() => {
    window.ipcRenderer?.invoke('is-mini-player').then(val => setIsMiniPlayer(!!val)).catch(() => {});
    window.ipcRenderer?.invoke('is-floating-lyrics-open').then(val => setIsFloatingLyrics(!!val)).catch(() => {});

    const handleMiniChange = (_e: any, isMini: boolean) => {
      setIsMiniPlayer(isMini);
    };

    const handleLyricsChange = (_e: any, isLyrics: boolean) => {
      setIsFloatingLyrics(isLyrics);
    };

    window.ipcRenderer?.on('mini-player-changed', handleMiniChange);
    window.ipcRenderer?.on('floating-lyrics-changed', handleLyricsChange);

    return () => {
      window.ipcRenderer?.off('mini-player-changed', handleMiniChange);
      window.ipcRenderer?.off('floating-lyrics-changed', handleLyricsChange);
    };
  }, []);

  return (
    <div className="app-container main-layout-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', background: 'transparent', overflow: 'hidden' }}>
      {isMiniPlayer ? (
        <React.Suspense fallback={<FallbackLoader />}>
          <MiniPlayerView onArtistSelect={handlePlayerArtistClick} />
        </React.Suspense>
      ) : (
        <>
          <TitleBar />
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden', width: '100%' }}>
            <div className={`main-sidebar-wrapper ${view === 'settings' ? 'sidebar-hidden' : ''}`}>
              <Sidebar
                accessToken={credentials.accessToken}
                cookies={credentials.cookies}
                onPlaylistSelect={handlePlaylistSelect}
                onArtistSelect={handleArtistSelect}
                isOnline={isOnline}
              />
            </div>
            <div className={`main-view-shell ${view === 'settings' ? 'in-settings-view' : ''}`}>
              <div className="top-global-nav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <div className="luniq-nav-btn-container" style={{ display: 'flex', alignItems: 'center' }}>
                  {view !== 'settings' ? (
                    <>
                      <button 
                        onClick={handlePopBack} 
                        className="luniq-nav-btn" 
                        title={t('nav.back')}
                        disabled={viewStack.length === 0}
                        style={{ opacity: viewStack.length > 0 ? 1 : 0.3, cursor: viewStack.length > 0 ? 'pointer' : 'default' }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                      </button>
                      {isOnline && (
                        <button 
                          onClick={handleBackToHome} 
                          className="luniq-nav-btn" 
                          title={t('nav.home')}
                          style={{ color: view === 'home' ? '#ffffff' : '#b3b3b3' }}
                        >
                          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
                        </button>
                      )}
                      {!isOnline && (
                        <div className="offline-badge" style={{ 
                          background: 'rgba(255, 255, 255, 0.05)', 
                          padding: '6px 12px', 
                          borderRadius: '20px',
                          fontSize: '11px',
                          fontWeight: 600,
                          color: 'rgba(255, 255, 255, 0.4)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          border: '1px solid rgba(255, 255, 255, 0.05)'
                        }}>
                          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#e74c3c' }}></div>
                          {t('nav.offline')}
                        </div>
                      )}
                    </>
                  ) : (
                    <button 
                      onClick={handleSettingsClick} 
                      className="luniq-nav-btn" 
                      title={t('nav.back')}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    </button>
                  )}
                </div>

                <div className={`top-search-wrapper ${view === 'settings' ? 'search-hidden' : ''}`}>
                  {isOnline && (
                    <SearchBar 
                      accessToken={credentials.accessToken}
                      cookies={credentials.cookies}
                      onTrackViewSelect={handleTrackViewSelect}
                      onArtistSelect={handleArtistSelect}
                      onPlaylistSelect={handlePlaylistSelect}
                      onSearch={handleSearch}
                    />
                  )}
                </div>

                <div className="luniq-top-actions" style={{ justifySelf: 'end', display: 'flex', alignItems: 'center' }}>
                  <button 
                    className={`luniq-nav-btn luniq-settings-btn ${view === 'settings' ? 'active' : ''}`} 
                    title={t('nav.settings')}
                    onClick={handleSettingsClick}
                    style={view === 'settings' ? { color: 'var(--accent, #0077f9)', background: 'rgba(var(--accent-rgb, 0, 119, 249), 0.15)' } : undefined}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3"></circle>
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                    </svg>
                  </button>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', width: '100%', display: 'flex', flexDirection: 'column' }}>
                <React.Suspense fallback={<FallbackLoader />}>
                {view === 'home' ? (
                  <Home
                    accessToken={credentials?.accessToken}
                    cookies={credentials?.cookies}
                    onPlaylistSelect={handlePlaylistSelect}
                    onTrackViewSelect={handleTrackViewSelect}
                    onArtistSelect={handleArtistSelect}
                  />
                ) : view === 'track' && selectedTrackInfo ? (
                  <TrackView
                    accessToken={credentials?.accessToken}
                    cookies={credentials?.cookies}
                    trackId={selectedTrackInfo.id}
                    trackName={selectedTrackInfo.name}
                    trackImage={selectedTrackInfo.image}
                    trackArtists={selectedTrackInfo.artists}
                    onBack={handlePopBack}
                    onHome={handleBackToHome}
                    onPlaylistSelect={handlePlaylistSelect}
                    onArtistSelect={handleArtistSelect}
                  />
                ) : view === 'artist' && selectedArtistId ? (
                  <ArtistView
                    accessToken={credentials?.accessToken}
                    cookies={credentials?.cookies}
                    artistId={selectedArtistId}
                    onBack={handlePopBack}
                    onHome={handleBackToHome}
                    onPlaylistSelect={handlePlaylistSelect}
                    onArtistSelect={handleArtistSelect}
                  />
                ) : view === 'downloads' ? (
                  <Downloads />
                ) : view === 'search' ? (
                  <SearchView
                    query={searchQuery}
                    accessToken={credentials?.accessToken}
                    cookies={credentials?.cookies}
                    onTrackViewSelect={handleTrackViewSelect}
                    onArtistSelect={handleArtistSelect}
                    onPlaylistSelect={handlePlaylistSelect}
                  />
                ) : view === 'settings' ? (
                  <Settings accessToken={credentials?.accessToken} cookies={credentials?.cookies} isClosing={isSettingsClosing} />
                ) : (
                  selectedPlaylistId && (
                    <Playlist
                      accessToken={credentials?.accessToken}
                      cookies={credentials?.cookies}
                      playlistId={selectedPlaylistId}
                      isAlbum={selectedIsAlbum}
                      onBack={handlePopBack}
                      onHome={handleBackToHome}
                      onPlaylistSelect={handlePlaylistSelect}
                      onArtistSelect={handlePlayerArtistClick}
                    />
                  )
                )}
                </React.Suspense>
              </div>
            </div>
            <React.Suspense fallback={<FallbackLoader />}>
            <QueueView 
              isOpen={showQueue}
              onClose={() => setShowQueue(false)} 
              onArtistSelect={handlePlayerArtistClick}
            />
            
            <NowPlayingView
              accessToken={credentials.accessToken}
              cookies={credentials.cookies}
              isFullscreen={true}
              onArtistSelect={handlePlayerArtistClick}
              onPlaylistSelect={handlePlaylistSelect}
            />
            <LyricsView />
            </React.Suspense>
          </div>
        </>
      )}
      <PlayerBar
        onArtistSelect={handlePlayerArtistClick}
        accessToken={credentials?.accessToken}
        isHidden={isMiniPlayer}
      />
      {isFloatingLyrics && (
        <React.Suspense fallback={null}>
          <FloatingLyrics onClose={() => window.ipcRenderer?.invoke('toggle-floating-lyrics', false)} />
        </React.Suspense>
      )}
    </div>
  );
};

const MajorUpdateModal = ({ updateStatus, setAppUpdateStatus }: { updateStatus: any, setAppUpdateStatus: any }) => {
  if (!updateStatus || updateStatus.status === 'idle') return null;

  const status = updateStatus.status;
  const progress = Math.round(updateStatus.progress?.percent || 0);
  const releaseNotes = updateStatus.info?.releaseNotes;

  return (
    <div className={`major-update-overlay ${status}`}>
       <div className="major-update-glass">
          <div className="update-content-box">
             {status !== 'downloading' && !releaseNotes && (
                <div className="update-icon-wrapper">
                  <img src={updatesImg} alt="Update" className="update-hero-img" />
                </div>
             )}
             
             <div className="update-text-section">
                <h1 className="update-title">
                  {status === 'checking' && 'Searching for updates'}
                  {status === 'available' && `Luniq v${updateStatus.info?.version}`}
                  {status === 'downloading' && 'Updating Luniq'}
                   {status === 'downloaded' && 'Update Ready'}
                   {status === 'up-to-date' && 'Up to Date'}
                   {status === 'error' && 'Update Error'}
                 </h1>

                {releaseNotes && (status === 'available' || status === 'downloaded' || (status === 'downloading' && progress > 80)) && (
                   <div className="update-notes-container">
                      <div className="update-notes-label">What's New</div>
                      <div className="update-notes-content" dangerouslySetInnerHTML={{ __html: typeof releaseNotes === 'string' ? releaseNotes : '' }} />
                   </div>
                )}

                <p className="update-description" style={{ marginTop: releaseNotes ? '8px' : '0' }}>
                   {status === 'checking' && 'Checking for the latest version...'}
                   {status === 'available' && !releaseNotes && 'A new version is available with improved performance and stability.'}
                   {status === 'downloading' && `Updating your experience... ${progress}%`}
                    {status === 'downloaded' && !releaseNotes && 'The update is ready to be installed.'}
                    {status === 'up-to-date' && "You're running the latest version of Luniq."}
                    {status === 'error' && (() => {
                      const msg = updateStatus.message || '';
                      if (msg.length > 100 || msg.includes('Content-Security-Policy') || msg.includes('github')) {
                        return 'Unable to reach the update server. Please check your connection or try again later.';
                      }
                      return msg;
                   })()}
                </p>
             </div>

             <div className="update-controls">
                {status === 'available' && (
                  <button className="premium-action-btn" onClick={() => {
                     if (updateStatus.demo) {
                        window.postMessage({ type: 'app-update-status-demo', status: 'start-download-demo', info: updateStatus.info }, '*');
                     } else {
                        window.ipcRenderer.invoke('start-app-download');
                     }
                  }}>
                    Update Now
                  </button>
                )}
                {status === 'downloaded' && (
                  <button className="premium-action-btn" onClick={() => {
                     if (updateStatus.demo) {
                        window.postMessage({ type: 'app-update-status-demo', status: 'idle' }, '*');
                     } else {
                        window.ipcRenderer.invoke('quit-and-install-update');
                     }
                  }}>
                    Restart & Install
                  </button>
                 )}
                 
                 {status === 'up-to-date' && (
                   <button className="premium-action-btn secondary" onClick={() => setAppUpdateStatus({ status: 'idle' })}>
                     Close
                   </button>
                 )}
                 
                 {status === 'checking' && <div className="premium-minimal-loader" />}
                
                {status === 'downloading' && (
                  <div className="premium-progress-container">
                    <div className="premium-progress-bar" style={{ width: `${progress}%` }} />
                  </div>
                )}
             </div>
          </div>
          
          <div className="update-close-btn" onClick={() => {
             setAppUpdateStatus({ status: 'idle' });
          }}>
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </div>
       </div>
    </div>
  );
};

const YtdlpUpdateModal = ({ updateStatus, setYtdlpStatus }: { updateStatus: any, setYtdlpStatus: any }) => {
  const { t } = useLanguage();
  if (!updateStatus || updateStatus.status === 'idle') return null;

  const status = updateStatus.status;

  return (
    <div className={`major-update-overlay ytdlp-theme ${status}`}>
       <div className="major-update-glass">
          <div className="update-content-box">
             <div className="update-icon-wrapper ytdlp-icon">
                <img src={mainLogo} alt="Playback Engine" className="update-hero-img" />
             </div>
             
             <div className="update-text-section">
                <h1 className="update-title">
                  {status === 'checking' && (t('ytdlp.checking') || 'Checking Drivers')}
                  {status === 'ready' && (updateStatus.isLatest ? "It's up to date" : (t('ytdlp.ready') || 'Drivers Ready'))}
                  {status === 'error' && (t('ytdlp.error') || 'Driver Error')}
                </h1>

                <p className="update-description">
                   {status === 'checking' && 'Optimizing your playback engine for the best experience...'}
                   {status === 'ready' && (updateStatus.isLatest ? 'Your playback system is already running the latest configuration.' : 'Your playback drivers have been successfully updated.')}
                   {status === 'error' && (updateStatus.message || 'Unable to update playback drivers. Please try again later.')}
                </p>
             </div>

             <div className="update-controls">
                {status === 'ready' && (
                  <button className="premium-action-btn" onClick={() => setYtdlpStatus({ status: 'idle' })}>
                    Got it
                  </button>
                )}
                {status === 'error' && (
                  <button className="premium-action-btn secondary" onClick={() => setYtdlpStatus({ status: 'idle' })}>
                    Close
                  </button>
                )}
                {status === 'checking' && <div className="premium-minimal-loader" />}
             </div>
          </div>
          
          <div className="update-close-btn" onClick={() => setYtdlpStatus({ status: 'idle' })}>
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </div>
       </div>
    </div>
  );
};

import StarPopup from './components/StarPopup/StarPopup';

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = React.useState(true);
  const [credentials, setCredentials] = React.useState<any>(null);
  const [isOnline, setIsOnline] = React.useState(window.navigator.onLine);
  const [view, setView] = React.useState<'home' | 'playlist' | 'track' | 'downloads' | 'artist' | 'search' | 'settings'>('home');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedPlaylistId, setSelectedPlaylistId] = React.useState<string | null>(null);
  const [selectedIsAlbum, setSelectedIsAlbum] = React.useState(false);
  const [selectedTrackInfo, setSelectedTrackInfo] = React.useState<any>(null);
  const [selectedArtistId, setSelectedArtistId] = React.useState<string | null>(null);
  const [viewStack, setViewStack] = React.useState<any[]>([]);
  const [showSplash, setShowSplash] = React.useState(true);
  const [ytdlpStatus, setYtdlpStatus] = React.useState<any>({ status: 'idle' });
  const [appUpdateStatus, setAppUpdateStatus] = React.useState<any>({ status: 'idle' });
  const preOfflineState = React.useRef<any>(null);
  const { setIsInApp } = useTheme();

  React.useEffect(() => {
    setIsInApp(isAuthenticated && !showSplash);
  }, [isAuthenticated, showSplash, setIsInApp]);

  React.useEffect(() => {
    if (!window.ipcRenderer) return;

    const handleAppUpdate = (_event: any, updateData: any) => {
      if (updateData.status === 'up-to-date') return;
      setAppUpdateStatus(updateData);
      if (updateData.status === 'error') {
        setTimeout(() => setAppUpdateStatus({ status: 'idle' }), 5000);
      }
    };

    const handleYtdlpUpdate = (_event: any, statusData: any) => {
      const data = typeof statusData === 'string' ? { status: statusData } : statusData;
      if (data.status === 'ready' && data.isLatest) return;
      setYtdlpStatus(data);
    };

    const removeYtdlpListener = window.ipcRenderer.on('ytdlp-update-status', handleYtdlpUpdate);

    const removeAppListener = window.ipcRenderer.on('app-update-status', handleAppUpdate);

    const handleMessage = (e: MessageEvent) => {
        if (e.data?.type === 'app-update-status-demo') {
            if (e.data.status === 'start-download-demo') {
                let p = 0;
                const inv = setInterval(() => {
                    p += 2;
                    setAppUpdateStatus({ status: 'downloading', progress: { percent: p }, demo: true, info: e.data.info });
                    if (p >= 100) {
                        clearInterval(inv);
                        setAppUpdateStatus({ status: 'downloaded', demo: true, info: e.data.info });
                    }
                }, 40);
            } else {
               handleAppUpdate(null, e.data);
            }
        }
    };
    window.addEventListener('message', handleMessage);

    return () => {
      if (typeof removeYtdlpListener === 'function') (removeYtdlpListener as any)();
      if (typeof removeAppListener === 'function') (removeAppListener as any)();
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const pushView = () => {
    setViewStack(prev => [...prev, {
      view,
      selectedPlaylistId,
      selectedIsAlbum,
      selectedTrackInfo,
      selectedArtistId,
      searchQuery
    }]);
  };

  const handlePopBack = () => {
    if (viewStack.length === 0) {
      handleBackToHome();
      return;
    }
    const newStack = [...viewStack];
    const last = newStack.pop();
    setViewStack(newStack);
    
    if (last) {
      setView(last.view);
      setSelectedPlaylistId(last.selectedPlaylistId);
      setSelectedIsAlbum(last.selectedIsAlbum);
      setSelectedTrackInfo(last.selectedTrackInfo);
      setSelectedArtistId(last.selectedArtistId);
      setSearchQuery(last.searchQuery || '');
    }
  };

  const refreshTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadCredentials = React.useCallback(async (force = false) => {
    if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
    }
    
    try {
      const creds = await window.ipcRenderer.invoke('get-spotify-credentials', force);
      
      if (creds) {
        setCredentials(creds);
        setIsAuthenticated(true);
        setIsCheckingAuth(false);

        if (creds.expiration) {
          const msUntilRefresh = creds.expiration - Date.now() - (120 * 1000);
          refreshTimerRef.current = setTimeout(
            () => loadCredentials(), 
            msUntilRefresh > 0 ? msUntilRefresh : 5 * 60 * 1000
          );
        }
      } else {
        setIsAuthenticated(false);
        setCredentials(null);
        setIsCheckingAuth(false);
      }
    } catch (err) {
      console.error('Failed to load credentials:', err);
      setIsCheckingAuth(false);
      refreshTimerRef.current = setTimeout(() => loadCredentials(), 30000);
    }
  }, []);

  React.useEffect(() => {
    loadCredentials();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadCredentials]);

  const handleUnauthorized = React.useCallback(() => {
    console.warn('Unauthorized error detected, forcing token refresh...');
    loadCredentials(true);
  }, [loadCredentials]);

  
  React.useEffect(() => {
    if (!isOnline) {
      const onlineViews = ['home', 'playlist', 'track', 'artist', 'search', 'settings'];
      if (onlineViews.includes(view)) {
        preOfflineState.current = {
            view,
            selectedPlaylistId,
            selectedIsAlbum,
            selectedTrackInfo,
            selectedArtistId,
            searchQuery
        };
        setView('downloads');
      }
    } else {
        if (preOfflineState.current) {
            const s = preOfflineState.current;
            setView(s.view);
            setSelectedPlaylistId(s.selectedPlaylistId);
            setSelectedIsAlbum(s.selectedIsAlbum);
            setSelectedTrackInfo(s.selectedTrackInfo);
            setSelectedArtistId(s.selectedArtistId);
            setSearchQuery(s.searchQuery);
            preOfflineState.current = null;
        }
    }
  }, [isOnline]);

  const handlePlaylistSelect = (id: string, isAlbum?: boolean) => {
    pushView();
    if (id === 'downloads-view') {
      setView('downloads');
      return;
    }
    setSelectedPlaylistId(id);
    setSelectedIsAlbum(!!isAlbum);
    setView('playlist');
  };

  const handleBackToHome = () => {
    setViewStack([]);
    setView('home');
    setSelectedPlaylistId(null);
    setSelectedTrackInfo(null);
    setSelectedArtistId(null);
  };

  const handleTrackViewSelect = (trackInfo: { id: string; name: string; image: string; artists: string[] }) => {
    pushView();
    setSelectedTrackInfo(trackInfo);
    setView('track');
  };

  const handleArtistSelect = (id: string) => {
    pushView();
    setSelectedArtistId(id);
    setView('artist');
  };

  const handleSearch = (query: string) => {
    pushView();
    setSearchQuery(query);
    setView('search');
  };

  const [isSettingsClosing, setIsSettingsClosing] = React.useState(false);
  const settingsCloseTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSettingsClick = () => {
    if (view === 'settings') {
      if (isSettingsClosing) return;
      setIsSettingsClosing(true);
      if (settingsCloseTimerRef.current) clearTimeout(settingsCloseTimerRef.current);
      settingsCloseTimerRef.current = setTimeout(() => {
        setIsSettingsClosing(false);
        handlePopBack();
      }, 300);
      return;
    }
    setIsSettingsClosing(false);
    pushView();
    setView('settings');
  };

  const appSpDc = React.useMemo(() => credentials?.cookies?.find((c: any) => c.name === 'sp_dc')?.value, [credentials]);
  const appSpT = React.useMemo(() => credentials?.cookies?.find((c: any) => c.name === 'sp_t')?.value, [credentials]);
  const api = React.useMemo(() => credentials?.accessToken ? new SpotifyGqlApi(credentials.accessToken, appSpDc, appSpT) : null, [credentials?.accessToken, appSpDc, appSpT]);

  const handlePlayerArtistClick = async (artistId?: string | null, artistName?: string) => {
    if (!credentials || !credentials.accessToken) return;
    
    if (artistId) {
        handleArtistSelect(artistId);
        return;
    }

    if (!artistName) return;
    
    try {
      const searchName = artistName.split(',')[0].trim();
      const searchRes = await api!.search.artists(searchName, { limit: 1 });
      if (searchRes.items && searchRes.items.length > 0) {
        handleArtistSelect(searchRes.items[0].id);
      }
    } catch (err) {
      console.error('Failed to search artist:', err);
    }
  };

  return (
    <>
      {(showSplash || isCheckingAuth) && (
        <SplashScreen 
          onFinished={() => {
            if (!isCheckingAuth) setShowSplash(false);
          }} 
          duration={1600}
        />
      )}

      {isAuthenticated && credentials ? (
        <ApiProvider 
          accessToken={credentials.accessToken} 
          cookies={credentials.cookies}
          onUnauthorized={handleUnauthorized}
        >
          <MainLayout 
            credentials={credentials}
            handlePopBack={handlePopBack}
            handleBackToHome={handleBackToHome}
            view={view}
            selectedTrackInfo={selectedTrackInfo}
            selectedArtistId={selectedArtistId}
            searchQuery={searchQuery}
            selectedPlaylistId={selectedPlaylistId}
            selectedIsAlbum={selectedIsAlbum}
            handlePlaylistSelect={handlePlaylistSelect}
            handleTrackViewSelect={handleTrackViewSelect}
            handleArtistSelect={handleArtistSelect}
            handleSearch={handleSearch}
            handlePlayerArtistClick={handlePlayerArtistClick}
            handleSettingsClick={handleSettingsClick}
            isSettingsClosing={isSettingsClosing}
            viewStack={viewStack}
            isOnline={isOnline}
          />
          <MajorUpdateModal updateStatus={appUpdateStatus} setAppUpdateStatus={setAppUpdateStatus} />
          <YtdlpUpdateModal updateStatus={ytdlpStatus} setYtdlpStatus={setYtdlpStatus} />
          <StarPopup />
        </ApiProvider>
      ) : (
        <div className="login-container" style={{ animation: 'loginContainerFadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}>
          <TitleBar />
          <Login onLoginSuccess={async (newCreds?: any) => {
            const creds = newCreds || await window.ipcRenderer.invoke('get-spotify-credentials');
            if (creds) {
              setCredentials(creds);
              setIsAuthenticated(true);
            }
          }} />
        </div>
      )}
    </>
  );
};

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: 'white' }}>
          <h1>Something went wrong.</h1>
          <pre>{this.state.error?.toString()}</pre>
          <button onClick={() => window.location.reload()} style={{ marginTop: 20, padding: 10 }}>Reload App</button>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <ThemeProvider>
      <PlaybackProvider>
        <LanguageProvider>
          <PlayerProvider>
            <CustomWallpaperLayer />
            <DynamicColorSync />
            <App />
          </PlayerProvider>
        </LanguageProvider>
      </PlaybackProvider>
    </ThemeProvider>
  </ErrorBoundary>
)

window.ipcRenderer.on('main-process-message', (_event, message) => {
  console.log(message)
})
