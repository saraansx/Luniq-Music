import './shim.js';
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
import { app, BrowserWindow, ipcMain, Menu, protocol, globalShortcut, session, Tray, nativeImage } from 'electron'
import { autoUpdater } from 'electron-updater'
import * as nodeUrl from 'node:url'
import path from 'node:path'
import { Readable } from 'node:stream';
import os from 'node:os';
import fs from 'fs';
import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import Store from 'electron-store';
import { StoreSchema, schema } from './store.js';
import { registerAllHandlers } from './handlers/index.js';
import { clearRPC } from './handlers/rpc.js';
import { youtubeiAudio, ytdlpAudio, activeSearches, activeDownloads } from './streaming.js';
import { create as createYtDlp } from 'yt-dlp-exec';

const __dirname = path.dirname(nodeUrl.fileURLToPath(import.meta.url))

const isPackaged = app.isPackaged;

const ytDlpBinaryPath = isPackaged 
    ? path.join(app.getPath('userData'), 'yt-dlp.exe')
    : path.join(app.getAppPath(), 'node_modules', 'yt-dlp-exec', 'bin', 'yt-dlp.exe');

if (fs.existsSync(ytDlpBinaryPath)) {
    const customYtDlp = createYtDlp(ytDlpBinaryPath);
    ytdlpAudio.setYtDlpInstance(customYtDlp);
    console.log(`[Main] Using yt-dlp binary at: ${ytDlpBinaryPath}`);
} else {
    console.log('[Main] yt-dlp not found — will download from GitHub');
}

import { addToLog } from './logger.js';

const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

const shouldSuppress = (args: unknown[]): boolean => {
    return typeof args[0] === 'string' && args[0].includes('[YOUTUBEJS]');
};

console.log = (...args: unknown[]) => {
    if (shouldSuppress(args)) return;
    originalLog(...args);
    addToLog('info', ...args);
};

console.warn = (...args: unknown[]) => {
    if (shouldSuppress(args)) return;
    originalWarn(...args);
    addToLog('info', ...args);
};

console.error = (...args: unknown[]) => {
    if (shouldSuppress(args)) return;
    originalError(...args);
    addToLog('error', ...args);
};

process.on('uncaughtException', (error) => {
  console.error('Critical Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Promise Rejection at:', promise, 'reason:', reason);
});

protocol.registerSchemesAsPrivileged([
  { scheme: 'lune-local', privileges: { bypassCSP: true, stream: true, secure: true, standard: true, supportFetchAPI: true } }
]);

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
    }
  })

  const store = new Store<StoreSchema>({ schema: schema as any });
  
  
  store.set('app_version', app.getVersion());

  
  const count = (store.get('startup_count') || 0) + 1;
  store.set('startup_count', count);

  let win: BrowserWindow | null
  let tray: Tray | null = null;
  let isQuitting = false;

  function createWindow() {
  const bounds = store.get('windowBounds');

  
  const iconPath = app.isPackaged 
    ? path.join(process.resourcesPath, 'Lune.png')
    : path.join(app.getAppPath(), 'src', 'assets', 'Lune.png');

  win = new BrowserWindow({
    width: bounds?.width || 1400,
    height: bounds?.height || 800,
    x: bounds?.x,
    y: bounds?.y,
    minWidth: 900,
    minHeight: 600,
    resizable: true,
    icon: iconPath,
    backgroundColor: '#050608',
    frame: false, 
    transparent: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      webSecurity: false,
    },
  })

  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (message.includes('Electron Security Warning')) return;
    if (level >= 2) { 
      const levels = ['debug', 'info', 'warn', 'error'];
      const levelStr = levels[level] || 'log';
      console.log(`[Renderer] [${levelStr.toUpperCase()}] ${message} (${path.basename(sourceId)}:${line})`);
    }
  });

  win.on('resize', () => {
    if (win) store.set('windowBounds', win.getBounds());
  });

  win.on('move', () => {
    if (win) store.set('windowBounds', win.getBounds());
  });

  Menu.setApplicationMenu(null)
                                        
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString());
  })

  win.once('ready-to-show', () => {
    win?.show();
    win?.focus();
    
    setTimeout(() => {
      if (win) setThumbbar(false);
    }, 1000);
  });

  win.on('close', (event) => {
    if (!isQuitting) {
      const behavior = store.get('closeBehavior');
      
      if (behavior !== 'close') {
        event.preventDefault();
        win?.hide();
      }
    }
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

function createTray() {
  if (tray) return;

  const iconPath = app.isPackaged 
    ? path.join(process.resourcesPath, 'Lune.png')
    : path.join(app.getAppPath(), 'src', 'assets', 'Lune.png');

  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Lune', click: () => { win?.show(); win?.focus(); } },
    { type: 'separator' },
    { label: 'Play / Pause', click: () => { win?.webContents.send('tray-action', 'play-pause'); } },
    { label: 'Next Track', click: () => { win?.webContents.send('tray-action', 'next'); } },
    { label: 'Previous Track', click: () => { win?.webContents.send('tray-action', 'previous'); } },
    { type: 'separator' },
    { label: 'Quit', click: () => { isQuitting = true; app.quit(); } }
  ]);
  
  tray.setToolTip('Lune Music');
  tray.setContextMenu(contextMenu);
  
  tray.on('click', () => {
    if (win) {
      if (win.isVisible()) {
        win.focus();
      } else {
        win.show();
        win.focus();
      }
    }
  });
}


