import { BrowserWindow, session, app } from "electron";
import type { SpotifyCredentials } from "./types.js";
import path from "node:path";

import { SpotifyAuthCore } from "./spotify-auth-core.js";

export class ElectronSpotifyAuth {
  private authCore = new SpotifyAuthCore();

  async login(): Promise<SpotifyCredentials> {
    return new Promise((resolve, reject) => {
      let resolved = false;
      const iconPath = app.isPackaged
        ? path.join(process.resourcesPath, "Luniq.png")
        : path.join(app.getAppPath(), "src", "assets", "Luniq.png");

      const partition = `temp-login-${Date.now()}`;
      const loginSession = session.fromPartition(partition);

      const firefoxUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0";
      loginSession.setUserAgent(firefoxUA);

      loginSession.webRequest.onBeforeSendHeaders((details, callback) => {
        const requestHeaders = { ...details.requestHeaders };
        requestHeaders['User-Agent'] = firefoxUA;
        delete requestHeaders['X-Electron'];
        delete requestHeaders['x-requested-with'];
        delete requestHeaders['sec-ch-ua'];
        delete requestHeaders['sec-ch-ua-mobile'];
        delete requestHeaders['sec-ch-ua-platform'];
        delete requestHeaders['sec-ch-ua-model'];
        delete requestHeaders['Sec-Fetch-User'];
        callback({ cancel: false, requestHeaders });
      });

      const loginWindow = new BrowserWindow({
        width: 800,
        height: 700,
        title: "Luniq",
        icon: iconPath,
        autoHideMenuBar: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          partition: partition,
          webSecurity: true,
        },
      });

      loginWindow.setMenuBarVisibility(false);
      loginWindow.webContents.setUserAgent(firefoxUA);

      let pollInterval: NodeJS.Timeout | null = null;

      const cleanup = () => {
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
        try {
          loginSession.cookies.removeListener('changed', cookieListener);
        } catch {}
        try {
          if (!loginWindow.isDestroyed()) {
            if (loginWindow.webContents.debugger.isAttached()) {
              loginWindow.webContents.debugger.detach();
            }
            loginWindow.destroy();
          }
        } catch {}
      };

      const finishWithCredentials = async (accessToken: string, expiration?: number, existingCookies?: Electron.Cookie[]) => {
        if (resolved) return;
        resolved = true;

        try {
          const cookies = (existingCookies && existingCookies.length > 0)
            ? existingCookies
            : await loginSession.cookies.get({});
          const spotifyCookies = cookies.filter((c) => c.domain?.includes("spotify.com"));
          const credentials: SpotifyCredentials = {
            cookies: spotifyCookies.length > 0 ? spotifyCookies : cookies,
            accessToken,
            expiration: expiration || Date.now() + 3600 * 1000,
          };
          cleanup();
          resolve(credentials);
        } catch (err) {
          cleanup();
          reject(err);
        }
      };

      // ── Layer 1: DevTools Debugger (attached immediately before loadURL) ──
      try {
        loginWindow.webContents.debugger.attach("1.3");
        loginWindow.webContents.debugger.sendCommand("Network.enable");

        loginWindow.webContents.debugger.on("message", async (_event, method, params) => {
          if (resolved) return;

          if (method === "Network.responseReceived") {
            const url = params?.response?.url || "";
            if (url.includes("/api/token") || url.includes("/get_access_token")) {
              try {
                const res = await loginWindow.webContents.debugger.sendCommand("Network.getResponseBody", {
                  requestId: params.requestId,
                });
                if (res?.body) {
                  const data = JSON.parse(res.body);
                  if (data?.accessToken && !data.isAnonymous) {
                    await finishWithCredentials(data.accessToken, data.accessTokenExpirationTimestampMs);
                  }
                }
              } catch (e) {
                // Ignore transient body retrieval errors
              }
            }
          }
        });
      } catch (err) {
        console.warn("[SpotifyAuth] Debugger attach error:", err);
      }

      // ── Injected early fetch hook ──
      const pageHookScript = `
        try {
          Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
          delete window.chrome;
        } catch(e) {}

        try {
          if (!window.__token_hooked) {
            window.__token_hooked = true;
            const origFetch = window.fetch;
            window.fetch = async function(...args) {
              const res = await origFetch.apply(this, args);
              try {
                const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
                if (url.includes('/api/token') || url.includes('/get_access_token')) {
                  const clone = res.clone();
                  clone.json().then(data => {
                    if (data && data.accessToken && !data.isAnonymous) {
                      window.__spotify_access_token_data = data;
                    }
                  }).catch(() => {});
                }
              } catch(e) {}
              return res;
            };
          }
        } catch(e) {}
      `;

      // ── Layer 2 & 3: Active sp_dc Cookie Detection & In-Page Token Fetch ──
      let isChecking = false;
      const checkCookiesAndAuthenticate = async () => {
        if (resolved || isChecking) return;
        isChecking = true;

        try {
          const allCookies = await loginSession.cookies.get({});
          const spDcCookie = allCookies.find((c) => c.name === "sp_dc");

          if (spDcCookie && spDcCookie.value) {
            // Fast direct token generation via TOTP
            try {
              const tokenData = await this.authCore.getAccessToken(spDcCookie.value);
              if (tokenData?.accessToken && !tokenData.isAnonymous) {
                await finishWithCredentials(tokenData.accessToken, tokenData.accessTokenExpirationTimestampMs, allCookies);
                return;
              }
            } catch {
              // Continue to in-page active fetch if TOTP endpoint was unreachable
            }

            // In-page active fetch inside the authenticated Spotify session context
            if (!loginWindow.isDestroyed()) {
              const currentUrl = loginWindow.webContents.getURL();
              if (currentUrl.includes("open.spotify.com")) {
                try {
                  const inPageToken = await loginWindow.webContents.executeJavaScript(`
                    (async () => {
                      try {
                        const res = await fetch('/api/token?reason=transport&productType=web-player');
                        if (res.ok) {
                          const data = await res.json();
                          if (data && data.accessToken && !data.isAnonymous) return data;
                        }
                      } catch(e) {}
                      try {
                        const res2 = await fetch('/get_access_token?reason=transport&productType=web-player');
                        if (res2.ok) {
                          const data2 = await res2.json();
                          if (data2 && data2.accessToken && !data2.isAnonymous) return data2;
                        }
                      } catch(e) {}
                      return window.__spotify_access_token_data || null;
                    })()
                  `);
                  if (inPageToken?.accessToken && !inPageToken.isAnonymous) {
                    await finishWithCredentials(inPageToken.accessToken, inPageToken.accessTokenExpirationTimestampMs, allCookies);
                    return;
                  }
                } catch {}
              }
            }
          }
        } catch {
        } finally {
          isChecking = false;
        }
      };

      const cookieListener = () => {
        checkCookiesAndAuthenticate();
      };
      loginSession.cookies.on("changed", cookieListener);

      pollInterval = setInterval(checkCookiesAndAuthenticate, 600);

      const handleNavigation = async (url: string) => {
        if (resolved) return;

        const cookies = await loginSession.cookies.get({});
        const spDcCookie = cookies.find((c) => c.name === "sp_dc");

        if (spDcCookie) {
          if (url.includes("accounts.spotify.com")) {
            loginWindow.loadURL("https://open.spotify.com/");
          }
        }

        checkCookiesAndAuthenticate();
      };

      loginWindow.webContents.on("did-navigate", (_event, url) => handleNavigation(url));
      loginWindow.webContents.on("did-redirect-navigation", (_event, url) => handleNavigation(url));

      loginWindow.webContents.on("dom-ready", async () => {
        if (resolved) return;
        try {
          await loginWindow.webContents.executeJavaScript(pageHookScript);
        } catch {}
        checkCookiesAndAuthenticate();
      });

      loginWindow.on("page-title-updated", (e) => e.preventDefault());

      loginWindow.on("closed", () => {
        if (!resolved) {
          cleanup();
          reject(new Error("Login window was closed before completion"));
        }
      });

      loginWindow.loadURL("https://accounts.spotify.com/en/login?continue=https%3A%2F%2Fopen.spotify.com%2F");
    });
  }

  async refresh(
    spDc: string,
  ): Promise<Pick<SpotifyCredentials, "accessToken" | "expiration">> {
    // ── FAST PATH: Direct TOTP Token refresh via HTTP ──
    try {
      const refreshed = await this.authCore.getAccessToken(spDc);
      if (refreshed?.accessToken && !refreshed.isAnonymous) {
        return {
          accessToken: refreshed.accessToken,
          expiration: refreshed.accessTokenExpirationTimestampMs || Date.now() + 3600 * 1000,
        };
      }
    } catch (err) {
      console.warn("[SpotifyRefresh] Fast HTTP refresh failed, falling back to browser window:", err);
    }

    // ── FALLBACK PATH: Isolated Headless Window ──
    return new Promise((resolve, reject) => {
      const partition = `temp-refresh-${Date.now()}`;
      const refreshSession = session.fromPartition(partition);

      const firefoxUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0";
      refreshSession.setUserAgent(firefoxUA);

      refreshSession.cookies.set({
        url: "https://open.spotify.com",
        name: "sp_dc",
        value: spDc,
        domain: ".spotify.com",
        path: "/",
        secure: true,
        httpOnly: true,
        sameSite: "no_restriction",
      }).then(() => {
        const refreshWindow = new BrowserWindow({
          show: false,
          width: 800,
          height: 600,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            partition: partition,
            webSecurity: true,
          },
        });

        let finished = false;
        const cleanup = () => {
          if (finished) return;
          finished = true;
          try {
            if (!refreshWindow.isDestroyed()) {
              if (refreshWindow.webContents.debugger.isAttached()) {
                refreshWindow.webContents.debugger.detach();
              }
              refreshWindow.destroy();
            }
          } catch {}
        };

        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error("Spotify token refresh timed out"));
        }, 15000);

        try {
          refreshWindow.webContents.debugger.attach("1.3");
          refreshWindow.webContents.debugger.sendCommand("Network.enable");

          refreshWindow.webContents.debugger.on("message", async (_event, method, params) => {
            if (finished) return;

            if (method === "Network.responseReceived") {
              const url = params?.response?.url || "";
              if (url.includes("/api/token") || url.includes("/get_access_token")) {
                try {
                  const res = await refreshWindow.webContents.debugger.sendCommand("Network.getResponseBody", {
                    requestId: params.requestId,
                  });
                  if (res?.body) {
                    const data = JSON.parse(res.body);
                    if (data?.accessToken && !data.isAnonymous) {
                      clearTimeout(timeout);
                      cleanup();
                      resolve({
                        accessToken: data.accessToken,
                        expiration: data.accessTokenExpirationTimestampMs || Date.now() + 3600 * 1000,
                      });
                    }
                  }
                } catch (e) {
                  console.warn("[SpotifyRefresh] Could not read response body:", e);
                }
              }
            }
          });
        } catch (err) {
          console.warn("[SpotifyRefresh] Debugger attach error:", err);
        }

        refreshWindow.webContents.on("dom-ready", async () => {
          if (finished) return;
          try {
            const inPageToken = await refreshWindow.webContents.executeJavaScript(`
              (async () => {
                try {
                  const res = await fetch('/api/token?reason=transport&productType=web-player');
                  if (res.ok) {
                    const data = await res.json();
                    if (data && data.accessToken && !data.isAnonymous) return data;
                  }
                } catch(e) {}
                return null;
              })()
            `);
            if (inPageToken?.accessToken && !inPageToken.isAnonymous) {
              clearTimeout(timeout);
              cleanup();
              resolve({
                accessToken: inPageToken.accessToken,
                expiration: inPageToken.accessTokenExpirationTimestampMs || Date.now() + 3600 * 1000,
              });
            }
          } catch {}
        });

        refreshWindow.loadURL("https://open.spotify.com/");
      }).catch((err) => {
        reject(err);
      });
    });
  }

  async getAnonymousToken(): Promise<SpotifyCredentials> {
    // ── FAST PATH: Direct TOTP Anonymous HTTP Token (takes ~200-400ms, zero browser overhead) ──
    try {
      const fastToken = await this.authCore.getAnonymousToken();
      if (fastToken?.accessToken) {
        return {
          accessToken: fastToken.accessToken,
          expiration: fastToken.accessTokenExpirationTimestampMs || Date.now() + 3600 * 1000,
          cookies: [],
        };
      }
    } catch (fastErr) {
      console.warn("[GuestToken] Fast-path HTTP fetch failed, falling back to browser window:", fastErr);
    }

    // ── FALLBACK PATH: Isolated Headless Window with Debugger + DOM Fetch Hook ──
    return new Promise((resolve, reject) => {
      let resolved = false;
      const partition = `temp-anon-${Date.now()}`;
      const anonSession = session.fromPartition(partition);

      const firefoxUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0";
      anonSession.setUserAgent(firefoxUA);

      anonSession.webRequest.onBeforeSendHeaders((details, callback) => {
        const requestHeaders = { ...details.requestHeaders };
        requestHeaders['User-Agent'] = firefoxUA;
        delete requestHeaders['X-Electron'];
        delete requestHeaders['x-requested-with'];
        delete requestHeaders['sec-ch-ua'];
        delete requestHeaders['sec-ch-ua-mobile'];
        delete requestHeaders['sec-ch-ua-platform'];
        delete requestHeaders['sec-ch-ua-model'];
        delete requestHeaders['Sec-Fetch-User'];
        callback({ cancel: false, requestHeaders });
      });

      const anonWindow = new BrowserWindow({
        show: false,
        width: 800,
        height: 600,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          partition: partition,
          webSecurity: true,
        },
      });

      anonWindow.webContents.setUserAgent(firefoxUA);

      const cleanup = () => {
        try {
          if (!anonWindow.isDestroyed()) {
            if (anonWindow.webContents.debugger.isAttached()) {
              anonWindow.webContents.debugger.detach();
            }
            anonWindow.destroy();
          }
        } catch {}
      };

      const finishWithCredentials = async (accessToken: string, expiration?: number) => {
        if (resolved) return;
        resolved = true;

        try {
          const cookies = await anonSession.cookies.get({ domain: "spotify.com" });
          cleanup();
          resolve({
            accessToken,
            expiration: expiration || Date.now() + 3600 * 1000,
            cookies: cookies || [],
          });
        } catch (err) {
          cleanup();
          reject(err);
        }
      };

      const timeout = setTimeout(() => {
        if (resolved) return;
        cleanup();
        reject(new Error("Guest token fetch timed out"));
      }, 15000);

      // Injected script to intercept token requests in the DOM directly
      const pageHookScript = `
        try {
          Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
          delete window.chrome;
        } catch(e) {}

        try {
          if (!window.__guest_hooked) {
            window.__guest_hooked = true;
            const origFetch = window.fetch;
            window.fetch = async function(...args) {
              const res = await origFetch.apply(this, args);
              try {
                const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
                if (url.includes('/api/token') || url.includes('/get_access_token')) {
                  const clone = res.clone();
                  clone.json().then(data => {
                    if (data && data.accessToken) {
                      window.__guest_access_token_data = data;
                    }
                  }).catch(() => {});
                }
              } catch(e) {}
              return res;
            };
          }
        } catch(e) {}
      `;

      anonWindow.webContents.on("dom-ready", async () => {
        if (resolved) return;
        try {
          await anonWindow.webContents.executeJavaScript(pageHookScript);
          
          const tokenData = await anonWindow.webContents.executeJavaScript(`
            window.__guest_access_token_data || null
          `);
          if (tokenData?.accessToken) {
            clearTimeout(timeout);
            await finishWithCredentials(tokenData.accessToken, tokenData.accessTokenExpirationTimestampMs);
          }
        } catch {}
      });

      try {
        anonWindow.webContents.debugger.attach("1.3");
        anonWindow.webContents.debugger.sendCommand("Network.enable");

        anonWindow.webContents.debugger.on("message", async (_event, method, params) => {
          if (resolved) return;

          if (method === "Network.responseReceived") {
            const url = params?.response?.url || "";
            if (url.includes("/api/token") || url.includes("/get_access_token")) {
              try {
                const res = await anonWindow.webContents.debugger.sendCommand("Network.getResponseBody", {
                  requestId: params.requestId,
                });
                if (res?.body) {
                  const data = JSON.parse(res.body);
                  if (data?.accessToken) {
                    clearTimeout(timeout);
                    await finishWithCredentials(data.accessToken, data.accessTokenExpirationTimestampMs);
                  }
                }
              } catch (e) {
                console.warn("[GuestToken] Could not read response body:", e);
              }
            }
          }
        });
      } catch (err) {
        console.warn("[GuestToken] Debugger attach error:", err);
      }

      anonWindow.loadURL("https://open.spotify.com/");
    });
  }
}
