import { BrowserWindow, session, app } from "electron";
import { SpotifyAuthCore } from "./spotify-auth-core.js";
import type { SpotifyCredentials } from "./types.js";
import path from "node:path";

export class ElectronSpotifyAuth {
  private core: SpotifyAuthCore;

  constructor() {
    this.core = new SpotifyAuthCore();
  }

  async login(): Promise<SpotifyCredentials> {
    return new Promise((resolve, reject) => {
      const iconPath = app.isPackaged
        ? path.join(process.resourcesPath, "Lune.png")
        : path.join(app.getAppPath(), "src", "assets", "Lune.png");

      const loginWindow = new BrowserWindow({
        width: 800,
        height: 700,
        title: "Lune",
        icon: iconPath,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      loginWindow.on("page-title-updated", (e) => {
        e.preventDefault();
      });

      loginWindow.loadURL("https://accounts.spotify.com/");

      loginWindow.webContents.on("dom-ready", () => {
        loginWindow.webContents
          .executeJavaScript(
            `
                    const disableSocialButtons = () => {
                        const elements = document.querySelectorAll('button, a, [role="button"]');
                        elements.forEach(el => {
                            const text = el.innerText || el.textContent || '';
                            if (text.includes('Google')) {
                                el.style.setProperty('opacity', '0.2', 'important');
                                el.style.setProperty('pointer-events', 'none', 'important');
                                el.style.setProperty('cursor', 'not-allowed', 'important');
                                if (el.tagName.toLowerCase() === 'button') {
                                    el.disabled = true;
                                }
                                el.title = 'Social login is not supported in Lune. Please use Email/Password.';
                            }
                        });
                    };
                    disableSocialButtons();
                    const observer = new MutationObserver(disableSocialButtons);
                    if (document.body) {
                        observer.observe(document.body, { childList: true, subtree: true });
                    }
                `,
          )
          .catch(console.error);
      });

      const handleNavigation = async (_url: string) => {
        const cookies = await session.defaultSession.cookies.get({
          domain: "spotify.com",
        });
        const spDcCookie = cookies.find((c) => c.name === "sp_dc");

        if (spDcCookie) {
          try {
            const tokenData = await this.core.getAccessToken(spDcCookie.value);

            const credentials: SpotifyCredentials = {
              cookies: cookies,
              accessToken: tokenData.accessToken,
              expiration: tokenData.accessTokenExpirationTimestampMs,
            };

            loginWindow.close();
            resolve(credentials);
          } catch (err) {
            reject(err);
          }
        }
      };

      loginWindow.webContents.on("did-navigate", (_event, url) =>
        handleNavigation(url),
      );
      loginWindow.webContents.on("did-redirect-navigation", (_event, url) =>
        handleNavigation(url),
      );

      loginWindow.on("closed", () => {
        reject(new Error("Login window was closed before completion"));
      });
    });
  }

  async refresh(
    spDc: string,
  ): Promise<Pick<SpotifyCredentials, "accessToken" | "expiration">> {
    const tokenData = await this.core.getAccessToken(spDc);
    return {
      accessToken: tokenData.accessToken,
      expiration: tokenData.accessTokenExpirationTimestampMs,
    };
  }
}
