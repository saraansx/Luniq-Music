import { ipcMain, session } from 'electron';
import { ElectronSpotifyAuth } from '../../Plugin/electron-auth.js';
import Store from 'electron-store';
const spotifyAuth = new ElectronSpotifyAuth();
import { StoreSchema, schema } from '../store.js';
const store = new Store<StoreSchema>({ schema: schema as any });

let activeRefreshPromise: Promise<any> | null = null;
let lastRefreshAttempt = 0;
const REFRESH_COOLDOWN = 10000; // 10 seconds

export function registerSpotifyHandlers() {
    ipcMain.handle('spotify-login', async () => {
        try {
            const credentials = await spotifyAuth.login();
            store.set('spotify_access_token', credentials.accessToken);
            store.set('spotify_cookies', credentials.cookies);
            store.set('spotify_expires_at', credentials.expiration);
            return credentials;
        } catch (error: any) {
            console.error('Spotify Login Error:', error);
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('get-spotify-credentials', async (_event, forceRefresh: boolean = false) => {
        const token = store.get('spotify_access_token');
        const expiration = store.get('spotify_expires_at');
        const cookies = store.get('spotify_cookies');

        if (token) {
            const isExpired = !expiration || Date.now() > (expiration - 30000);

            if (isExpired || forceRefresh) {
                const spDcCookie = cookies?.find((c: any) => c.name === 'sp_dc');

                if (!spDcCookie) {
                    store.delete('spotify_access_token');
                    store.delete('spotify_cookies');
                    store.delete('spotify_expires_at');
                    return null;
                }

                if (!activeRefreshPromise) {
                    if (!forceRefresh && (Date.now() - lastRefreshAttempt < REFRESH_COOLDOWN)) {
                        console.warn('Spotify refresh on cooldown, skipping...');
                        return null;
                    }
                    lastRefreshAttempt = Date.now();
                    activeRefreshPromise = spotifyAuth.refresh(spDcCookie.value)
                        .then(newCreds => {
                            store.set('spotify_access_token', newCreds.accessToken);
                            store.set('spotify_expires_at', newCreds.expiration);
                            return newCreds;
                        })
                        .finally(() => {
                            activeRefreshPromise = null;
                        });
                }

                try {
                    const newCreds = await activeRefreshPromise;
                    return {
                        accessToken: newCreds.accessToken,
                        cookies: cookies,
                        expiration: newCreds.expiration
                    };
                } catch (error: any) {
                    console.error('Failed to refresh token:', error);
                    if (error?.response?.status >= 400 && error?.response?.status < 500) {
                        store.delete('spotify_access_token');
                        store.delete('spotify_cookies');
                        store.delete('spotify_expires_at');
                    }
                    return null;
                }
            }

            return {
                accessToken: token,
                cookies: cookies,
                expiration: expiration
            };
        }
        return null;
    });

    ipcMain.handle('logout', async () => {
        try {
            store.delete('spotify_access_token');
            store.delete('spotify_cookies');
            store.delete('spotify_expires_at');

            if (session.defaultSession) {
                await session.defaultSession.clearStorageData({
                    storages: ['cookies', 'localstorage', 'indexdb', 'cachestorage']
                });
            }
            return true;
        } catch (error) {
            console.error('Error during logout:', error);
            return false;
        }
    });
}