function getThumbbarIconPath(name: string) {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'thumbar', `${name}.png`)
    : path.join(app.getAppPath(), 'src', 'assets', 'thumbar', `${name}.png`);
}

function setThumbbar(isPlaying: boolean, hasTrack: boolean = false) {
  if (!win || process.platform !== 'win32') return;

  try {
    if (!hasTrack) {
      win.setThumbarButtons([]);
      return;
    }

    const getIcon = (name: string) => {
      const p = getThumbbarIconPath(name);
      if (fs.existsSync(p)) {
        const buf = fs.readFileSync(p);
        return nativeImage.createFromBuffer(buf);
      }
      return nativeImage.createEmpty();
    };

    const prevIcon = getIcon('prev');
    const midIcon = getIcon(isPlaying ? 'pause' : 'play');
    const nextIcon = getIcon('next');

    win.setThumbarButtons([
      { 
        tooltip: 'Previous', 
        icon: prevIcon,  
        click: () => win?.webContents.send('tray-action', 'previous'),
        flags: prevIcon.isEmpty() ? ['disabled'] : []
      },
      { 
        tooltip: isPlaying ? 'Pause' : 'Play', 
        icon: midIcon, 
        click: () => win?.webContents.send('tray-action', 'play-pause'),
        flags: midIcon.isEmpty() ? ['disabled'] : []
      },
      { 
        tooltip: 'Next',     
        icon: nextIcon,  
        click: () => win?.webContents.send('tray-action', 'next'),
        flags: nextIcon.isEmpty() ? ['disabled'] : []
      },
    ]);
  } catch (err) {
    console.error('[Thumbar] Failed to set buttons:', err);
  }
}

let thumbarDebounce: ReturnType<typeof setTimeout> | null = null;

ipcMain.on('thumbar-update', (_event, payload: any) => {
  if (thumbarDebounce) clearTimeout(thumbarDebounce);
  
  if (typeof payload === 'boolean') {
    thumbarDebounce = setTimeout(() => setThumbbar(payload, true), 150);
  } else {
    thumbarDebounce = setTimeout(() => setThumbbar(payload.isPlaying, payload.hasTrack), 150);
  }
});


ipcMain.handle('minimize-window', () => win?.minimize());
ipcMain.handle('maximize-window', () => {
  if (win?.isMaximized()) win.unmaximize();
  else win?.maximize();
});
ipcMain.handle('close-window', () => win?.close());


