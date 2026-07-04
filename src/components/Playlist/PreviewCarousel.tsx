import React, { useState, useRef, useCallback, useEffect } from "react";
import "./PreviewCarousel.css";
import { useApi } from "../../context/ApiContext";

interface PreviewTrack {
  id: string;
  name: string;
  uri: string;
  image?: string;
  artists?: string[];
  artistId?: string | null;
  previewUrl?: string;
  duration?: number;
}

interface PreviewCarouselProps {
  tracks: PreviewTrack[];
  onClose: () => void;
  playlistName?: string;
}

const PreviewCarousel: React.FC<PreviewCarouselProps> = ({
  tracks,
  onClose,
  playlistName,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [artistInfo, setArtistInfo] = useState<{ image?: string; monthlyListeners?: number } | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
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
    setIsPlaying(false);
  }, []);

  const playPreview = useCallback(
    (index: number) => {
      const track = tracks[index];
      if (!track.previewUrl) return;

      stopPlayback();

      const audio = new Audio(track.previewUrl);
      audio.volume = volume;
      audio.muted = isMuted;
      audioRef.current = audio;

      audio.addEventListener("loadedmetadata", () => {
        setIsPlaying(true);
        progressInterval.current = setInterval(() => {
          if (audioRef.current) {
            setProgress(
              (audioRef.current.currentTime / audioRef.current.duration) * 100,
            );
          }
        }, 100);
      });

      audio.addEventListener("ended", () => {
        stopPlayback();
        const nextIndex = index + 1;
        if (nextIndex < tracks.length && tracks[nextIndex].previewUrl) {
          setTimeout(() => {
            setActiveIndex(nextIndex);
          }, 300);
        }
      });

      audio.play().catch(() => {
        console.warn("[PreviewCarousel] Failed to play preview");
        stopPlayback();
      });
    },
    [tracks, stopPlayback],
  );

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
            setCanvasUrls((prev) => ({ ...prev, [track.id]: canvas.url }));
          }
        } catch {
          // Track may not have canvas
        }
      }
    };
    fetchCanvases();
  }, [tracks]);

  // Fetch artist info when active track changes
  useEffect(() => {
    const artistId = currentTrack?.artistId;
    if (!artistId) {
      setArtistInfo(null);
      return;
    }
    let cancelled = false;
    api.artist.getArtist(artistId).then((data: any) => {
      if (cancelled) return;
      const visuals = data?.visuals || {};
      const img =
        visuals?.avatarImage?.sources?.[0]?.url ||
        visuals?.headerImage?.sources?.[0]?.url ||
        null;
      const monthly =
        data?.stats?.monthlyListeners ||
        data?.monthlyListeners ||
        null;
      setArtistInfo({ image: img ?? undefined, monthlyListeners: monthly ?? undefined });
    }).catch(() => setArtistInfo(null));
    return () => { cancelled = true; };
  }, [activeIndex]);

  const formatListeners = (n?: number) => {
    if (!n) return null;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.0', '')}K`;
    return n.toLocaleString();
  };

  const handleFollow = async () => {
    const artistId = currentTrack?.artistId;
    if (!artistId) return;
    try {
      if (isFollowing) {
        await api.artist.unfollow([artistId]);
        setIsFollowing(false);
      } else {
        await api.artist.follow([artistId]);
        setIsFollowing(true);
      }
    } catch { /* silent */ }
  };

  const goNext = () => {
    if (activeIndex < tracks.length - 1) {
      setActiveIndex((prev) => prev + 1);
    }
  };

  const goPrev = () => {
    if (activeIndex > 0) {
      setActiveIndex((prev) => prev - 1);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
    }
    setIsMuted((prev) => !prev);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
      audioRef.current.muted = val === 0;
    }
    setIsMuted(val === 0);
  };

  const isFirst = activeIndex === 0;
  const isLast = activeIndex === tracks.length - 1;

  if (!currentTrack) return null;

  return (
    <div className="preview-overlay">
      <div className="preview-container">
        {/* Top-right controls: visualizer + mute + volume + close */}
        <div className="preview-top-right">
          {/* Animated visualizer */}
          <div className={`preview-visualizer ${isPlaying && !isMuted ? "active" : ""}`}>
            <span /><span /><span /><span /><span />
          </div>

          {/* Volume group: mute button + slider */}
          <div className="preview-volume-group">
            <button className="preview-action-btn" title={isMuted ? "Unmute" : "Mute"} onClick={toggleMute}>
              {isMuted || volume === 0 ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16.5 12A4.5 4.5 0 0 0 14 7.97V10.18l2.45 2.45A4.43 4.43 0 0 0 16.5 12zM19 12c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.62 8.62 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25A6.98 6.98 0 0 1 14 18.98v2.06A8.99 8.99 0 0 0 17.73 19l1.73 1.73L21 19.46 4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05A4.5 4.5 0 0 0 16.5 12zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                </svg>
              )}
            </button>
            <input
              className="preview-volume-slider"
              type="range"
              min="0"
              max="1"
              step="0.02"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
            />
          </div>

          {/* Separator */}
          <div className="preview-top-separator" />

          {/* Close button */}
          <button className="preview-close-btn" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

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
            <div className="preview-playlist-name">
              {playlistName || "Playlist"}
            </div>

            <div className="preview-track-info">
              <div className="preview-track-name">{currentTrack.name}</div>
              {currentTrack.artists && currentTrack.artists.length > 0 && (
                <div className="preview-track-artist">
                  {currentTrack.artists.join(", ")}
                </div>
              )}

              <div className="preview-mini-player">
                {currentTrack.image ? (
                  <img
                    src={currentTrack.image}
                    alt={currentTrack.name}
                    className="preview-mini-artwork"
                  />
                ) : (
                  <div className="preview-mini-artwork preview-mini-placeholder">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="rgba(255,255,255,0.3)"
                    >
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                    </svg>
                  </div>
                )}
                <div className="preview-mini-progress-track">
                  <div
                    className="preview-mini-progress-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Artist info row — bottom left */}
            <div className="preview-artist-row">
              {artistInfo?.image ? (
                <img src={artistInfo.image} alt="" className="preview-artist-avatar" />
              ) : (
                <div className="preview-artist-avatar preview-artist-avatar-placeholder">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(255,255,255,0.4)">
                    <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                  </svg>
                </div>
              )}
              <span className="preview-artist-name">
                {currentTrack.artists?.[0] || ""}
              </span>
              {formatListeners(artistInfo?.monthlyListeners) && (
                <>
                  <span className="preview-artist-dot">·</span>
                  <span className="preview-artist-listeners">
                    {formatListeners(artistInfo?.monthlyListeners)} monthly listeners
                  </span>
                </>
              )}
              {currentTrack.artistId && (
                <button
                  className={`preview-follow-btn ${isFollowing ? "following" : ""}`}
                  onClick={handleFollow}
                >
                  {isFollowing ? "Following" : "Follow"}
                </button>
              )}
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
              <img
                src={currentTrack.image}
                alt={currentTrack.name}
                className="preview-canvas-image"
              />
            ) : (
              <div className="preview-canvas-placeholder">
                <svg
                  width="64"
                  height="64"
                  viewBox="0 0 24 24"
                  fill="rgba(255,255,255,0.15)"
                >
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                </svg>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="preview-nav-buttons">
              {isFirst ? (
                <button className="preview-next-btn" onClick={goNext}>
                  Next
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
                  </svg>
                </button>
              ) : (
                <>
                  {!isFirst && (
                    <button className="preview-arrow-btn" onClick={goPrev}>
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
                      </svg>
                    </button>
                  )}
                  {!isLast && (
                    <button className="preview-arrow-btn" onClick={goNext}>
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
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
          {tracks
            .slice(
              Math.max(0, activeIndex - 4),
              Math.min(tracks.length, activeIndex + 5),
            )
            .map((track, i) => {
              const actualIndex = Math.max(0, activeIndex - 4) + i;
              return (
                <div
                  key={track.id}
                  className={`preview-dot ${actualIndex === activeIndex ? "active" : ""}`}
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
