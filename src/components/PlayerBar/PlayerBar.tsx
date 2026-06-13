import React, { useState, useEffect, useRef } from "react";
import "./PlayerBar.css";
import LoopButton from "../Loop/LoopButton";
import ShuffleButton from "../Shuffle/ShuffleButton";
import QueueIcon from "../Icons/QueueIcon";
import PlaybackSpeed from "../PlaybackSpeed/PlaybackSpeed";
import SleepTimer from "../SleepTimer/SleepTimer";
import Equalizer from "../Equalizer/Equalizer";
import { SpotifyRadioEndpoint } from "../../../Plugin/gql/core/radio";
import { DownloadIndicator } from "../DownloadIndicator/DownloadIndicator";

import { ALBUM_PLACEHOLDER } from "../../constants/assets";

import { usePlayer } from "../../context/PlayerContext";
import { useLanguage } from "../../context/LanguageContext";
import { formatSeconds } from "../../utils/format";
import { usePlayback } from "../../context/PlaybackContext";
import type { LuneTrack } from "../../types/track";

interface LocalPlaylist {
  id: string;
  name: string;
  [key: string]: unknown;
}

const PlayerBar: React.FC<{
  onArtistSelect?: (id: string | null, name: string) => void;
  accessToken?: string;
}> = ({ onArtistSelect, accessToken }) => {
  const {
    currentTrack,
    isPlaying,
    setIsPlaying,
    queue,
    handleNextTrack: onNext,
    handlePrevTrack,
    isShuffle,
    setIsShuffle,
    isLoop,
    setIsLoop,
    showQueue,
    setShowQueue,
    showFullNowPlaying,
    setShowFullNowPlaying,
    showLyrics,
    setShowLyrics,
    prefetchMap,
    sessionHistory,
    contextTracks,
    history,
    autoplayQueue,
    setAutoplayQueue,
    setIsRadioLoading,
    handleAddToQueue: onAddToQueue,
    handlePlayNext: onPlayNext,
  } = usePlayer();
  const { t } = useLanguage();
  const {
    autoplayEnabled,
    normalizeVolume,
    monoAudio,
    audioDeviceId,
    playbackSpeed,
    volume,
    setVolume,
    isMuted,
    setIsMuted,
    eqEnabled,
    eqBands,
  } = usePlayback();

  // ── Volume Normalization & EQ Logic ─────────────────────────────
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const normalizationIntervalRef = useRef<number | null>(null);
  const eqBandsRef = useRef<BiquadFilterNode[]>([]);
  const rpcSyncIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!audioRef.current) return;

    const cleanupInterval = () => {
      if (normalizationIntervalRef.current) {
        console.log("[Normalization] Clearing interval.");
        clearInterval(normalizationIntervalRef.current);
        normalizationIntervalRef.current = null;
      }
    };

    if (!normalizeVolume && !monoAudio && !eqEnabled) {
      cleanupInterval();
      if (audioCtxRef.current && sourceRef.current) {
        console.log(
          "[Audio] Normalization, Mono & EQ OFF: Bypassing Audio Graph to save CPU",
        );
        sourceRef.current.disconnect();
        sourceRef.current.connect(audioCtxRef.current.destination);

        if (gainNodeRef.current) {
          gainNodeRef.current.gain.setTargetAtTime(
            1.0,
            audioCtxRef.current.currentTime,
            0.2,
          );
        }
      }
      return;
    }

    if (!audioCtxRef.current) {
      try {
        console.log("[Audio] Initializing Web Audio API nodes...");
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        audioCtxRef.current = new AudioCtx();
        sourceRef.current = audioCtxRef.current.createMediaElementSource(
          audioRef.current,
        );
        gainNodeRef.current = audioCtxRef.current.createGain();
        analyzerRef.current = audioCtxRef.current.createAnalyser();

        analyzerRef.current.fftSize = 256;

        const freqs = [60, 230, 910, 3600, 14000];
        eqBandsRef.current = freqs.map((freq, i) => {
          const filter = audioCtxRef.current!.createBiquadFilter();

          if (i === 0) filter.type = "lowshelf";
          else if (i === 4) filter.type = "highshelf";
          else filter.type = "peaking";

          filter.frequency.value = freq;
          // Lower Q factor = wider bell curve, so bands interlock and don't sound disconnected
          filter.Q.value = filter.type === "peaking" ? 0.7 : 1.0;
          return filter;
        });

        console.log("[Audio] Web Audio API graph created.");
      } catch (err) {
        console.error("[Audio] Failed to initialize Web Audio API:", err);
        return;
      }
    }

    const audioCtx = audioCtxRef.current!;
    const source = sourceRef.current!;
    const gainNode = gainNodeRef.current!;
    const analyzer = analyzerRef.current!;

    // 3. --- Dynamic Graph Routing ---
    // Disconnect from everything first to ensure a clean, predictable state
    source.disconnect();
    gainNode.disconnect();
    eqBandsRef.current.forEach((filter) => filter.disconnect());

    // Route through EQ if enabled, otherwise straight to GainNode
    if (eqEnabled && eqBandsRef.current.length === 5) {
      let prevNode: AudioNode = source;
      eqBandsRef.current.forEach((filter) => {
        prevNode.connect(filter);
        prevNode = filter;
      });
      prevNode.connect(gainNode);
    } else {
      source.connect(gainNode);
    }

    gainNode.connect(audioCtx.destination);

    if (normalizeVolume) {
      // Only connect the heavy AnalyserNode if normalization is actually ON
      source.connect(analyzer);
      console.log(
        "[Audio] Graph: Source -> Gain (Normalize ON) -> Destination | Source -> Analyzer",
      );
    } else {
      console.log(
        "[Audio] Graph: Source -> Gain (Mono ON) -> Destination (Bypassing Analyzer)",
      );
    }

    // Apply Mono mixdown if requested (managed on the GainNode)
    if (monoAudio) {
      gainNode.channelCount = 1;
      gainNode.channelCountMode = "explicit";
    } else {
      gainNode.channelCount = 2;
      gainNode.channelCountMode = "max";
    }

    // Resume context if browser suspended it (required for playback with nodes)
    if (audioCtx.state === "suspended") {
      audioCtx
        .resume()
        .catch((err) => console.warn("[Audio] Resume failed:", err));
    }
  }, [normalizeVolume, monoAudio, eqEnabled]); // Dependency array specifically triggers routing updates

  // ── Normalization Loop ──────────────────────────────────────────
  useEffect(() => {
    const audioCtx = audioCtxRef.current;
    const analyzer = analyzerRef.current;
    const gainNode = gainNodeRef.current;

    const cleanupInterval = () => {
      if (normalizationIntervalRef.current) {
        clearInterval(normalizationIntervalRef.current);
        normalizationIntervalRef.current = null;
      }
    };

    if (normalizeVolume && isPlaying && audioCtx && analyzer && gainNode) {
      const bufferLength = analyzer.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      let lastGain = gainNode.gain.value;
      const targetDb = 135;
      let logThrottle = 0;

      cleanupInterval();
      normalizationIntervalRef.current = window.setInterval(() => {
        analyzer.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
        const average = sum / bufferLength;

        if (average > 5) {
          const rawTarget = targetDb / Math.max(average, 1);
          const clampedTarget = Math.max(0.4, Math.min(rawTarget, 2.5));
          const isAttack = clampedTarget < lastGain;
          const timeConstant = isAttack ? 0.08 : 0.25;

          gainNode.gain.setTargetAtTime(
            clampedTarget,
            audioCtx.currentTime,
            timeConstant,
          );
          lastGain = clampedTarget;

          if (++logThrottle >= 50) {
            console.log(
              `[Normalization] Avg: ${average.toFixed(1)} | Gain: ${clampedTarget.toFixed(2)}x`,
            );
            logThrottle = 0;
          }
        } else if (average < 1) {
          gainNode.gain.setTargetAtTime(1.0, audioCtx.currentTime, 0.3);
          lastGain = 1.0;
        }
      }, 100);
    } else {
      cleanupInterval();
      if (gainNode && audioCtx && !normalizeVolume) {
        gainNode.gain.setTargetAtTime(1.0, audioCtx.currentTime, 0.2);
      }
    }

    return cleanupInterval;
  }, [normalizeVolume, isPlaying]);

  // ── AudioContext Unmount Cleanup ────────────────────────────────
  useEffect(() => {
    return () => {
      if (audioCtxRef.current) {
        console.log("[Audio] Closing AudioContext on unmount...");
        audioCtxRef.current
          .close()
          .catch((err) => console.error("[Audio] Cleanup failed:", err));
        audioCtxRef.current = null;
      }
    };
  }, []);

  // 5. --- Real-time EQ Value Updates ---
  useEffect(() => {
    if (eqBandsRef.current.length === 5 && audioCtxRef.current) {
      eqBandsRef.current.forEach((filter, idx) => {
        const targetVal = eqBands[idx] || 0;
        if (filter.gain) {
          filter.gain.setTargetAtTime(
            targetVal,
            audioCtxRef.current!.currentTime,
            0.05,
          );
        }
      });
    }
  }, [eqBands, eqEnabled]);

  // Cleanup suspension check
  useEffect(() => {
    if (isPlaying && audioCtxRef.current?.state === "suspended") {
      audioCtxRef.current.resume().catch(() => {});
    }
  }, [isPlaying]);

  // ── Audio Output Device Logic ──────────────────────────────
  const audioRefCurrent = !!audioRef.current;
  useEffect(() => {
    const applyDevice = async () => {
      if (audioRef.current && audioRef.current.setSinkId) {
        try {
          console.log(`[Audio] Switching output device to: ${audioDeviceId}`);
          await audioRef.current.setSinkId(
            audioDeviceId === "default" ? "" : audioDeviceId,
          );
        } catch (err) {
          console.error("[Audio] Failed to set output device:", err);
        }
      }
    };
    applyDevice();
  }, [audioDeviceId, audioRefCurrent]);

  // ── Playback Speed Logic ───────────────────────────────────
  const audioRefCurrent2 = !!audioRef.current;
  useEffect(() => {
    if (audioRef.current) {
      console.log(`[Audio] Setting playbackRate to: ${playbackSpeed}x`);
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed, audioRefCurrent2]);

  const sessionHistoryRef = useRef(sessionHistory);
  sessionHistoryRef.current = sessionHistory;
  const historyRef = useRef(history);
  historyRef.current = history;
  const contextTracksRef = useRef(contextTracks);
  contextTracksRef.current = contextTracks;
  const autoplayQueueRef = useRef(autoplayQueue);
  autoplayQueueRef.current = autoplayQueue;

  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const onNextRef = useRef(onNext);
  onNextRef.current = onNext;
  const onPrevRef = useRef(handlePrevTrack);
  onPrevRef.current = handlePrevTrack;

  const onTogglePlay = () => {
    setIsPlaying(!isPlaying);
    if (!isPlaying && audioCtxRef.current?.state === "suspended") {
      audioCtxRef.current.resume();
    }
  };
  const onToggleShuffle = () => setIsShuffle(!isShuffle);
  const onToggleLoop = () => {
    const modes: ("none" | "all" | "one")[] = ["none", "all", "one"];
    const currentIndex = modes.indexOf(isLoop);
    const nextIndex = (currentIndex + 1) % modes.length;
    setIsLoop(modes[nextIndex]);
  };
  const onToggleQueue = () => setShowQueue(!showQueue);
  const onToggleFullNowPlaying = () =>
    setShowFullNowPlaying(!showFullNowPlaying);
  const onPrev = () => handlePrevTrack(currentTime);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;
  const [trackDuration, setTrackDuration] = useState(0);

  const [prevVolume, setPrevVolume] = useState(0.8);
  const isFirstLoad = useRef(true);
  const lastSavedTime = useRef(0);
  const activeTrackId = useRef<string | null>(null);
  const streamRetryCount = useRef(0);
  const isRadioFetching = useRef(false);
  const progressTimeoutRef = useRef<number | null>(null);

  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [localPlaylists, setLocalPlaylists] = useState<LocalPlaylist[]>([]);
  const [trackPlaylists, setTrackPlaylists] = useState<string[]>([]);
  const [showPlaylistSubmenu, setShowPlaylistSubmenu] = useState(false);
  const [isDownloadState, setIsDownloadState] = useState<boolean | null>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // ── Advanced Pool System (Continuous Prefetch) ─────────────
  // Continuously refills the pool when it gets low, using the last track for evolving recommendations
  useEffect(() => {
    let ignorePoolFetch = false;

    const shuffleArray = <T,>(array: T[]): T[] => {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };

    const fillPool = async () => {
      const logToSystem = (msg: string, type: "info" | "error" = "info") => {
        console.log(msg);
        window.ipcRenderer.invoke("add-log", type, msg).catch(() => {});
      };

      if (!autoplayEnabled || ignorePoolFetch) return;
      if (!currentTrack || !accessToken || isRadioFetching.current) return;
      if (autoplayQueueRef.current.length > 5) return;

      const baseTrack =
        autoplayQueueRef.current.length > 0
          ? autoplayQueueRef.current[autoplayQueueRef.current.length - 1]
          : queue.length > 0
            ? queue[queue.length - 1]
            : currentTrack;

      logToSystem(
        `[Radio Pool] 📥 Low pool detected (${autoplayQueueRef.current.length} left). Seeding from: "${baseTrack.name}"`,
      );
      isRadioFetching.current = true;
      setIsRadioLoading(true);
      try {
        const radio = new SpotifyRadioEndpoint(accessToken);
        const radioTracks = await Promise.race([
          radio.getStationTracks(
            baseTrack.id,
            baseTrack.artists?.[0]?.id ?? undefined,
            30,
          ),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Spotify API Timeout")), 8000),
          ),
        ]);

        if (ignorePoolFetch) return;

        if (radioTracks.length > 0) {
          logToSystem(
            `[Radio Pool] 🚀 Received ${radioTracks.length} raw candidates. Filtering...`,
          );
          // Shuffle results immediately
          const randomized = shuffleArray(radioTracks);

          const recentIds = new Set<string>();
          recentIds.add(currentTrack.id);
          for (const t of sessionHistoryRef.current) recentIds.add(t.id);
          for (const t of historyRef.current) recentIds.add(t.id);
          for (const t of contextTracksRef.current) recentIds.add(t.id);
          for (const t of autoplayQueueRef.current) recentIds.add(t.id);

          const filteredTracks = randomized.filter((t) => !recentIds.has(t.id));
          logToSystem(
            `[Radio Pool] 🧹 Filtered pool: ${filteredTracks.length} unique tracks remaining.`,
          );

          const varietyTracks: LuneTrack[] = [];
          const seenArtists = new Set<string>();
          autoplayQueueRef.current
            .slice(-5)
            .forEach((t) => seenArtists.add(t.artist));
          if (!seenArtists.has(currentTrack.artist))
            seenArtists.add(currentTrack.artist);

          for (const t of filteredTracks) {
            if (!seenArtists.has(t.artist)) {
              seenArtists.add(t.artist);
              varietyTracks.push(t);
            }
          }
          for (const t of filteredTracks) {
            if (!varietyTracks.includes(t)) {
              varietyTracks.push(t);
            }
          }

          let validTracks =
            varietyTracks.length > 0 ? varietyTracks : filteredTracks;
          if (validTracks.length === 0)
            validTracks = randomized.filter((t) => !recentIds.has(t.id));
          if (validTracks.length === 0) validTracks = randomized;

          const poolTracks = validTracks.slice(0, 15);
          logToSystem(
            `[Radio Pool] ✅ Appended ${poolTracks.length} tracks. First up: "${poolTracks[0]?.name}"`,
          );

          if (!ignorePoolFetch) {
            setAutoplayQueue((prev) => [...prev, ...poolTracks].slice(-50));
          }
        }
      } catch (err) {
        logToSystem(`[Radio Pool] ❌ Failed to fill pool: ${err}`, "error");
      } finally {
        isRadioFetching.current = false;
        setIsRadioLoading(false);
      }
    };

    if (
      autoplayEnabled &&
      autoplayQueueRef.current.length <= 5 &&
      queue.length <= 5
    ) {
      fillPool();
    } else if (!autoplayEnabled && autoplayQueueRef.current.length > 0) {
      console.log("[Radio Pool] 🛑 Autoplay disabled. Clearing pool.");
      window.ipcRenderer
        .invoke(
          "add-log",
          "info",
          "[Radio Pool] 🛑 Autoplay disabled. Clearing pool.",
        )
        .catch(() => {});
      setAutoplayQueue([]);
    }

    window.addEventListener("lune:trigger-pool-fetch", fillPool);

    return () => {
      ignorePoolFetch = true;
      window.removeEventListener("lune:trigger-pool-fetch", fillPool);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentTrack?.id,
    accessToken,
    contextTracks.length,
    queue.length,
    autoplayEnabled,
  ]);

  const handleSkip = () => {
    onNext();
  };

  // Sync Volume to Audio Element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Handle click outside 'More' menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        showMoreMenu &&
        moreMenuRef.current &&
        !moreMenuRef.current.contains(target)
      ) {
        setShowMoreMenu(false);
        setShowPlaylistSubmenu(false);
      }
    };

    if (showMoreMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMoreMenu]);

  // Close menu if track changes
  useEffect(() => {
    if (showMoreMenu) {
      setShowMoreMenu(false);
      setShowPlaylistSubmenu(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.id]);

  const handleMoreMenuClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (showMoreMenu) {
      setShowMoreMenu(false);
      setShowPlaylistSubmenu(false);
    } else {
      setShowMoreMenu(true);
      setShowPlaylistSubmenu(false);
      try {
        if (currentTrack) {
          const isDownloaded = await window.ipcRenderer.invoke(
            "check-is-downloaded",
            currentTrack.id,
          );
          setIsDownloadState(isDownloaded);

          const playlists = await window.ipcRenderer.invoke("get-playlists");
          setLocalPlaylists(playlists);

          const inPlaylists = await window.ipcRenderer.invoke(
            "get-track-playlists",
            currentTrack.id,
          );
          setTrackPlaylists(inPlaylists);
        }
      } catch (err) {
        console.error("Failed checking status in PlayerBar", err);
      }
    }
  };

  const handleToggleDownload = async () => {
    if (!currentTrack) return;
    try {
      if (isDownloadState) {
        await window.ipcRenderer.invoke("remove-download", currentTrack.id);
      } else {
        await window.ipcRenderer.invoke("download-track", currentTrack);
      }
      window.dispatchEvent(new Event("lune:download-update"));
      setIsDownloadState(!isDownloadState);
      setShowMoreMenu(false);
    } catch (e) {
      console.error("Failed to toggle download from PlayerBar menu", e);
    }
  };

  const handleTogglePlaylistTrack = async (pId: string) => {
    if (!currentTrack) return;
    try {
      const isAlreadyIn = trackPlaylists.includes(pId);
      let success;
      if (isAlreadyIn) {
        success = await window.ipcRenderer.invoke(
          "remove-track-from-playlist",
          {
            playlistId: pId,
            trackId: currentTrack.id,
          },
        );
      } else {
        success = await window.ipcRenderer.invoke("add-track-to-playlist", {
          playlistId: pId,
          track: currentTrack,
        });
      }
      if (success) {
        window.dispatchEvent(new Event("lune:playlist-tracks-update"));
        const updatedPlaylists = await window.ipcRenderer.invoke(
          "get-track-playlists",
          currentTrack.id,
        );
        setTrackPlaylists(updatedPlaylists);
      }
    } catch (err) {
      console.error("Failed to toggle track in playlist from PlayerBar:", err);
    }
  };

  const fetchStreamUrl = React.useCallback(async () => {
    if (!currentTrack) return;
    const trackId = currentTrack.id;

    // Cancel previous request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // 1. Check Pre-fetch Cache
    const prefetched = prefetchMap[trackId];
    const isStale = prefetched
      ? Date.now() - prefetched.timestamp > 30 * 60 * 1000
      : true;

    if (prefetched && !isStale && streamRetryCount.current === 0) {
      setStreamUrl(prefetched.url);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const url = await window.ipcRenderer.invoke(
        "get-stream-url",
        currentTrack.name,
        currentTrack.artist,
        trackId,
        true,
        "player",
      );

      if (controller.signal.aborted) return;

      if (url && currentTrack?.id === trackId) {
        setStreamUrl(url);
        streamRetryCount.current = 0; // Reset on success
      } else if (!url && currentTrack?.id === trackId) {
        // If it returned empty, it failed or rate limited in the backend
        if (streamRetryCount.current < 2) {
          streamRetryCount.current += 1;
          console.warn(
            `[PlayerBar] Empty stream URL, retrying in 2s... (${streamRetryCount.current})`,
          );
          await new Promise((r) => setTimeout(r, 2000));
          // re-trigger is handled by the effect re-running because isLoading becomes false
        } else {
          console.error(
            "[PlayerBar] Failed to get URL after retries, skipping.",
          );
          streamRetryCount.current = 0;
          onNext();
        }
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        console.error("Failed to get stream url", err);
        // Also treat throw as a retry attempt
        if (streamRetryCount.current < 2) {
          streamRetryCount.current += 1;
          await new Promise((r) => setTimeout(r, 2000));
        } else {
          onNext();
        }
      }
    } finally {
      if (currentTrack?.id === trackId) {
        setIsLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.id, prefetchMap]); // Dependency on prefetchMap ensures we catch it if it finishes while we're loading

  // Unified Playback and URL Sync
  useEffect(() => {
    if (!currentTrack) return;

    // 1. Track changed: reset state immediately to prevent "Ghost Song"
    if (activeTrackId.current !== currentTrack.id) {
      // Force-kill existing playback immediately
      if (audioRef.current) {
        audioRef.current.pause();
        // Clear source to ensure old buffer is flushed
        if (audioRef.current.src) {
          audioRef.current.removeAttribute("src");
          audioRef.current.load();
        }
      }

      setStreamUrl(null);
      setProgress(0);
      setCurrentTime(0);
      setTrackDuration(currentTrack.durationMs / 1000); // Initialize with metadata duration to prevent UI jump
      setIsLoading(false);
      setShowMoreMenu(false);
      setShowPlaylistSubmenu(false);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      activeTrackId.current = currentTrack.id;
    }

    // 2. Need URL (either new track or user hit play)
    if (!streamUrl && !isLoading && currentTrack) {
      fetchStreamUrl();
    }

    // 3. Sync Audio Element playback state
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
      audioRef.current.playbackRate = playbackSpeed; // Ensure speed is applied right away

      if (streamUrl) {
        // Ensure audio element has the correct source
        if (audioRef.current.src !== streamUrl) {
          audioRef.current.src = streamUrl;
        }

        if (isPlaying) {
          // Resume AudioContext if suspended (browser autoplay policy)
          if (audioCtxRef.current?.state === "suspended") {
            audioCtxRef.current.resume();
          }
          const playPromise = audioRef.current.play();
          if (playPromise !== undefined) {
            playPromise.catch(() => {
              // Ignore abort errors common during rapid skipping
            });
          }
        } else {
          audioRef.current.pause();
        }
      } else {
        audioRef.current.pause();
      }
    }

    // Handle first load logic (restore progress)
    if (isFirstLoad.current) {
      const savedTrackId = localStorage.getItem("lune_player_track_id");
      if (savedTrackId === currentTrack.id) {
        const savedProgress = parseFloat(
          localStorage.getItem("lune_player_progress") || "0",
        );
        if (!isNaN(savedProgress)) {
          setCurrentTime(savedProgress);
          if (currentTrack.durationMs) {
            setProgress(
              (savedProgress / (currentTrack.durationMs / 1000)) * 100,
            );
          }
        }
      }
      isFirstLoad.current = false;
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.id, isPlaying, streamUrl, isLoading]);

  // Independent Volume Sync
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // ── Discord RPC Sync ─────────────────────────────────────
  useEffect(() => {
    const updateRPC = async () => {
      try {
        if (!currentTrack) {
          await window.ipcRenderer?.invoke("update-rpc", { clear: true });
          return;
        }

        if (isPlaying && !isLoading) {
          const cTime = audioRef.current?.currentTime || 0;
          const finalDuration = trackDuration
            ? trackDuration * 1000
            : currentTrack.durationMs;

          await window.ipcRenderer?.invoke("update-rpc", {
            title: currentTrack.name,
            artist: currentTrack.artist,
            albumArt: currentTrack.albumArt,
            duration: finalDuration,
            currentTime: cTime * 1000,
            isPlaying: true,
          });
        } else {
          await window.ipcRenderer?.invoke("update-rpc", {
            isPlaying: false,
          });
        }
      } catch (err) {
        console.warn("[Discord RPC] Update failed:", err);
      }
    };

    const timer = setTimeout(() => {
      updateRPC().catch((err) =>
        console.warn("[Discord RPC] Timer trigger failed:", err),
      );
    }, 500);
    if (isPlaying && !isLoading) {
      rpcSyncIntervalRef.current = window.setInterval(() => {
        updateRPC().catch((err) =>
          console.warn("[Discord RPC] Interval trigger failed:", err),
        );
      }, 30000);
    }

    return () => {
      clearTimeout(timer);
      if (rpcSyncIntervalRef.current) {
        clearInterval(rpcSyncIntervalRef.current);
        rpcSyncIntervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentTrack?.id,
    currentTrack?.name,
    currentTrack?.artist,
    isPlaying,
    trackDuration,
    isLoading,
  ]);

  useEffect(() => {
    return () => {
      window.ipcRenderer?.invoke("update-rpc", { clear: true }).catch(() => {});
    };
  }, []);

  // Sync taskbar thumbnail toolbar play/pause icon
  useEffect(() => {
    window.ipcRenderer?.send("thumbar-update", isPlaying);
  }, [isPlaying, currentTrack?.id]);

  useEffect(() => {
    const handleRestart = (e: Event) => {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        setCurrentTime(0);
        setProgress(0);
        if ((e as CustomEvent).detail?.play) {
          audioRef.current.play().catch(() => {});
        }
      }
    };
    window.addEventListener("lune:restart-track", handleRestart);
    return () =>
      window.removeEventListener("lune:restart-track", handleRestart);
  }, []);

  useEffect(() => {
    const handleTrayAction = (_event: unknown, action: string) => {
      if (action === "play-pause") {
        setIsPlaying(!isPlayingRef.current);
      } else if (action === "next") {
        onNextRef.current();
      } else if (action === "previous") {
        onPrevRef.current(currentTimeRef.current);
      }
    };

    const ipc = window.ipcRenderer;
    if (ipc) {
      ipc.on("tray-action", handleTrayAction);
    }

    return () => {
      if (ipc) {
        ipc.off("tray-action", handleTrayAction);
      }
    };
  }, [setIsPlaying]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const current = audioRef.current.currentTime;
      const dur = audioRef.current.duration;
      setCurrentTime(current);
      if (dur && !isNaN(dur)) {
        setProgress((current / dur) * 100);
      }

      // Save progress every 2 seconds
      if (currentTrack && Math.abs(current - lastSavedTime.current) > 2) {
        localStorage.setItem("lune_player_progress", String(current));
        localStorage.setItem("lune_player_track_id", currentTrack.id);
        lastSavedTime.current = current;
      }
    }
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newProgress = parseFloat(e.target.value);
    if (audioRef.current && audioRef.current.duration) {
      const newTime = (newProgress / 100) * audioRef.current.duration;
      audioRef.current.currentTime = newTime;
      setProgress(newProgress);

      if (progressTimeoutRef.current) {
        clearTimeout(progressTimeoutRef.current);
      }

      // Sync RPC immediately on seek after a small debounce
      if (currentTrack && isPlaying) {
        progressTimeoutRef.current = window.setTimeout(() => {
          const finalDuration = trackDuration
            ? trackDuration * 1000
            : currentTrack.durationMs;
          window.ipcRenderer
            ?.invoke("update-rpc", {
              title: currentTrack.name,
              artist: currentTrack.artist,
              albumArt: currentTrack.albumArt,
              duration: finalDuration,
              currentTime: newTime * 1000,
              isPlaying: true, // Tell backend to show activity
            })
            .catch(console.warn);
        }, 500);
      }
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value) / 100;
    setVolume(val);
    if (val > 0 && isMuted) setIsMuted(false);
  };

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      if (volume === 0) setVolume(prevVolume || 0.8);
    } else {
      setPrevVolume(volume);
      setIsMuted(true);
    }
  };

  const getVolumeIcon = () => {
    if (isMuted || volume === 0) {
      return (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
          <line x1="23" y1="9" x2="17" y2="15"></line>
          <line x1="17" y1="9" x2="23" y2="15"></line>
        </svg>
      );
    }
    if (volume < 0.5) {
      return (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
        </svg>
      );
    }
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
      </svg>
    );
  };

  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    const checkFav = async () => {
      if (currentTrack) {
        const fav = await window.ipcRenderer.invoke(
          "check-local-favorite",
          currentTrack.id,
        );
        setIsFavorite(fav);
      }
    };

    checkFav();

    window.addEventListener("lune:playlist-update", checkFav);
    return () => {
      window.removeEventListener("lune:playlist-update", checkFav);
    };
  }, [currentTrack]);

  const toggleFavorite = async () => {
    if (!currentTrack) return;
    try {
      if (isFavorite) {
        await window.ipcRenderer.invoke(
          "remove-local-favorite",
          currentTrack.id,
        );
        setIsFavorite(false);
      } else {
        await window.ipcRenderer.invoke("add-local-favorite", currentTrack);
        setIsFavorite(true);
      }
      // Let Sidebar/Playlist know to refresh if needed
      window.dispatchEvent(new Event("lune:playlist-update"));
    } catch (e) {
      console.error("Failed to toggle favorite", e);
    }
  };

  if (!currentTrack) return null;

  return (
    <div className={`player-bar ${isLoading ? "is-loading" : ""}`}>
      <audio
        ref={audioRef}
        src={streamUrl || undefined}
        crossOrigin="anonymous"
        loop={isLoop === "one"}
        onPlay={() => {
          if (audioRef.current) {
            audioRef.current.playbackRate = playbackSpeed;
          }
        }}
        onTimeUpdate={handleTimeUpdate}
        onEnded={async () => {
          window.ipcRenderer
            ?.invoke("update-rpc", { isPlaying: false })
            .catch(() => {});

          if (isLoop === "one") return;

          console.log(
            `[PlayerBar] ⏹ onEnded | queue=${queue.length} | track="${currentTrack?.name}" | token=${!!accessToken}`,
          );
          await handleSkip();
        }}
        onError={async (e) => {
          const audio = e.target as HTMLAudioElement;
          const code = audio.error?.code;
          // MEDIA_ERR_NETWORK (2) or MEDIA_ERR_SRC_NOT_SUPPORTED (4) = expired/bad URL
          if (code === 2 || code === 4) {
            if (streamRetryCount.current < 2) {
              streamRetryCount.current += 1;
              console.warn(
                `[PlayerBar] Stream error (code ${code}), retrying in 2s... attempt ${streamRetryCount.current}`,
              );

              // Cooldown to prevent rapid skipping loop
              await new Promise((r) => setTimeout(r, 2000));

              // Only clear cache if the link worked for a bit (suggests expiry)
              // If it failed instantly, clearing cache likely won't fix a systemic bot-block
              if (currentTrack && audio.currentTime > 1) {
                window.ipcRenderer.invoke("clear-cache").catch(() => {});
                window.ipcRenderer
                  .invoke("cancel-stream", currentTrack.id, "player")
                  .catch(() => {});
              }
              setStreamUrl(null);
            } else {
              console.error(
                "[PlayerBar] Stream failed after 2 retries, skipping track.",
              );
              streamRetryCount.current = 0;
              // Small delay before skipping to keep UI stable
              setTimeout(() => onNext(), 500);
            }
          }
        }}
        onLoadedMetadata={() => {
          streamRetryCount.current = 0; // reset on successful load
          if (audioRef.current) {
            audioRef.current.volume = isMuted ? 0 : volume;
            setTrackDuration(audioRef.current.duration); // Update to actual stream duration once
            audioRef.current.playbackRate = playbackSpeed; // Ensure speed is applied on new track load
            if (currentTime > 0) {
              audioRef.current.currentTime = currentTime;
            }
          }
        }}
      />

      <div className="player-track-info">
        <div className="album-art-wrapper">
          <img
            src={currentTrack.albumArt || ALBUM_PLACEHOLDER}
            alt=""
            className="player-album-art"
          />
          {isLoading && <div className="art-loader"></div>}
        </div>
        <div className="player-metadata">
          <span
            className="player-track-name"
            style={{ display: "flex", alignItems: "center", gap: "8px" }}
          >
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {currentTrack.name}
            </span>
            <DownloadIndicator trackId={currentTrack.id} />
          </span>
          <div className="player-track-artist-container">
            {currentTrack.artists && currentTrack.artists.length > 0
              ? currentTrack.artists.map(
                  (
                    artist: { name: string; id: string | null },
                    i: number,
                    arr: { name: string; id: string | null }[],
                  ) => (
                    <React.Fragment key={(artist.id || artist.name) + i}>
                      <span
                        className="player-track-artist"
                        onClick={() => onArtistSelect?.(artist.id, artist.name)}
                        style={{
                          cursor: onArtistSelect ? "pointer" : "default",
                        }}
                      >
                        {artist.name}
                      </span>
                      {i < arr.length - 1 && (
                        <span className="artist-separator">, </span>
                      )}
                    </React.Fragment>
                  ),
                )
              : currentTrack.artist
                  .split(", ")
                  .map((artistName: string, i: number, arr: string[]) => (
                    <React.Fragment key={artistName + i}>
                      <span
                        className="player-track-artist"
                        onClick={() => onArtistSelect?.(null, artistName)}
                        style={{
                          cursor: onArtistSelect ? "pointer" : "default",
                        }}
                      >
                        {artistName}
                      </span>
                      {i < arr.length - 1 && (
                        <span className="artist-separator">, </span>
                      )}
                    </React.Fragment>
                  ))}
          </div>
        </div>
        <button
          className={`favorite-btn ${isFavorite ? "active" : ""}`}
          onClick={toggleFavorite}
          title={isFavorite ? t("player.unlike") : t("player.like")}
        >
          {isFavorite ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          ) : (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.84-8.84 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
          )}
        </button>

        <div
          className="player-context-menu"
          ref={moreMenuRef}
          style={{ position: "relative" }}
        >
          <button
            className="player-more-btn"
            onClick={handleMoreMenuClick}
            title={t("playlist.moreOptions")}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          </button>

          {showMoreMenu && (
            <div
              className="lune-dropdown open-up solid-dropdown"
              style={{ bottom: "calc(100% + 15px)", left: "0", right: "auto" }}
            >
              <button
                className="lune-dropdown-item"
                onClick={() => {
                  onPlayNext?.(currentTrack);
                  setShowMoreMenu(false);
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M13 12H3M13 6H3M13 18H3" />
                  <path d="M17 8l5 4-5 4V8z" />
                </svg>
                {t("playlist.playNext")}
              </button>
              <button
                className="lune-dropdown-item"
                onClick={() => {
                  onAddToQueue?.(currentTrack);
                  setShowMoreMenu(false);
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
                {t("playlist.addToQueue")}
              </button>

              {isDownloadState !== null && (
                <button
                  className="lune-dropdown-item"
                  onClick={() => handleToggleDownload()}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  {isDownloadState
                    ? t("playlist.removeDownload")
                    : t("playlist.download")}
                </button>
              )}

              <div className="lune-dropdown-divider" />

              <button
                className={`lune-dropdown-item ${showPlaylistSubmenu ? "active" : ""}`}
                onClick={() => setShowPlaylistSubmenu(!showPlaylistSubmenu)}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M8 6h13M8 12h13M8 18h5" />
                  <path d="M3 6h.01M3 12h.01M3 18h.01" />
                  <path d="M16 18h6M19 15v6" />
                </svg>
                {t("playlist.addToLocalPlaylist")}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  style={{
                    marginLeft: "auto",
                    transform: showPlaylistSubmenu ? "rotate(90deg)" : "none",
                    transition: "transform 0.2s",
                  }}
                >
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>

              {showPlaylistSubmenu && (
                <div className="lune-submenu">
                  {localPlaylists.length > 0 ? (
                    localPlaylists.map((p) => {
                      const isInPlaylist = trackPlaylists.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          className={`lune-dropdown-item ${isInPlaylist ? "active" : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTogglePlaylistTrack(p.id);
                          }}
                        >
                          {p.name}
                          {isInPlaylist && (
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                              style={{ marginLeft: "auto" }}
                            >
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          )}
                        </button>
                      );
                    })
                  ) : (
                    <div
                      className="lune-dropdown-item disabled"
                      style={{ opacity: 0.5, cursor: "default" }}
                    >
                      {t("playlist.noLocalPlaylists")}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <div className={`mini-visualizer ${isPlaying ? "active" : ""}`}>
          <div className="vis-bar"></div>
          <div className="vis-bar"></div>
          <div className="vis-bar"></div>
          <div className="vis-bar"></div>
        </div>
      </div>

      <div className="player-controls-container">
        <div className="player-main-controls">
          <ShuffleButton
            isShuffle={isShuffle}
            onToggle={onToggleShuffle}
            className="control-btn"
            size={20}
          />
          <button
            className="control-btn"
            onClick={onPrev}
            title={t("player.previous")}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"></path>
            </svg>
          </button>
          <button
            className="play-pause-btn"
            onClick={onTogglePlay}
            title={isPlaying ? t("player.pause") : t("player.play")}
          >
            {isPlaying ? (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path>
              </svg>
            ) : (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M8 5v14l11-7z"></path>
              </svg>
            )}
          </button>
          <button
            className="control-btn"
            onClick={handleSkip}
            title={t("player.next")}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"></path>
            </svg>
          </button>
          <LoopButton
            isLoop={isLoop}
            onToggle={onToggleLoop}
            className="control-btn"
            size={20}
          />
        </div>

        <div className="player-playback-bar">
          <span className="time-label">{formatSeconds(currentTime)}</span>
          <div className="progress-bar-wrapper">
            <div
              className="progress-fill"
              style={{
                width: `${progress}%`,
                opacity: isLoading ? 0.3 : 1,
              }}
            />
            <input
              type="range"
              className="progress-input"
              min="0"
              max="100"
              step="0.01"
              value={progress}
              onChange={handleProgressChange}
              disabled={isLoading}
            />
          </div>
          <span className="time-label">{formatSeconds(trackDuration)}</span>
        </div>
      </div>

      <div className="player-extra-controls">
        <Equalizer />
        <SleepTimer />
        <PlaybackSpeed />
        <div className="volume-container">
          <button className="control-btn small" onClick={toggleMute}>
            {getVolumeIcon()}
          </button>
          <input
            type="range"
            className="volume-slider"
            min="0"
            max="100"
            value={isMuted ? 0 : volume * 100}
            onChange={handleVolumeChange}
            style={{
              background: `linear-gradient(to right, var(--accent-main) ${(isMuted ? 0 : volume) * 100}%, rgba(255, 255, 255, 0.1) ${(isMuted ? 0 : volume) * 100}%)`,
            }}
          />
        </div>

        <button
          className={`control-btn ${showLyrics ? "active" : ""}`}
          onClick={() => setShowLyrics(!showLyrics)}
          title={t("player.lyrics")}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 18V5l12-2v13"></path>
            <circle cx="6" cy="18" r="3"></circle>
            <circle cx="18" cy="16" r="3"></circle>
          </svg>
        </button>

        <button
          className="control-btn"
          onClick={onToggleFullNowPlaying}
          title={t("player.fullNowPlaying")}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ opacity: 0.8 }}
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M15 3v18" />
          </svg>
        </button>
        <button
          className="control-btn"
          onClick={onToggleQueue}
          title={t("player.queue")}
        >
          <QueueIcon size={18} />
        </button>
      </div>
    </div>
  );
};

export default PlayerBar;
