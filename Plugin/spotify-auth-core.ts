import axios from 'axios';
import crypto from 'crypto';
import type { SpotifyTokenResponse } from './types.js';

/**
 * Derives the TOTP secret from Spotify's ciphertext byte array.
 * Spotify XORs each byte with ((index % 33) + 9), concatenates the
 * decimal results into a string, then treats it as UTF-8 bytes.
 */
function deriveSecret(ciphertext: number[]): Buffer {
    const derived = ciphertext
        .map((byte, i) => byte ^ ((i % 33) + 9))
        .join('');
    return Buffer.from(derived, 'utf8');
}

/**
 * Standard RFC-6238 TOTP using HMAC-SHA1.
 */
function generateTOTP(secret: Buffer, timestampMs: number, stepSeconds = 30, digits = 6): string {
    const epoch = Math.floor(timestampMs / 1000);
    const counter = BigInt(Math.floor(epoch / stepSeconds));
    const counterBuf = Buffer.alloc(8);
    counterBuf.writeBigInt64BE(counter);

    const hmac = crypto.createHmac('sha1', secret);
    hmac.update(counterBuf);
    const hash = hmac.digest();

    const offset = hash[hash.length - 1]! & 0xf;
    const binary =
        ((hash[offset]! & 0x7f) << 24) |
        ((hash[offset + 1]! & 0xff) << 16) |
        ((hash[offset + 2]! & 0xff) << 8) |
        (hash[offset + 3]! & 0xff);

    return (binary % 10 ** digits).toString().padStart(digits, '0');
}

function base32Decode(base32Str: string): Buffer {
    const charTable = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = '';
    for (let i = 0; i < base32Str.length; i++) {
        const val = charTable.indexOf(base32Str.charAt(i)!.toUpperCase());
        if (val === -1) continue;
        bits += val.toString(2).padStart(5, '0');
    }
    const bytes: number[] = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
        bytes.push(parseInt(bits.substring(i, i + 8), 2));
    }
    return Buffer.from(bytes);
}

export interface SpotifySecrets {
    version: string;
    secret: Buffer;
}

export class SpotifyAuthCore {
    /**
     * Internal TOTP secrets handling without external GitHub dependencies.
     */
    private secretsUrls: string[] = [];

    // Built-in fallback secret for Spotify TOTP generation
    private fallbackSecret: SpotifySecrets = {
        version: '61',
        secret: base32Decode('GM3TMMJTGYZTQNZVGM4DINJZHA4TGOBYGMZTCMRTGEYDSMJRHE4TEOBUG4YTCMRUGQ4DQOJUGQYTAMRRGA2TCMJSHE3TCMBY'),
    };

    async getLatestSecrets(): Promise<SpotifySecrets> {
        for (const url of this.secretsUrls) {
            try {
                const response = await axios.get(url, { timeout: 4000 });
                const data = response.data;

                // Format 1: [{ "s": "BASE32...", "v": 61 }] (nuance.json format)
                if (Array.isArray(data) && data.length > 0) {
                    const sorted = [...data].sort((a, b) => Number(b.v) - Number(a.v));
                    const latest = sorted[0];
                    if (latest?.s && latest?.v) {
                        return {
                            version: latest.v.toString(),
                            secret: base32Decode(latest.s),
                        };
                    }
                }

                // Format 2: { "61": [bytes...], "62": [bytes...] }
                if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
                    const versions = Object.keys(data).sort((a, b) => parseInt(b) - parseInt(a));
                    if (versions.length > 0) {
                        const version = versions[0]!;
                        const ciphertext = data[version];
                        if (Array.isArray(ciphertext)) {
                            return {
                                version,
                                secret: deriveSecret(ciphertext),
                            };
                        }
                    }
                }
            } catch (err) {
                console.warn('[SpotifyAuthCore] Failed to fetch secrets from', url, err);
            }
        }

        console.warn('[SpotifyAuthCore] Using built-in fallback TOTP secrets');
        return this.fallbackSecret;
    }

    async getServerTime(): Promise<number> {
        try {
            const response = await axios.get('https://open.spotify.com/api/server-time', { timeout: 4000 });
            if (response.data?.serverTime) {
                return response.data.serverTime;
            }
        } catch {}
        return Math.floor(Date.now() / 1000);
    }

    async getAnonymousToken(): Promise<SpotifyTokenResponse> {
        return this.fetchToken();
    }

    async getAccessToken(spDc: string): Promise<SpotifyTokenResponse> {
        const tokenData = await this.fetchToken(spDc);
        if (tokenData.isAnonymous) {
            throw new Error('Spotify returned an anonymous token — sp_dc cookie may be invalid or expired');
        }
        return tokenData;
    }

    private async fetchToken(spDc?: string): Promise<SpotifyTokenResponse> {
        const secrets = await this.getLatestSecrets();
        const serverTime = await this.getServerTime();

        const nowMs = Date.now();
        const serverMs = serverTime * 1000;

        const totpClient = generateTOTP(secrets.secret, nowMs);
        const totpServer = generateTOTP(secrets.secret, serverMs);

        const url = new URL('https://open.spotify.com/api/token');
        url.searchParams.set('reason', 'transport');
        url.searchParams.set('productType', 'web-player');
        url.searchParams.set('totp', totpClient);
        url.searchParams.set('totpServer', totpServer);
        url.searchParams.set('totpVer', secrets.version);
        url.searchParams.set('sTime', serverTime.toString());
        url.searchParams.set('cTime', Math.floor(nowMs / 1000).toString());

        const headers: Record<string, string> = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Origin': 'https://open.spotify.com',
            'Referer': 'https://open.spotify.com/',
        };

        if (spDc) {
            headers['Cookie'] = `sp_dc=${spDc}`;
        }

        const response = await axios.get(url.toString(), {
            headers,
            timeout: 5000,
        });

        if (!response.data || !response.data.accessToken) {
            throw new Error('Failed to retrieve access token from Spotify');
        }

        return {
            accessToken: response.data.accessToken,
            accessTokenExpirationTimestampMs: response.data.accessTokenExpirationTimestampMs || (Date.now() + 3600 * 1000),
            isAnonymous: !!response.data.isAnonymous,
            clientId: response.data.clientId || '',
        };
    }
}
