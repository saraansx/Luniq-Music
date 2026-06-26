# Changelog

All notable changes to Lune will be documented in this file.

## [1.0.6] - 2026-06-21

### Audio Engine, Search & Playback

#### Added

- **Audio Engine Selector:** Added a dropdown in Playback settings to switch between `youtubei.js` and `yt-dlp` audio backends. The selected engine is persisted and applied to streaming, downloads, and cache clearing.
- **Dual Engine Instantiation:** Both `youtubei.js` and `yt-dlp` engines are created at startup. The active engine is resolved on each stream/download request, so switching does not require an app restart.
- **Engine Change Logs:** Console logs now report audio engine changes in both the renderer (`[Audio Engine] Switched to: ...`) and main process (`[Audio Engine] Active engine: ...`).
- **Automatic Engine Fallback:** If the selected audio engine fails to resolve a stream or download, the app automatically retries with the opposite engine before giving up.
- **Increased Prefetch Count:** The stream prefetcher now fetches the next 2 upcoming tracks in the background instead of 1, improving gapless playback reliability.
- **New Audio Engine (youtubei.js):** Replaced the previous stream resolver with a fully native `youtubei.js`-powered audio engine. No external binaries required for stream resolution — faster, cleaner, and more reliable.
- **YouTube + Spotify Integrated Universal Search:** Search now queries both YouTube Music and Spotify simultaneously, merging results into a single unified view with deduplication.
- **Smarter Track Matching (ArchiveTune Algorithm):** The audio engine now selects the best YouTube video for a track using a multi-factor scoring system ported from ArchiveTune — tokenized title/artist coverage checks, strict duration filtering, and a weighted scoring system. No more accidental covers, karaoke, or wrong versions.
- **Extended Client Fallback Chain:** Stream resolution now attempts multiple YouTube clients in order before giving up: `TV → IOS → IOS_MUSIC → ANDROID → ANDROID_MUSIC → ANDROID_VR → TVHTML5 → WEB_REMIX → WEB → DEFAULT`. Drastically reduces playback failures.
- **Explicit Opus Preference:** The `youtubei.js` engine now selects the Opus codec first within WEBM audio formats, falling back to AAC only if Opus is unavailable. The `yt-dlp` engine also prefers Opus-bearing WEBM streams.
- **Last Successful Client Memory:** The `youtubei.js` engine now remembers which YouTube client successfully resolved a video and tries that client first on the next fetch, speeding up repeat plays and skips.
- **Smarter Stream URL Caching:** Stream URLs are now cached until their real `expire=` timestamp (minus a 60-second safety margin) instead of a fixed 30-minute TTL, preventing playback failures from stale URLs.
- **Playback Error Recovery:** When a stream fails with `MEDIA_ELEMENT_ERROR`, the player now invalidates that track's cached URL, fetches a fresh URL, and automatically tries the fallback audio engine (`yt-dlp` ↔ `youtubei.js`) before skipping.
- **One-Retry Guard:** A per-track retry guard prevents infinite error loops — if recovery fails once, the track is skipped.
- **Stream URL HEAD Validation:** Before returning a stream URL, the main process sends a `HEAD` request to verify it responds with 2xx. If it returns 403/404/410, the URL is rejected and the next engine/client is tried.
- **Per-Track Cache Invalidation:** New `invalidate-stream-cache` IPC handler clears the cached stream URL for a specific track across both audio engines.
- **Autoplay Queue UI:** Queue panel now shows a dedicated "Next in Autoplay" section below the regular queue (Spotify-style), with a live loading indicator while the radio pool is being filled.

### Bug Fixes & Code Cleanup

#### Changed
- **Reliable yt-dlp Updater:** Completely rewrote the `yt-dlp` update mechanism. The app now directly queries the official GitHub API on every launch and downloads the newest binary release automatically, completely bypassing unreliable native updater commands.
- **Cleaner Error Logging:** Silenced massive error stack traces in the console when `yt-dlp` is missing or when cache clears fail during a background download.
- **Cache Invalidation Alignment:** `youtubei.js` and `yt-dlp` cache invalidation now targets the correct `webm` cache key, matching the engines' internal behavior.

