import { app, BrowserWindow, ipcMain, Menu, protocol, globalShortcut, session, Tray, nativeImage } from 'electron'
import { autoUpdater } from 'electron-updater'
import * as nodeUrl from 'node:url'
import path from 'node:path'
import { Readable } from 'node:stream';
import fs from 'fs';
import Store from 'electron-store';
import { StoreSchema, schema } from './store.js';
import { registerAllHandlers } from './handlers/index.js';
import { clearRPC } from './handlers/rpc.js';
import { ytDlp, activeSearches, activeDownloads } from './streaming.js';
import { create as createYtDlp } from 'yt-dlp-exec';

const __dirname = path.dirname(nodeUrl.fileURLToPath(import.meta.url))

const isPackaged = app.isPackaged;
const ytDlpBinaryPath = isPackaged 
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'yt-dlp-exec', 'bin', 'yt-dlp.exe')
    : path.join(app.getAppPath(), 'node_modules', 'yt-dlp-exec', 'bin', 'yt-dlp.exe');

if (fs.existsSync(ytDlpBinaryPath)) {
    const customYtDlp = createYtDlp(ytDlpBinaryPath);
    ytDlp.setYtDlpInstance(customYtDlp);
    console.log(`[Main] Using yt-dlp binary at: ${ytDlpBinaryPath}`);
}

import { addToLog } from './logger.js';

const originalLog = console.log;
const originalError = console.error;

console.log = (...args: unknown[]) => {
    originalLog(...args);
    addToLog('info', ...args);
};

console.error = (...args: unknown[]) => {
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
  
  // Track current app version
  store.set('app_version', app.getVersion());

  // Increment startup count
  const count = (store.get('startup_count') || 0) + 1;
  store.set('startup_count', count);

  let win: BrowserWindow | null
  let tray: Tray | null = null;
  let isQuitting = false;

  function createWindow() {
  const bounds = store.get('windowBounds');

  // In packaged mode, the icon is in extraResources folder; in dev mode, use src/assets
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
    },
  })

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
    // Delay slightly so the taskbar button is definitely registered
    setTimeout(() => {
      if (win) setThumbbar(false);
    }, 1000);
  });

  win.on('close', (event) => {
    if (!isQuitting) {
      const behavior = store.get('closeBehavior');
      // Default to 'minimize' if behavior is undefined/not explicitly 'close'
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

// ── Thumbnail Toolbar (Windows taskbar hover preview buttons) ──────────────
function getThumbbarIconPath(name: string) {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'thumbar', `${name}.png`)
    : path.join(app.getAppPath(), 'src', 'assets', 'thumbar', `${name}.png`);
}

function setThumbbar(isPlaying: boolean) {
  if (!win || process.platform !== 'win32') return;

  try {
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
// Renderer sends this whenever play/pause state changes
ipcMain.on('thumbar-update', (_event, isPlaying: boolean) => {
  if (thumbarDebounce) clearTimeout(thumbarDebounce);
  thumbarDebounce = setTimeout(() => setThumbbar(isPlaying), 150);
});

// Window Management
ipcMain.handle('minimize-window', () => win?.minimize());
ipcMain.handle('maximize-window', () => {
  if (win?.isMaximized()) win.unmaximize();
  else win?.maximize();
});
ipcMain.handle('close-window', () => win?.close());

// Cookie Harvesting
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
        ytDlp.setCookiesPath(ytCookiesPath);
        console.log(`[YtCookies] Harvested ${cookies.length} YouTube cookies.`);
        return true;
    } catch (err) {
        console.warn('[YtCookies] Auto harvest failed:', err);
        return false;
    }
}

  // Track current app version
  store.set('app_version', app.getVersion());

  // Increment startup count
  const count = (store.get('startup_count') || 0) + 1;
  store.set('startup_count', count);

// App Lifecycle
app.whenReady().then(async () => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.lune.app'); 
  }
  registerAllHandlers();
  createWindow();
  createTray();
  harvestYouTubeCookies();
  
  // Refactored yt-dlp update checker
  const checkYtdlpUpdate = async (manual = false) => {
    const autoUpdate = store.get('autoUpdateYtdlp', true);
    const lastUpdate = store.get('lastYtdlpUpdate') || 0;
    const oneDay = 24 * 60 * 60 * 1000;

    // Only run if auto-update is on OR it's a manual trigger
    if (manual || (autoUpdate && (Date.now() - lastUpdate > oneDay))) {
      if (manual) win?.webContents.send('ytdlp-update-status', { status: 'checking' });
      
      try {
        const output = await ytDlp.update();
        store.set('lastYtdlpUpdate', Date.now());
        
        const isUpToDate = output.toLowerCase().includes('up to date') || output.toLowerCase().includes('is current');
        
        if (manual) {
          win?.webContents.send('ytdlp-update-status', { 
            status: 'ready',
            isLatest: isUpToDate
          });
          
          setTimeout(() => {
            win?.webContents.send('ytdlp-update-status', { status: 'idle' });
          }, 5000);
        }
      } catch (err) {
        console.warn('[Main] yt-dlp update failed:', err);
        const error = err as Error;
        if (manual) {
          win?.webContents.send('ytdlp-update-status', { 
            status: 'error', 
            message: err.message?.includes('403') ? 'Rate limit exceeded. Try again later.' : 'Failed to update playback drivers.' 
          });
        }
        
        // If rate limited, set last update to almost now so we don't spam 403s
        if (err.message?.includes('403')) {
           store.set('lastYtdlpUpdate', Date.now() - (23 * 60 * 60 * 1000)); 
        }

        if (manual) {
          setTimeout(() => {
            win?.webContents.send('ytdlp-update-status', { status: 'idle' });
          }, 5000);
        }
      }
    }
  };

  // Trigger on startup
  checkYtdlpUpdate();

  // Manual handler
  ipcMain.on('check-ytdlp-update', () => {
    checkYtdlpUpdate(true);
  });

  // Application Auto-Update Logic
  autoUpdater.autoDownload = false; // Always handle via UI

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

  // Initial check if auto-update is enabled
  if (isPackaged && store.get('autoUpdateApp', true)) {
    autoUpdater.checkForUpdates();
  }

  // Register Update Handlers
  ipcMain.handle('check-app-update', () => {
    if (isPackaged) {
      autoUpdater.checkForUpdates();
    } else {
      console.log('[Updater] Update check ignored in development mode.');
      win?.webContents.send('app-update-status', { 
        status: 'error', 
        message: 'Update check is only available in production builds.' 
      });
      // Auto-hide the error after 3 seconds in dev
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
      
      // FIX: Manually destroy the stream if the request is aborted to prevent file locking on Windows
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

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = details.responseHeaders || {};
    const url = details.url.toLowerCase();
    if (url.includes('googlevideo.com') || url.includes('youtube.com')) {
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
} // End of else (gotTheLock)
