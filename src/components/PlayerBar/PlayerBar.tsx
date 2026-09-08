import React, { useState, useEffect, useRef } from "react";
import { LuniqSpatialEngine } from '../../services/audio/LuniqSpatialEngine';
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
import type { LuniqTrack } from "../../types/track";

interface LocalPlaylist {
  id: string;
  name: string;
  [key: string]: unknown;
}

const PlayerBar: React.FC<{
  onArtistSelect?: (id: string | null, name: string) => void;
  accessToken?: string;
  isHidden?: boolean;
}> = ({ onArtistSelect, accessToken, isHidden }) => {
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
    spatialAudioEnabled,
    spatialAudioMode,
    spatialWidth,
    spatialRoomSize,
    spatialBassBoost,
    spatialVocalClarity,
    spatialTubeWarmth,
    crossfadeDuration,
  } = usePlayback();

  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const spatialEngineRef = useRef<LuniqSpatialEngine | null>(null);
  const normalizationIntervalRef = useRef<number | null>(null);
  const eqBandsRef = useRef<BiquadFilterNode[]>([]);
  const rpcSyncIntervalRef = useRef<number | null>(null);
  const isCrossfadingRef = useRef<boolean>(false);

  // 1. Initialize persistent Web Audio API graph once
  const initAudioGraph = React.useCallback(() => {
    if (!audioRef.current || audioCtxRef.current) return;

    try {
      console.log("[Audio] Initializing persistent Web Audio API graph...");
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      let audioCtx = (window as any).__luniqAudioCtx;
      if (!audioCtx || audioCtx.state === 'closed') {
        audioCtx = new AudioCtx();
        (window as any).__luniqAudioCtx = audioCtx;
        (audioRef.current as any).__mediaSourceNode = null;
      }
      audioCtxRef.current = audioCtx;

      if (audioDeviceId && audioDeviceId !== "default" && (audioCtx as any).setSinkId) {
        (audioCtx as any).setSinkId(audioDeviceId).catch((err: any) => {
          console.warn("[Audio] Could not set AudioContext output device (fallback to default):", err);
        });
      }

      let source = (audioRef.current as any).__mediaSourceNode;
      if (!source) {
        source = audioCtx.createMediaElementSource(audioRef.current);
        (audioRef.current as any).__mediaSourceNode = source;
      }
      sourceRef.current = source;

      const gainNode = audioCtx.createGain();
      gainNode.gain.value = isMuted ? 0 : Math.max(0, Math.min(1, volume));
      gainNodeRef.current = gainNode;

      const analyzer = audioCtx.createAnalyser();
      analyzer.fftSize = 256;
      analyzerRef.current = analyzer;

      const spatialEngine = new LuniqSpatialEngine(audioCtx);
      spatialEngineRef.current = spatialEngine;

      const freqs = [60, 230, 910, 3600, 14000];
      const eqFilters = freqs.map((freq, i) => {
        const filter = audioCtx.createBiquadFilter();
        if (i === 0) {
          filter.type = "lowshelf";
          filter.Q.value = 0.707;
        } else if (i === 4) {
          filter.type = "highshelf";
          filter.Q.value = 0.707;
        } else {
          filter.type = "peaking";
          filter.Q.value = i === 1 ? 0.85 : i === 2 ? 0.90 : 0.95;
        }
        filter.frequency.value = freq;
        filter.gain.value = eqEnabled ? (eqBands[i] || 0) : 0;
        return filter;
      });
      eqBandsRef.current = eqFilters;

      // Construct permanent static signal chain:
      // source -> eqFilters[0..4] -> spatialEngine -> gainNode -> destination
      let current: AudioNode = source;
      eqFilters.forEach((filter) => {
        current.connect(filter);
        current = filter;
      });

      current.connect(spatialEngine.inputNode);
      spatialEngine.outputNode.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      try { source.connect(analyzer); } catch (_) {}

      // Initial DSP configuration
      spatialEngine.applyConfig({
        enabled: spatialAudioEnabled,
        mode: spatialAudioMode,
        bassBoost: spatialBassBoost,
        vocalClarity: spatialVocalClarity,
        tubeWarmth: spatialTubeWarmth,
        crossfeed: true,
        spatialWidth: spatialWidth || 1.4,
        roomSize: spatialRoomSize || 'medium',
        reverbMix: 1.0,
      });

      if (monoAudio) {
        gainNode.channelCount = 1;
        gainNode.channelCountMode = "explicit";
      }

      console.log("[Audio] Persistent Web Audio graph successfully constructed.");
    } catch (err: any) {
      console.warn("[Audio] Web Audio initialization notice:", err?.message || err);
    }
  }, [audioDeviceId]);

  // Mount Audio Graph on start
  useEffect(() => {
    initAudioGraph();
  }, [initAudioGraph]);

  // Dynamic DSP Parameter Automation (Glitchless transition in/out of 3D spatial mode)
  useEffect(() => {
    if (spatialEngineRef.current && audioCtxRef.current) {
      const apply = () => {
        spatialEngineRef.current?.applyConfig({
          enabled: spatialAudioEnabled,
          mode: spatialAudioMode,
          bassBoost: spatialBassBoost,
          vocalClarity: spatialVocalClarity,
          tubeWarmth: spatialTubeWarmth,
          crossfeed: true,
          spatialWidth: spatialWidth || 1.4,
          roomSize: spatialRoomSize || 'medium',
          reverbMix: 1.0,
        });
      };

      if (audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume().then(apply).catch(() => apply());
      } else {
        apply();
      }
    }
  }, [spatialAudioEnabled, spatialAudioMode, spatialWidth, spatialRoomSize, spatialBassBoost, spatialVocalClarity, spatialTubeWarmth]);

  // Accurate Real-Time Listening Time Heartbeat (Flushes real played seconds to SQLite every 5s)
  useEffect(() => {
    if (!isPlaying || !currentTrack) return;

    let accumulatedSeconds = 0;
    const interval = setInterval(() => {
      accumulatedSeconds += 5;
      if (window.ipcRenderer && currentTrack?.id) {
        const artist = Array.isArray(currentTrack.artists)
          ? currentTrack.artists.map((a: any) => typeof a === 'string' ? a : (a.name || '')).join(', ')
          : currentTrack.artist || 'Unknown Artist';

        window.ipcRenderer.invoke('record-listening-time', {
          trackId: currentTrack.id,
          trackName: currentTrack.name,
          artist: artist,
          seconds: 5
        }).catch(() => {});
      }
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [isPlaying, currentTrack?.id]);

  // Mono/Stereo audio toggle
  useEffect(() => {
    if (gainNodeRef.current) {
      if (monoAudio) {
        gainNodeRef.current.channelCount = 1;
        gainNodeRef.current.channelCountMode = "explicit";
      } else {
        gainNodeRef.current.channelCount = 2;
        gainNodeRef.current.channelCountMode = "max";
      }
    }
  }, [monoAudio]); 

  
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

  
  useEffect(() => {
    if (isPlaying && audioCtxRef.current?.state === "suspended") {
      audioCtxRef.current.resume().catch(() => {});
    }
  }, [isPlaying]);

  
  useEffect(() => {
    const applyDevice = async () => {
      const sinkId = audioDeviceId === "default" ? "" : audioDeviceId;

      // Apply to AudioContext if active (since it controls output when Web Audio API is engaged)
      if (audioCtxRef.current && (audioCtxRef.current as any).setSinkId) {
        try {
          console.log(`[Audio] Switching AudioContext output device to: ${audioDeviceId}`);
          await (audioCtxRef.current as any).setSinkId(sinkId);
        } catch (err) {
          console.error("[Audio] Failed to set AudioContext output device:", err);
        }
      }

      // Apply to HTMLAudioElement (for fallback/direct routing when graph is bypassed)
      if (audioRef.current && (audioRef.current as any).setSinkId && sinkId) {
        try {
          console.log(`[Audio] Switching HTMLAudioElement output device to: ${audioDeviceId}`);
          await (audioRef.current as any).setSinkId(sinkId);
        } catch (err: any) {
          console.warn("[Audio] HTMLAudioElement setSinkId notice (default device active):", err?.message || err);
        }
      }
    };
    applyDevice();
  }, [audioDeviceId]);

                                                                
  useEffect(() => {
    if (audioRef.current) {
      console.log(`[Audio] Setting playbackRate to: ${playbackSpeed}x`);
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

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
  const onToggleQueue = () => {
    const nextState = !showQueue;
    if (nextState) {
      setShowFullNowPlaying(false);
      setShowLyrics(false);
    }
    setShowQueue(nextState);
  };
  const onToggleFullNowPlaying = () => {
    const nextState = !showFullNowPlaying;
    if (nextState) {
      setShowLyrics(false);
      setShowQueue(false);
    }
    setShowFullNowPlaying(nextState);
  };
  const onToggleLyrics = () => {
    const nextState = !showLyrics;
    if (nextState) {
      setShowFullNowPlaying(false);
      setShowQueue(false);
    }
    setShowLyrics(nextState);
  };

  const onPrev = () => handlePrevTrack(currentTime);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const isSeekingRef = useRef(false);
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;
  const [trackDuration, setTrackDuration] = useState(0);


  const [prevVolume, setPrevVolume] = useState(0.8);
  const isFirstLoad = useRef(true);
  const lastSavedTime = useRef(0);
  const activeTrackId = useRef<string | null>(null);
  const streamRetryCount = useRef(0);
  const hasRetriedAfterError = useRef(false);
  const isRadioFetching = useRef(false);
  const progressTimeoutRef = useRef<number | null>(null);


  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [localPlaylists, setLocalPlaylists] = useState<LocalPlaylist[]>([]);
  const [trackPlaylists, setTrackPlaylists] = useState<string[]>([]);
  const [showPlaylistSubmenu, setShowPlaylistSubmenu] = useState(false);
  const [isDownloadState, setIsDownloadState] = useState<boolean | null>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  
  
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
          
          const randomized = shuffleArray(radioTracks);

          const recentIds = new Set<string>();
          recentIds.add(currentTrack.id);
          for (const t of sessionHistoryRef.current) recentIds.add(t.id);
          for (const t of historyRef.current) recentIds.add(t.id);
          for (const t of contextTracksRef.current) recentIds.add(t.id);
          for (const t of autoplayQueueRef.current) recentIds.add(t.id);

          const filteredTracks = randomized.filter((t) => !recentIds.has(t.id));
          logToSystem(
            `[Radio Pool] Filtered pool: ${filteredTracks.length} unique tracks remaining.`,
          );

          const varietyTracks: LuniqTrack[] = [];
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
            `[Radio Pool] Appended ${poolTracks.length} tracks. First up: "${poolTracks[0]?.name}"`,
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

    window.addEventListener("luniq:trigger-pool-fetch", fillPool);

    return () => {
      ignorePoolFetch = true;
      window.removeEventListener("luniq:trigger-pool-fetch", fillPool);
    };
    
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

  
  // Hardware-accelerated smooth volume control (GainNode driven to prevent MediaElement decoder stutter)
  useEffect(() => {
    // Keep raw HTML audio element at unity gain so Chromium decoder does not re-quantize buffers
    if (audioRef.current && audioRef.current.volume !== 1.0) {
      audioRef.current.volume = 1.0;
    }
    const targetVolume = isMuted ? 0 : Math.max(0, Math.min(1, volume));
    if (gainNodeRef.current && audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      try {
        const time = audioCtxRef.current.currentTime;
        gainNodeRef.current.gain.cancelScheduledValues(time);
        gainNodeRef.current.gain.setValueAtTime(gainNodeRef.current.gain.value, time);
        gainNodeRef.current.gain.linearRampToValueAtTime(targetVolume, time + 0.02);
      } catch (_) {}
    }
  }, [volume, isMuted]);

  const abortControllerRef = useRef<AbortController | null>(null);

  
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

  
  useEffect(() => {
    if (showMoreMenu) {
      setShowMoreMenu(false);
      setShowPlaylistSubmenu(false);
    }
    
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
      window.dispatchEvent(new Event("luniq:download-update"));
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
        window.dispatchEvent(new Event("luniq:playlist-tracks-update"));
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

  const fetchStreamUrl = React.useCallback(
    async (options: {
      forceRefresh?: boolean;
      preferFallback?: boolean;
      skipPrefetch?: boolean;
    } = {}) => {
      if (!currentTrack) return;
      const trackId = currentTrack.id;
      const { forceRefresh = false, preferFallback = false, skipPrefetch = false } =
        options;

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const prefetched = prefetchMap[trackId];
      const isStale = prefetched
        ? Date.now() - prefetched.timestamp > 30 * 60 * 1000
        : true;

      if (
        prefetched &&
        !isStale &&
        streamRetryCount.current === 0 &&
        !forceRefresh &&
        !skipPrefetch
      ) {
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
          currentTrack.durationMs || 0,
          forceRefresh,
          preferFallback,
        );

        if (controller.signal.aborted) return;

        if (url && currentTrack?.id === trackId) {
          setStreamUrl(url);
        } else if (!url && currentTrack?.id === trackId) {
          if (streamRetryCount.current < 2) {
            streamRetryCount.current += 1;
            await new Promise((r) => setTimeout(r, 2000));
            return fetchStreamUrl(options);
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

          if (streamRetryCount.current < 2) {
            streamRetryCount.current += 1;
            await new Promise((r) => setTimeout(r, 2000));
            return fetchStreamUrl(options);
          } else {
            onNext();
          }
        }
      } finally {
        if (currentTrack?.id === trackId) {
          setIsLoading(false);
        }
      }
    },
    [currentTrack?.id, prefetchMap],
  ); 

  
  useEffect(() => {
    if (!currentTrack) return;

    
    if (activeTrackId.current !== currentTrack.id) {
      
      if (audioRef.current) {
        audioRef.current.pause();
        
        if (audioRef.current.src) {
          audioRef.current.removeAttribute("src");
          audioRef.current.load();
        }
      }

      setStreamUrl(null);
      setProgress(0);
      setCurrentTime(0);
      setTrackDuration(currentTrack.durationMs / 1000); 
      setIsLoading(false);
      setShowMoreMenu(false);
      setShowPlaylistSubmenu(false);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      activeTrackId.current = currentTrack.id;
      streamRetryCount.current = 0;
      hasRetriedAfterError.current = false;
    }

    
    if (!streamUrl && !isLoading && currentTrack) {
      fetchStreamUrl();
    }

    
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed; 

      if (streamUrl) {
        
        if (audioRef.current.src !== streamUrl) {
          audioRef.current.src = streamUrl;
        }

        if (isPlaying) {
          
          if (audioCtxRef.current?.state === "suspended") {
            audioCtxRef.current.resume();
          }
          
          // Restore Web Audio DSP gain node to current volume level
          if (gainNodeRef.current && audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
            try {
              const currentVol = isMuted ? 0 : Math.max(0, Math.min(1, volume));
              gainNodeRef.current.gain.cancelScheduledValues(audioCtxRef.current.currentTime);
              gainNodeRef.current.gain.setValueAtTime(currentVol, audioCtxRef.current.currentTime);
            } catch (_) {}
          }

          const playPromise = audioRef.current.play();
          if (playPromise !== undefined) {
            playPromise.catch(() => {
              
            });
          }
        } else {
          audioRef.current.pause();
        }
      } else {
        audioRef.current.pause();
      }
    }

    
    if (isFirstLoad.current) {
      const savedTrackId = localStorage.getItem("luniq_player_track_id");
      if (savedTrackId === currentTrack.id) {
        const savedProgress = parseFloat(
          localStorage.getItem("luniq_player_progress") || "0",
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

    
  }, [currentTrack?.id, isPlaying, streamUrl, isLoading, fetchStreamUrl]);

  
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
            trackId: currentTrack.id,
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

  
  useEffect(() => {
    window.ipcRenderer?.send("thumbar-update", { isPlaying, hasTrack: !!currentTrack });
  }, [isPlaying, !!currentTrack]);

  // System Media Transport Controls (SMTC) & Headphone Touch Controls Integration
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    if (!currentTrack) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
      return;
    }

    try {
      const artwork = currentTrack.albumArt ? [
        { src: currentTrack.albumArt, sizes: '96x96', type: 'image/jpeg' },
        { src: currentTrack.albumArt, sizes: '128x128', type: 'image/jpeg' },
        { src: currentTrack.albumArt, sizes: '192x192', type: 'image/jpeg' },
        { src: currentTrack.albumArt, sizes: '256x256', type: 'image/jpeg' },
        { src: currentTrack.albumArt, sizes: '512x512', type: 'image/jpeg' },
      ] : [];

      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.name || 'Unknown Track',
        artist: currentTrack.artist || 'Unknown Artist',
        album: currentTrack.albumName || 'Luniq Music',
        artwork: artwork,
      });
    } catch (err) {
      console.warn('[MediaSession] Failed to set metadata:', err);
    }
  }, [currentTrack?.id, currentTrack?.name, currentTrack?.artist, currentTrack?.albumName, currentTrack?.albumArt]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    const updatePositionState = () => {
      try {
        const dur = audioRef.current?.duration || (trackDuration || (currentTrack?.durationMs ? currentTrack.durationMs / 1000 : 0));
        const cur = audioRef.current?.currentTime || currentTime;
        if (dur > 0 && cur >= 0 && cur <= dur) {
          navigator.mediaSession.setPositionState({
            duration: Math.max(0, dur),
            playbackRate: playbackSpeed || 1,
            position: Math.max(0, Math.min(cur, dur)),
          });
        }
      } catch {
        // Ignored if audio is transitioning or seeking
      }
    };

    updatePositionState();
  }, [currentTime, trackDuration, currentTrack?.durationMs, playbackSpeed]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    const actionHandlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ['play', () => setIsPlaying(true)],
      ['pause', () => setIsPlaying(false)],
      ['stop', () => {
        setIsPlaying(false);
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
        }
      }],
      ['previoustrack', () => {
        onPrevRef.current(currentTimeRef.current);
      }],
      ['nexttrack', () => {
        onNextRef.current();
      }],
      ['seekto', (details) => {
        if (details.seekTime !== undefined && audioRef.current) {
          audioRef.current.currentTime = details.seekTime;
          setCurrentTime(details.seekTime);
          const dur = audioRef.current.duration || (currentTrack?.durationMs ? currentTrack.durationMs / 1000 : 0);
          if (dur > 0) setProgress((details.seekTime / dur) * 100);
          window.dispatchEvent(new CustomEvent("luniq:timeupdate", { detail: { currentTime: details.seekTime, duration: dur } }));
        }
      }],
      ['seekforward', (details) => {
        const offset = details.seekOffset || 10;
        if (audioRef.current) {
          const target = Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + offset);
          audioRef.current.currentTime = target;
          setCurrentTime(target);
        }
      }],
      ['seekbackward', (details) => {
        const offset = details.seekOffset || 10;
        if (audioRef.current) {
          const target = Math.max(0, audioRef.current.currentTime - offset);
          audioRef.current.currentTime = target;
          setCurrentTime(target);
        }
      }],
    ];

    for (const [action, handler] of actionHandlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Some browser engines might not support all optional action handlers
      }
    }

    return () => {
      for (const [action] of actionHandlers) {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          // Ignored
        }
      }
    };
  }, [setIsPlaying, currentTrack?.durationMs]);

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
    window.addEventListener("luniq:restart-track", handleRestart);
    return () =>
      window.removeEventListener("luniq:restart-track", handleRestart);
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

  useEffect(() => {
    const handleQueryTime = () => {
      if (audioRef.current) {
        const cur = audioRef.current.currentTime || 0;
        const dur = audioRef.current.duration || (currentTrack?.durationMs ? currentTrack.durationMs / 1000 : 0);
        window.dispatchEvent(new CustomEvent("luniq:timeupdate", { detail: { currentTime: cur, duration: dur } }));
      }
    };
    window.addEventListener("luniq:query-time", handleQueryTime);
    return () => window.removeEventListener("luniq:query-time", handleQueryTime);
  }, [currentTrack?.durationMs]);

  useEffect(() => {
    const handleRequestSeek = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && typeof customEvent.detail.time === 'number' && audioRef.current) {
        const target = customEvent.detail.time;
        audioRef.current.currentTime = target;
        setCurrentTime(target);
        const dur = audioRef.current.duration || (currentTrack?.durationMs ? currentTrack.durationMs / 1000 : 0);
        if (dur > 0) {
          setProgress((target / dur) * 100);
        }
        window.dispatchEvent(new CustomEvent("luniq:timeupdate", { detail: { currentTime: target, duration: dur } }));
      }
    };
    window.addEventListener("luniq:request-seek", handleRequestSeek);
    return () => window.removeEventListener("luniq:request-seek", handleRequestSeek);
  }, [currentTrack?.durationMs]);

  const handleTimeUpdate = () => {
    if (audioRef.current && !isSeekingRef.current) {
      const current = audioRef.current.currentTime;
      const dur = audioRef.current.duration || (currentTrack?.durationMs ? currentTrack.durationMs / 1000 : 0);
      setCurrentTime(current);
      if (dur && !isNaN(dur) && dur > 0) {
        setProgress((current / dur) * 100);
      }

      window.dispatchEvent(new CustomEvent("luniq:timeupdate", { detail: { currentTime: current, duration: dur } }));

      // Studio Dynamic Crossfade Matrix & Seamless Transition Trigger
      if (dur > 10 && isLoop !== 'one' && crossfadeDuration > 0) {
        const remaining = dur - current;

        if (remaining <= crossfadeDuration && !isCrossfadingRef.current) {
          isCrossfadingRef.current = true;
          console.log(`[PlayerBar] 🎚 Crossfade Matrix blending (${remaining.toFixed(1)}s left, window=${crossfadeDuration}s)`);
          
          if (gainNodeRef.current && audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
            try {
              gainNodeRef.current.gain.cancelScheduledValues(audioCtxRef.current.currentTime);
              gainNodeRef.current.gain.setValueAtTime(1.0, audioCtxRef.current.currentTime);
              gainNodeRef.current.gain.linearRampToValueAtTime(0.05, audioCtxRef.current.currentTime + remaining);
            } catch (_) {}
          }

          // Trigger next track advance smoothly
          handleSkip();
          setTimeout(() => {
            isCrossfadingRef.current = false;
          }, (crossfadeDuration + 1) * 1000);
        }
      }

      if (currentTrack && Math.abs(current - lastSavedTime.current) > 2) {
        localStorage.setItem("luniq_player_progress", String(current));
        localStorage.setItem("luniq_player_track_id", currentTrack.id);
        lastSavedTime.current = current;
      }
    }
  };

  const handleSeekStart = () => {
    isSeekingRef.current = true;
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newProgress = parseFloat(e.target.value);
    const dur = (audioRef.current && !isNaN(audioRef.current.duration) && audioRef.current.duration > 0)
      ? audioRef.current.duration
      : (trackDuration || (currentTrack?.durationMs ? currentTrack.durationMs / 1000 : 0));

    setProgress(newProgress);
    if (dur && dur > 0) {
      const previewTime = (newProgress / 100) * dur;
      setCurrentTime(previewTime);
    }
  };

  const handleSeekEnd = (e: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement> | React.KeyboardEvent<HTMLInputElement>) => {
    isSeekingRef.current = false;

    const inputVal = parseFloat((e.target as HTMLInputElement).value);

    const dur = (audioRef.current && !isNaN(audioRef.current.duration) && audioRef.current.duration > 0)
      ? audioRef.current.duration
      : (trackDuration || (currentTrack?.durationMs ? currentTrack.durationMs / 1000 : 0));

    if (dur && dur > 0 && !isNaN(inputVal)) {
      const targetTime = (inputVal / 100) * dur;
      if (audioRef.current) {
        audioRef.current.currentTime = targetTime;
      }
      if (gainNodeRef.current && audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        try {
          const currentVol = isMuted ? 0 : Math.max(0, Math.min(1, volume));
          gainNodeRef.current.gain.cancelScheduledValues(audioCtxRef.current.currentTime);
          gainNodeRef.current.gain.setValueAtTime(currentVol, audioCtxRef.current.currentTime);
        } catch (_) {}
      }
      setCurrentTime(targetTime);
      setProgress(inputVal);

      window.dispatchEvent(new CustomEvent("luniq:timeupdate", { detail: { currentTime: targetTime } }));

      if (progressTimeoutRef.current) {
        clearTimeout(progressTimeoutRef.current);
      }

      if (currentTrack && isPlaying) {
        progressTimeoutRef.current = window.setTimeout(() => {
          const finalDuration = trackDuration ? trackDuration * 1000 : currentTrack.durationMs;
          window.ipcRenderer
            ?.invoke("update-rpc", {
              title: currentTrack.name,
              artist: currentTrack.artist,
              albumArt: currentTrack.albumArt,
              duration: finalDuration,
              currentTime: targetTime * 1000,
              isPlaying: true,
              trackId: currentTrack.id,
            })
            .catch(console.warn);
        }, 500);
      }
    }
  };


  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Math.max(0, Math.min(1, parseFloat(e.target.value) / 100));
    
    // 1. Direct hardware-level Web Audio GainNode DSP adjustment (immediate zero-latency & zero re-render stutter)
    if (gainNodeRef.current && audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      try {
        const time = audioCtxRef.current.currentTime;
        gainNodeRef.current.gain.cancelScheduledValues(time);
        gainNodeRef.current.gain.setValueAtTime(gainNodeRef.current.gain.value, time);
        gainNodeRef.current.gain.linearRampToValueAtTime(val, time + 0.015);
      } catch (_) {}
    }

    // 2. Keep raw HTML audio element at unity gain so decoder doesn't reset buffers
    if (audioRef.current && audioRef.current.volume !== 1.0) {
      audioRef.current.volume = 1.0;
    }

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

    window.addEventListener("luniq:playlist-update", checkFav);
    return () => {
      window.removeEventListener("luniq:playlist-update", checkFav);
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
      
      window.dispatchEvent(new Event("luniq:playlist-update"));
    } catch (e) {
      console.error("Failed to toggle favorite", e);
    }
  };

  if (!currentTrack) return null;

  return (
    <div 
      className={`player-bar ${isLoading ? "is-loading" : ""}`}
      style={isHidden ? { display: "none" } : undefined}
    >
      <audio
        ref={audioRef}
        src={streamUrl || undefined}
        crossOrigin={streamUrl?.startsWith("luniq-local:") ? undefined : "anonymous"}
        loop={isLoop === "one"}
        onPlay={() => {
          if (audioRef.current) {
            audioRef.current.playbackRate = playbackSpeed;
          }
          if (gainNodeRef.current && audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
            try {
              const currentVol = isMuted ? 0 : Math.max(0, Math.min(1, volume));
              gainNodeRef.current.gain.cancelScheduledValues(audioCtxRef.current.currentTime);
              gainNodeRef.current.gain.setValueAtTime(currentVol, audioCtxRef.current.currentTime);
            } catch (_) {}
          }
          if (!isPlaying) {
            setIsPlaying(true);
          }
        }}
        onPause={() => {
          if (isPlaying && !isCrossfadingRef.current) {
            // Keep state in sync when browser or system pauses playback
          }
        }}
        onTimeUpdate={handleTimeUpdate}
        onEnded={async () => {
          window.ipcRenderer
            ?.invoke("update-rpc", { isPlaying: false })
            .catch(() => {});

          if (isLoop === "one") return;

          // Prevent double-skip if crossfade already advanced to the next track
          if (isCrossfadingRef.current) {
            console.log("[PlayerBar] ⏹ onEnded ignored (already transitioned via Crossfade)");
            return;
          }

          console.log(
            `[PlayerBar] ⏹ onEnded | queue=${queue.length} | track="${currentTrack?.name}" | token=${!!accessToken}`,
          );
          await handleSkip();
        }}
        onError={async (e) => {
          const audio = e.target as HTMLAudioElement;
          const code = audio.error?.code;
          const message = audio.error?.message || "No error message";

          if (code === 2 || code === 4) {
            if (!hasRetriedAfterError.current && currentTrack) {
              hasRetriedAfterError.current = true;
              streamRetryCount.current = 0;
              console.warn(
                `[PlayerBar] Stream error (code ${code}, message: ${message}), retrying with fresh URL + fallback...`,
              );

              await new Promise((r) => setTimeout(r, 2000));

              window.ipcRenderer
                .invoke(
                  "invalidate-stream-cache",
                  currentTrack.name,
                  currentTrack.artist,
                  currentTrack.id,
                )
                .catch(() => {});
              window.ipcRenderer
                .invoke("cancel-stream", currentTrack.id, "player")
                .catch(() => {});

              setStreamUrl(null);
              await fetchStreamUrl({
                forceRefresh: true,
                preferFallback: true,
                skipPrefetch: true,
              });
            } else {
              console.error(
                `[PlayerBar] Stream failed (code ${code}, message: ${message}) after retry, skipping track.`,
              );
              streamRetryCount.current = 0;
              hasRetriedAfterError.current = false;
              setTimeout(() => onNext(), 500);
            }
          }
        }}
        onLoadedMetadata={() => {
          streamRetryCount.current = 0;
          hasRetriedAfterError.current = false;
          if (audioRef.current) {
            audioRef.current.volume = isMuted ? 0 : volume;
            setTrackDuration(audioRef.current.duration); 
            audioRef.current.playbackRate = playbackSpeed; 
            if (currentTime > 0) {
              audioRef.current.currentTime = currentTime;
            }
          }
        }}
        onWaiting={() => {
          // If waiting for buffer during playback, attempt recovery if stalled for > 5s
          if (isPlaying && audioRef.current && !audioRef.current.paused) {
            const stalledAt = audioRef.current.currentTime;
            setTimeout(() => {
              if (
                audioRef.current &&
                isPlaying &&
                audioRef.current.readyState < 3 &&
                Math.abs(audioRef.current.currentTime - stalledAt) < 0.1
              ) {
                console.warn(`[PlayerBar] Audio buffer stalled at ${stalledAt.toFixed(1)}s, attempting resume...`);
                audioRef.current.load();
                audioRef.current.currentTime = stalledAt;
                audioRef.current.play().catch(() => {});
              }
            }, 5000);
          }
        }}
        onCanPlay={() => {
          if (isPlaying && audioRef.current && audioRef.current.paused) {
            if (audioCtxRef.current?.state === "suspended") {
              audioCtxRef.current.resume().catch(() => {});
            }
            audioRef.current.play().catch((err) => {
              console.warn("[PlayerBar] onCanPlay resume error:", err);
            });
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
              className="luniq-dropdown open-up solid-dropdown"
              style={{ bottom: "calc(100% + 15px)", left: "0", right: "auto" }}
            >
              <button
                className="luniq-dropdown-item"
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
                className="luniq-dropdown-item"
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
                  className="luniq-dropdown-item"
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

              <div className="luniq-dropdown-divider" />

              <button
                className={`luniq-dropdown-item ${showPlaylistSubmenu ? "active" : ""}`}
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
                <div className="luniq-submenu">
                  {localPlaylists.length > 0 ? (
                    localPlaylists.map((p) => {
                      const isInPlaylist = trackPlaylists.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          className={`luniq-dropdown-item ${isInPlaylist ? "active" : ""}`}
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
                      className="luniq-dropdown-item disabled"
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
              onMouseDown={handleSeekStart}
              onTouchStart={handleSeekStart}
              onChange={handleProgressChange}
              onMouseUp={handleSeekEnd}
              onTouchEnd={handleSeekEnd}
              onKeyUp={handleSeekEnd}
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
          onClick={onToggleLyrics}
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
          onClick={() => window.ipcRenderer?.invoke("toggle-floating-lyrics")}
          title={t("player.floatingLyrics") || "Floating Lyrics"}
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
            style={{ opacity: 0.8 }}
          >
            <rect x="2" y="6" width="20" height="12" rx="6" ry="6"></rect>
            <path d="M7 12h10"></path>
            <path d="M12 9v6"></path>
          </svg>
        </button>

        <button
          className="control-btn"
          onClick={() => window.ipcRenderer?.invoke("enter-mini-player")}
          title={t("player.miniPlayer") || "Mini Player"}
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
            style={{ opacity: 0.8 }}
          >
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
            <rect x="12" y="9" width="8" height="6" rx="1" fill="currentColor" fillOpacity="0.2"></rect>
          </svg>
        </button>

        <button
          className={`control-btn ${showFullNowPlaying ? "active" : ""}`}
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