async function harvestYouTubeCookies(): Promise<boolean> {
    try {
        const ytCookiesPath = path.join(app.getPath('userData'), 'yt-cookies.txt');
        const ytSession = session.fromPartition('persist:youtube');
        const hiddenWin = new BrowserWindow({
            show: false,
            width: 400,
            height: 300,
            webPreferences: { session: ytSession }
        });

        try {
            await hiddenWin.loadURL('https://www.youtube.com');
            await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (loadErr: any) {
            if (loadErr?.code !== 'ERR_ABORTED') {
                console.warn('[YtCookies] Page load failed:', loadErr);
            }
        } finally {
            if (!hiddenWin.isDestroyed()) hiddenWin.destroy();
        }

        const cookies = await ytSession.cookies.get({ domain: '.youtube.com' });
        if (cookies.length === 0) {
            console.warn('[YtCookies] No cookies found for YouTube.');
            return false;
        }

        const lines = ['# Netscape HTTP Cookie File', '# Automatically generated by Lune', ''];
        for (const c of cookies) {
            const domain = c.domain || '.youtube.com';
            const includeSubdomains = domain.startsWith('.') ? 'TRUE' : 'FALSE';
            const expiry = c.expirationDate ? Math.floor(c.expirationDate) : 0;
            lines.push(`${domain}\t${includeSubdomains}\t${c.path || '/'}\t${c.secure ? 'TRUE' : 'FALSE'}\t${expiry}\t${c.name}\t${c.value}`);
        }

        await fs.promises.writeFile(ytCookiesPath, lines.join('\n'), 'utf-8');
        youtubeiAudio.setCookiesPath(ytCookiesPath);
        ytdlpAudio.setCookiesPath(ytCookiesPath);
        console.log(`[YtCookies] Harvested ${cookies.length} YouTube cookies.`);
        return true;
    } catch (err) {
        console.warn('[YtCookies] Auto harvest failed:', err);
        return false;
    }
}




app.whenReady().then(async () => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.lune.app'); 
  }
  
  const cleanPyInstallerTempFolders = async () => {
      try {
          const tmpDir = os.tmpdir();
          const files = await fs.promises.readdir(tmpDir);
          let count = 0;
          for (const file of files) {
              if (file.startsWith('_MEI')) {
                  const fullPath = path.join(tmpDir, file);
                  try {
                      const stats = await fs.promises.stat(fullPath);
                      if (Date.now() - stats.mtimeMs > 60 * 60 * 1000) {
                          await fs.promises.rm(fullPath, { recursive: true, force: true });
                          count++;
                      }
                  } catch (e) {
                  }
              }
          }
          if (count > 0) console.log(`[Main] Cleaned up ${count} orphaned PyInstaller (_MEI) folders.`);
      } catch (err) {
          console.warn('[Main] Error cleaning PyInstaller folders:', err);
      }
  };
  cleanPyInstallerTempFolders();

  registerAllHandlers();
  createWindow();
  createTray();
  harvestYouTubeCookies();

  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['*://*.googlevideo.com/*', '*://*.youtube.com/*'] },
    (details, callback) => {
      const headers = details.requestHeaders;
      if (!headers['Origin']) headers['Origin'] = 'https://music.youtube.com';
      if (!headers['Referer']) headers['Referer'] = 'https://music.youtube.com/';
      callback({ requestHeaders: headers });
    }
  );
  
  
  const checkYtdlpUpdate = async (manual = false) => {
    const autoUpdate = store.get('autoUpdateYtdlp', true);
    
    if (manual || autoUpdate) {
      if (manual) win?.webContents.send('ytdlp-update-status', { status: 'checking' });
      
      try {
        const res = await fetch('https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest');
        if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
        const data = await res.json();
        const latestVersion = data.tag_name;
        
        let currentVersion = '';
        try {
            const { stdout } = await new Promise<{stdout: string}>((resolve, reject) => {
                execFile(ytDlpBinaryPath, ['--version'], (error, stdout) => {
                    if (error) reject(error);
                    else resolve({ stdout });
                });
            });
            currentVersion = stdout.trim();
        } catch (e: any) {
            if (e?.code === 'ENOENT') {
                console.log('[Main] yt-dlp binary is missing. It will be downloaded automatically.');
            } else {
                console.log('[Main] yt-dlp binary could not be verified (corrupted/outdated). A fresh copy will be downloaded.');
            }
        }

        if (latestVersion && latestVersion !== currentVersion) {
           console.log(`[Main] yt-dlp update available: ${currentVersion} -> ${latestVersion}`);
           if (manual) win?.webContents.send('ytdlp-update-status', { status: 'downloading', message: `Downloading yt-dlp ${latestVersion}...` });
           
           const assetRes = await fetch(`https://github.com/yt-dlp/yt-dlp/releases/download/${latestVersion}/yt-dlp.exe`);
           if (assetRes.ok) {
               const arrayBuffer = await assetRes.arrayBuffer();

               const shaRes = await fetch(`https://github.com/yt-dlp/yt-dlp/releases/download/${latestVersion}/SHA2-256SUMS`);
               if (shaRes.ok) {
                   const shaText = await shaRes.text();
                   const expectedHash = shaText
                       .split('\n')
                       .find(line => line.trim().endsWith('yt-dlp.exe'))
                       ?.split(/\s+/)[0]
                       ?.toLowerCase();
                   if (expectedHash) {
                       const actualHash = crypto.createHash('sha256').update(Buffer.from(arrayBuffer)).digest('hex').toLowerCase();
                       if (actualHash !== expectedHash) {
                           throw new Error(`[Main] yt-dlp SHA256 mismatch! Expected ${expectedHash}, got ${actualHash} — download rejected`);
                       }
                       console.log('[Main] yt-dlp SHA256 verified against official checksums');
                   }
               }

               await fs.promises.writeFile(ytDlpBinaryPath, Buffer.from(arrayBuffer));
               console.log(`[Main] yt-dlp downloaded/updated successfully to ${latestVersion}`);
                const freshYtDlp = createYtDlp(ytDlpBinaryPath);
                ytdlpAudio.setYtDlpInstance(freshYtDlp);
                console.log(`[Main] yt-dlp is now active at: ${ytDlpBinaryPath}`);
               if (manual) {
                   win?.webContents.send('ytdlp-update-status', { status: 'ready', isLatest: true });
                   setTimeout(() => win?.webContents.send('ytdlp-update-status', { status: 'idle' }), 5000);
               }
           } else {
               throw new Error(`Failed to download binary: ${assetRes.status}`);
           }
        } else {
           console.log(`[Main] yt-dlp is up to date (${currentVersion}).`);
           if (manual) {
             win?.webContents.send('ytdlp-update-status', { status: 'ready', isLatest: true });
             setTimeout(() => win?.webContents.send('ytdlp-update-status', { status: 'idle' }), 5000);
           }
        }
      } catch (err) {
        console.warn('[Main] yt-dlp update check failed:', err);
        if (manual) {
          const error = err as Error;
          win?.webContents.send('ytdlp-update-status', { 
            status: 'error', 
            message: error.message?.includes('403') ? 'GitHub rate limit exceeded. Try again later.' : 'Failed to update from GitHub.' 
          });
          setTimeout(() => win?.webContents.send('ytdlp-update-status', { status: 'idle' }), 5000);
        }
      }
    }
  };

  
  checkYtdlpUpdate();

  
  ipcMain.on('check-ytdlp-update', () => {
    checkYtdlpUpdate(true);
  });

  
  autoUpdater.autoDownload = false; 

  autoUpdater.on('checking-for-update', () => {
    win?.webContents.send('app-update-status', { status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    win?.webContents.send('app-update-status', { status: 'available', info });
  });

  autoUpdater.on('update-not-available', (info) => {
    win?.webContents.send('app-update-status', { status: 'up-to-date', info });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    win?.webContents.send('app-update-status', { status: 'downloading', progress: progressObj });
  });

  autoUpdater.on('update-downloaded', (info) => {
    win?.webContents.send('app-update-status', { status: 'downloaded', info });
  });

  autoUpdater.on('error', (err) => {
    win?.webContents.send('app-update-status', { status: 'error', message: err.message });
  });

  
  if (isPackaged && store.get('autoUpdateApp', true)) {
    autoUpdater.checkForUpdates();
  }

  
  ipcMain.handle('check-app-update', () => {
    if (isPackaged) {
      autoUpdater.checkForUpdates();
    } else {
      console.log('[Updater] Update check ignored in development mode.');
      win?.webContents.send('app-update-status', { 
        status: 'error', 
        message: 'Update check is only available in production builds.' 
      });
      
      setTimeout(() => {
        win?.webContents.send('app-update-status', { status: 'idle' });
      }, 3000);
    }
  });

  ipcMain.handle('start-app-download', () => {
    if (isPackaged) {
      autoUpdater.downloadUpdate();
    }
  });

  ipcMain.handle('quit-and-install-update', () => {
    if (isPackaged) {
      autoUpdater.quitAndInstall();
    }
  });

  if (VITE_DEV_SERVER_URL) {
    const toggleDevTools = () => {
      if (win?.webContents.isDevToolsOpened()) win.webContents.closeDevTools();
      else win?.webContents.openDevTools({ mode: 'detach' });
    };
    globalShortcut.register('F12', toggleDevTools);
    globalShortcut.register('CommandOrControl+Shift+I', toggleDevTools);
  }

  protocol.handle('lune-local', async (request) => {
    try {
      const url = new URL(request.url);
      const hexPath = url.pathname.replace(/^\//, '');
      const localPath = Buffer.from(hexPath, 'hex').toString();
      try {
        await fs.promises.access(localPath);
      } catch (e) {
        return new Response('Not found', { status: 404 });
      }

      const ext = path.extname(localPath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.webm': 'audio/webm', '.m4a': 'audio/mp4', '.mp4': 'audio/mp4',
        '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.flac': 'audio/flac', '.wav': 'audio/wav'
      };
      
      const stat = await fs.promises.stat(localPath);
      const commonHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Range',
        'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
        'Accept-Ranges': 'bytes',
      };
      const rangeHeader = request.headers.get('range');

      let start = 0;
      let end = stat.size - 1;
      let status = 200;
      const headers: Record<string, string> = { 
        ...commonHeaders, 
        'Content-Type': mimeTypes[ext] || 'audio/mp4',
        'Content-Length': String(stat.size) 
      };

      if (rangeHeader) {
        const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
        if (match) {
          start = parseInt(match[1], 10);
          end = match[2] ? Math.min(parseInt(match[2], 10), stat.size - 1) : stat.size - 1;
          status = 206;
          headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
          headers['Content-Length'] = String(end - start + 1);
        }
      }

      const stream = fs.createReadStream(localPath, { start, end });
      
      
      request.signal.addEventListener('abort', () => {
        stream.destroy();
      });

      return new Response(Readable.toWeb(stream) as any, {
        status,
        headers
      });
    } catch (e) { 
      return new Response('Error', { status: 500 }); 
    }
  });

  function getYoutubeCookies(): string {
    try {
      const cookiesPath = path.join(app.getPath('userData'), 'yt-cookies.txt');
      if (!fs.existsSync(cookiesPath)) return '';
      const lines = fs.readFileSync(cookiesPath, 'utf-8').split('\n');
      const cookies: string[] = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const parts = trimmed.split('\t');
        if (parts.length >= 7) {
          cookies.push(`${parts[5]}=${parts[6]}`);
        }
      }
      return cookies.join('; ');
    } catch (err) {
      console.warn('[Main] Failed to parse YouTube cookies for request headers:', err);
      return '';
    }
  }

  const requestHeadersMap = new Map<number, any>();

  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['*://*.googlevideo.com/*', '*://*.youtube.com/*'] },
    (details, callback) => {
      const requestHeaders = details.requestHeaders || {};
      const isGooglevideo = details.url.includes('googlevideo.com');
      
      let clientParam = '';
      let parsedUrl: URL | null = null;
      try {
        parsedUrl = new URL(details.url);
        clientParam = parsedUrl.searchParams.get('c') || '';
      } catch (e) {}

      const clientName = clientParam.toUpperCase().trim();
      const isTvClient = clientName === 'TV' || clientName === 'TVHTML5' || clientName === 'TVHTML5_SIMPLY' || clientName === 'TVHTML5_SIMPLY_EMBEDDED_PLAYER';
      const isWebMusicClient = clientName === 'WEB' || clientName === 'WEB_REMIX' || clientName === 'WEB_CREATOR' || clientName === 'MWEB' || clientName === 'WEB_EMBEDDED_PLAYER';

      delete requestHeaders['Origin'];
      delete requestHeaders['origin'];
      delete requestHeaders['ORIGIN'];
      delete requestHeaders['Referer'];
      delete requestHeaders['referer'];
      delete requestHeaders['REFERER'];
      delete requestHeaders['Cookie'];
      delete requestHeaders['cookie'];
      delete requestHeaders['COOKIE'];

      let resolvedOrigin: string | null = null;
      let resolvedReferer: string | null = null;
      let resolvedUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

      if (isTvClient) {
        resolvedOrigin = 'https://www.youtube.com';
        resolvedReferer = 'https://www.youtube.com/tv';
        resolvedUserAgent = 'Mozilla/5.0 (ChromiumStylePlatform) Cobalt/Version';
      } else if (clientName === 'MWEB') {
        resolvedOrigin = 'https://m.youtube.com';
        resolvedReferer = 'https://m.youtube.com/';
        resolvedUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';
      } else if (isWebMusicClient || !clientName) {
        resolvedOrigin = 'https://music.youtube.com';
        resolvedReferer = 'https://music.youtube.com/';
      } else if (clientName.startsWith('ANDROID')) {
        if (clientName === 'ANDROID_MUSIC') {
          resolvedUserAgent = 'com.google.android.youtube.music/5.34.51 (Linux; U; Android 12; en_US) gzip';
        } else if (clientName === 'ANDROID_VR') {
          resolvedUserAgent = 'com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip';
        } else {
          resolvedUserAgent = 'com.google.android.youtube/21.03.36(Linux; U; Android 16; en_US; SM-S908E Build/TP1A.220624.014) gzip';
        }
      } else if (clientName.startsWith('IOS')) {
        resolvedOrigin = 'https://www.youtube.com';
        resolvedReferer = 'https://www.youtube.com/';
        if (clientName === 'IOS_MUSIC') {
          resolvedUserAgent = 'com.google.ios.youtube.music/5.34.51 (iPhone; U; CPU iOS 16_7_7 like Mac OS X)';
        } else {
          resolvedUserAgent = 'com.google.ios.youtube/20.11.6 (iPhone10,4; U; CPU iOS 16_7_7 like Mac OS X)';
        }
      }

      const customUa = parsedUrl?.searchParams.get('__lune_ua');
      if (customUa) {
        resolvedUserAgent = customUa;
      }

      if (resolvedOrigin) {
        requestHeaders['Origin'] = resolvedOrigin;
        requestHeaders['origin'] = resolvedOrigin;
        requestHeaders['ORIGIN'] = resolvedOrigin;
      }
      if (resolvedReferer) {
        requestHeaders['Referer'] = resolvedReferer;
        requestHeaders['referer'] = resolvedReferer;
        requestHeaders['REFERER'] = resolvedReferer;
      }
      
      requestHeaders['User-Agent'] = resolvedUserAgent;
      requestHeaders['user-agent'] = resolvedUserAgent;
      requestHeaders['USER-AGENT'] = resolvedUserAgent;

      const ytCookie = getYoutubeCookies();
      const isWebClient = isWebMusicClient || !clientName;
      if (isWebClient && ytCookie) {
        requestHeaders['Cookie'] = ytCookie;
        requestHeaders['cookie'] = ytCookie;
        requestHeaders['COOKIE'] = ytCookie;
      } else if (isGooglevideo && isWebClient && !ytCookie) {
        console.warn(`[WebRequest] No YouTube cookies found to inject!`);
      }

      requestHeadersMap.set(details.id, {
        url: details.url,
        headers: { ...requestHeaders }
      });

      callback({ cancel: false, requestHeaders });
    }
  );

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = details.responseHeaders || {};
    const url = details.url.toLowerCase();
    if (url.includes('googlevideo.com') || url.includes('youtube.com') || url.includes('lrclib.net') || url.includes('boidu.dev')) {
      if (details.statusCode >= 400) {
        console.error(`[WebRequest] Error response received: status=${details.statusCode}, url=${details.url.slice(0, 120)}...`);

      }
      requestHeadersMap.delete(details.id);
      
      const keysToDelete = [
        'access-control-allow-origin',
        'access-control-allow-methods',
        'access-control-allow-headers',
        'access-control-expose-headers'
      ];
      for (const key of Object.keys(responseHeaders)) {
        if (keysToDelete.includes(key.toLowerCase())) {
          delete responseHeaders[key];
        }
      }

      responseHeaders['Access-Control-Allow-Origin'] = ['*'];
      responseHeaders['Access-Control-Allow-Methods'] = ['GET, OPTIONS'];
      responseHeaders['Access-Control-Allow-Headers'] = ['Range', 'Content-Type'];
      responseHeaders['Access-Control-Expose-Headers'] = ['Content-Range', 'Content-Length', 'Accept-Ranges'];
    }
    callback({ cancel: false, responseHeaders });
  });
});
  app.on('before-quit', () => {
      isQuitting = true;
      clearRPC();
      globalShortcut.unregisterAll();
      activeSearches.forEach(s => s.controller.abort());
      activeDownloads.forEach(c => c.abort());
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
} 