#### Fixed
- **Autoplay Queue Persistence:** The "Next in Autoplay" pool is now saved to local storage and restored on app restart. Previously it was lost every time the app closed.
- **Lyrics Auto-Scroll Dragging Header:** Fixed a bug where the lyrics auto-scroll would pull the album art, track name, and close button upward along with the lyrics. Replaced `scrollIntoView` (which could scroll the whole overlay) with a scoped `scrollTo` call on the lyrics content container only.
- **yt-dlp Binary Update Failure:** Fixed a bug where `yt-dlp.exe` could not update in production builds because it was locked inside the read-only `.asar` package. The binary is now correctly migrated to the user's local `AppData` directory upon launch, granting it full permissions to overwrite itself.
- **Build Configuration Schema:** Suppressed false-positive IDE schema warnings in `electron-builder.json` by removing the outdated schema URL.
- **Type Declaration Missing:** Restored Vite's client typings (`/// <reference types="vite/client" />`) in `vite-env.d.ts` to fix missing module errors for image assets in the IDE.

## [1.0.5] - 2026-06-18

### Stability & Bug Fixes

#### Fixed

- **Native Module Crash (Critical):** Fixed a critical "stack-based buffer overrun" crash that occurred randomly due to an ABI mismatch between Electron's internal Node.js engine and native modules (like `better-sqlite3`).

## [1.0.4] - 2026-06-13

### Audio Engine, Discord RPC & Reliability Overhaul

This release is a major under-the-hood upgrade focused on audio quality, rich presence stability, playback reliability, and infrastructure hardening.

#### Added

- **Appearance Settings & Theme Context:** A new `ThemeProvider` enables dynamic accent color selection and layout density modes (Comfortable/Compact/Cozy), all persisted via `electron-store`.
- **Home Page Redesign:** New Home view with curated section layouts, responsive card grids, and compact-mode density support.
- **Custom NSIS Installer:** A custom Windows installer script with user-selectable post-install options: create desktop shortcut, launch on startup, open immediately.
- **yt-dlp Auto-Updater:** The app automatically checks for `yt-dlp` binary updates once per day on startup. A manual "Check for Updates" trigger is also exposed in the Settings UI.
- **yt-dlp Auto-Repair:** If the `yt-dlp` binary becomes corrupted (e.g. PyInstaller decompression failure, exit code `4294967295`), the app now automatically detects this and downloads a fresh binary from the official GitHub releases to self-heal — no manual intervention required.
- **YouTube Cookie Harvesting:** The main process silently opens a hidden browser partition to harvest fresh YouTube session cookies and passes them to `yt-dlp`, improving stream fetch success rates and bypassing some geo-restrictions.
- **Audio Output Device Switching:** The player now supports switching the audio output device at runtime via `setSinkId`, allowing users to route audio to any connected speaker or headset.
- **Playback Speed Control:** Real-time playback speed adjustment exposed through settings and applied directly to the HTML audio element.
- **Structured Data & SEO:** Added `schema.org` structured data, `robots.txt`, and `sitemap.xml` for better discoverability.

#### Changed

- **yt-dlp Multi-Client Fallback:** Stream fetching now tries multiple YouTube player clients (`mweb`, `default`) in sequence. If the primary client is blocked, the app silently falls back instead of failing.
- **Streaming Handler Robustness:** Enhanced retry logic, in-memory URL caching (30 min TTL), and deduplication of concurrent fetches for the same track ID. Multiple components requesting the same stream now share a single network request.
- **Autoplay Radio Pool:** The `AutoplayQueue` radio pool system now seeds from the tail of the queue for better continuity, shuffles candidates immediately, and de-duplicates by recent artist history for variety.
- **Close-to-Tray Behavior:** The window `close` event is intercepted and the app hides to tray by default, with user-configurable option to close outright.
- **Improved RPC Stability:** Discord RPC now handles connection failures gracefully with a proper retry strategy. An unresponsive or absent Discord client no longer throws unhandled errors.
- **PlayerBar Enhancements:** Improved player bar UI interactions, state synchronization, and progress bar sizing.

#### Fixed

