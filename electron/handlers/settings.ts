import { ipcMain, dialog, app, BrowserWindow, shell } from 'electron';
import Store from 'electron-store';
import fs from 'fs';
import path from 'path';
import { StoreSchema, schema } from '../store.js';

const store = new Store<StoreSchema>({ schema: schema as any });

export function registerSettingsHandlers() {
    ipcMain.handle('get-setting', (_event, key: keyof StoreSchema) => {
        return store.get(key);
    });

    ipcMain.handle('set-setting', (_event, key: keyof StoreSchema, value: any) => {
        store.set(key, value);
        return true;
    });

    ipcMain.handle('select-directory', async (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win) return null;
        const result = await dialog.showOpenDialog(win, {
            properties: ['openDirectory'],
            title: 'Select Download Location',
        });
        if (result.canceled || result.filePaths.length === 0) {
            return null;
        }
        return result.filePaths[0];
    });

    ipcMain.handle('get-default-download-location', () => {
        return app.getPath('downloads');
    });

    ipcMain.handle('open-external', async (_event, url: string) => {
        try {
            await shell.openExternal(url);
            return true;
        } catch (err) {
            console.error('Failed to open external url', err);
            return false;
        }
    });

    ipcMain.handle('get-app-version', () => {
        let buildVersion = '';
        try {
            const pkgPath = path.join(app.getAppPath(), 'package.json');
            if (fs.existsSync(pkgPath)) {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
                buildVersion = pkg.buildVersion || '';
            }
        } catch (err) {
            console.warn('Could not read package.json for build version', err);
        }

        return {
            version: app.getVersion(),
            buildVersion
        };
    });

    ipcMain.handle('get-github-commits', async () => {
        try {
            const response = await fetch('https://api.github.com/repos/saraansx/Lune/commits?per_page=10', {
                headers: {
                    'User-Agent': 'Lune-App'
                }
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            return await response.json();
        } catch (err) {
            console.error('[Main] Failed to fetch commits:', err);
            return null;
        }
    });
}