- **yt-dlp Binary Corruption (Critical):** Fixed a crash-to-desktop bug affecting all users where a corrupted `yt-dlp.exe` triggered a Windows stack-buffer-overrun error (`0xC0000409`). The PyInstaller bootstrap was failing to decompress internal modules. The app now auto-repairs by re-downloading a clean binary from GitHub — no manual fix required.
- **Ghost Song / Audio Bleed:** Fixed a race condition where rapidly skipping tracks would leave the previous track's audio element playing beneath the new one. The audio element source is now force-cleared and reloaded on every track change.
- **Memory Leak in Prefetch Map:** The audio URL prefetch cache is now bounded and auto-pruned to 5 entries, preventing long listening sessions from leaking RAM.
- **Audio Graph CPU Waste:** The `AnalyserNode` is now only connected when Volume Normalization is active, preventing unnecessary DSP computation during normal playback.
- **CPU Drain on Normalization:** The normalization interval is now properly cleaned up when normalization is disabled or the track is paused, stopping a background polling loop that ran indefinitely.

## [1.0.3] - 2026-03-14


### Self-Healing Authentication & Session Resiliency

This update introduces a robust, proactive authentication system that automatically recovers from expired Spotify tokens and transient network failures, ensuring uninterrupted playback and account access.

#### Added

- **Dynamic Languages Support:** Added support for dynamically loading translations and changing the application language.
- **Windows Taskbar Controls (Thumbar):** Added a native Windows thumbnail toolbar with quick-access playback controls (Previous, Play/Pause, Next) you can use while hovering over the app icon.
- **Real-time 401 Error Detection:** The application now actively monitors all Spotify API requests for "Unauthorized" (401) responses. If a session expires while the app is running, it instantly triggers a background recovery instead of waiting for a scheduled timer.
- **Proactive Token Refresh:** Implemented a global `onUnauthorized` hook that bridges all API endpoints to the main authentication controller, allowing for immediate "self-healing" of the application state.

#### Changed

- **Progress Bar UI Refinement:** Improved the visual design of the player bar by resizing the progress bar to make it larger and easier to click.
- **Improved Session Resiliency:** Refactored the authentication lifecycle in `main.tsx` to hold onto user credentials during transient errors. The app no longer "gives up" on a session due to a single failed refresh, preventing users from being kicked to the "Log out anyway" setting state.
- **Bypassable Refresh Cooldown:** Modified the Electron background process to ignore the standard 10-second refresh cooldown if a hard 401 error is detected, ensuring music playback and settings can recover the millisecond a connection is restored.

#### Fixed

- **Clear Queue Logic:** Fixed a bug where clicking the "Clear Queue" button wouldn't properly clear the list if Shuffle mode was enabled.
- **Persistent "Log out anyway" Bug:** Fixed a logic error where the app would mark a session as invalid if a background refresh failed once, which previously forced users to manually log out and back in to fix the "Could not load profile" error in settings.
- **Refresh Timer Suspension:** Corrected a bug in the token refresh logic where an already-expired token would wait 5 minutes to retry; it now retries in the background with increasing frequency while keeping the UI active.

## [1.0.2] - 2026-03-12

### Remote Plugin System & Reliability Overhaul

This update eliminates the need for app updates when Spotify changes their API hashes, fixes critical YouTube playback failures, and adds a full Downloads management experience.

#### Added

- **Gapless Autoplay Transition:** The `AutoplayQueue` radio tracks are now fully integrated into the stream prefetcher. When the player queue falls back to the autoplay list, the next track's audio is fetched in the background before the current song finishes, ensuring instant gapless playback transitions.
- **Backend Application Logs:** Internal application logs, including the Rate Limiter, Radio Pool engine, and Stream Prefetcher, are now dynamically intercepted from the React frontend and bridged directly into the Electron main process logs for easier debugging in the Lune Settings.
- **Remote Hash Registry:** All Spotify GraphQL persisted-query hashes are now fetched from a remote GitHub Gist at runtime instead of being hardcoded. If a hash breaks, it can be fixed by editing the gist — no app update required. Hashes are cached in memory with a 30-minute TTL, with graceful fallback to stale cache if the remote fetch fails.
- **Downloads View:** Brand new dedicated Downloads page with full track listing, virtualized scrolling (handles thousands of tracks), shuffle play, queue management, and per-track context menus (play next, add to queue, favorite, add to local playlist, remove download).
- **Download Settings:** New settings panel to view and change the download storage location with a folder picker.
- **Star on GitHub Prompt:** A non-intrusive, glassmorphism-styled popup that asks users to star the GitHub repo after their second session. Includes "Maybe Later" dismiss and remembers if the user has already starred.
- **GitHub Feature Request Template:** Added a structured YAML-based issue template for feature requests.

#### Changed

- **YouTube Playback Fallback Strategies:** Implemented multi-client fallback for `yt-dlp` stream fetching. If the primary YouTube API client fails, the system now automatically tries alternative clients before giving up, dramatically improving playback success rates.
- **Player Context Improvements:** Significant refactoring of `PlayerContext` to improve state management, queue handling, and playback reliability. Enhanced error handling for edge cases during track transitions.
- **Streaming Handler Robustness:** Updated `electron/handlers/streaming.ts` with better error recovery, retry logic, and cache management for audio streams.
- **Electron Main Process:** Enhanced window management, IPC handlers, settings persistence (`electron-store`), and yt-dlp binary path resolution. Improved error handling throughout the main process.
- **PlayerBar Enhancements:** Improved player bar UI interactions and state synchronization.
- **Playlist Component:** Refactored playlist display with better error handling and type safety.
- **Artist View:** Improved artist page data handling and layout.
- **Updated Dependencies:** Bumped `package-lock.json` and various dependency versions.

#### Fixed

- **YouTube Playback Loop:** Fixed a critical bug where the application would repeatedly clear its cache and re-fetch stream URLs in an infinite loop, completely preventing playback. The cache-clearing logic and URL fetching triggers have been corrected to ensure seamless audio playback.
- **Spotify Hash Breakage:** By moving to remote hashes, the app no longer becomes non-functional when Spotify rotates their internal API hashes — a problem that previously required pushing an app update to fix.
- **Download Indicator Scoping:** Improved download progress indicator to correctly scope updates to individual tracks.
- **Login Flow:** Minor improvements to the login component for better reliability.

## [1.0.1] - 2026-03-05

### Performance Optimizations (V2 Patch)

This update dramatically reduces RAM usage and CPU load, specifically targeting memory leaks during long listening sessions and DOM freezing on massive playlists. It should feel significantly faster to start up and smoother to scroll.

#### Changed

- **DOM Virtualization in Downloads:** the native list was replaced with `react-virtuoso`. The Downloads view now easily handles 3,000+ tracks without freezing the application DOM.
- **Code Split Views:** Converted 8 non-essential views (`Settings`, `Downloads`, `Lyrics`, `Queue`, etc.) from eager imports to deferred `React.lazy()` imports. This directly removes unused JavaScript from your RAM on startup and makes app launch faster. Included a smooth fall-back loader mask during transition.
- **Image Lazy Loading:** Added `loading="lazy"` tags to dozens of cover-art `<img>` elements (Playlist, Downloads, Search, Artist View, etc.). Browser no longer forcibly downloads 200 high-res thumbnails off-screen all at once.
- **Consolidated `SpotifyGqlApi` context:** Replaced 5 concurrent, identical Spotify API instances running in `main`, `Playlist`, `SearchView`, etc. with a single memoized application-level `ApiContext`.

#### Fixed

- **Liked Songs Empty/Failing:** Updated the internal Spotify queries and implemented an automatic background hash scraper that keeps your Liked Songs fetching correctly from the Spotify API.
- **Memory Leak in Audio Prefetching:** The Player `prefetchMap` was storing all previously fetched background audio URLs permanently in a massive object, leaking RAM over several hours of listening. It is now strictly capped to auto-prune, and only ever holds the 5 most recent tracks in memory.
- **CPU Drain on Active Downloads:** The `DownloadIndicator` component was reacting to global download progress instead of scoped progress. A single active download no longer triggers hundreds of pointless global re-renders on the track-list page per second natively. Each indicator now only listens for and re-renders on its own specific `trackId` progress tick.
