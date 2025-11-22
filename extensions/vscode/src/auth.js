"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceAuthManager = void 0;
const axios_1 = __importDefault(require("axios"));
const vscode = __importStar(require("vscode"));
const buffer_1 = require("buffer");
const TOKEN_KEY = 'devsync-token';
const decodeExpiry = (token) => {
    const parts = token.split('.');
    if (parts.length < 2) {
        return Math.floor(Date.now() / 1000) + 3600;
    }
    const payload = JSON.parse(buffer_1.Buffer.from(parts[1], 'base64').toString('utf-8'));
    return payload.exp ?? Math.floor(Date.now() / 1000) + 3600;
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
class DeviceAuthManager {
    constructor(context, apiUrl) {
        this.context = context;
        this.apiUrl = apiUrl;
    }
    async readTokens() {
        const raw = await this.context.secrets.get(TOKEN_KEY);
        return raw ? JSON.parse(raw) : null;
    }
    async persistTokens(tokens) {
        await this.context.secrets.store(TOKEN_KEY, JSON.stringify(tokens));
    }
    async refresh(refreshToken) {
        const response = await axios_1.default.post(`${this.apiUrl}/api/auth/token/refresh`, {
            refresh_token: refreshToken,
        });
        const { access_token, refresh_token } = response.data;
        const tokens = {
            accessToken: access_token,
            refreshToken: refresh_token,
            expiresAt: decodeExpiry(access_token),
        };
        await this.persistTokens(tokens);
        return tokens;
    }
    async startDeviceFlow() {
        const startRes = await axios_1.default.post(`${this.apiUrl}/api/auth/device/start`, {
            client_id: 'vscode',
        });
        const start = startRes.data;
        const open = 'Open device portal';
        const selection = await vscode.window.showInformationMessage(`Enter code ${start.user_code} to link VS Code.`, open);
        if (selection === open) {
            await vscode.env.openExternal(vscode.Uri.parse(start.verification_uri));
        }
        const tokens = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Waiting for DevSync authorization…',
            cancellable: true,
        }, async (_progress, cancellationToken) => {
            const deadline = Date.now() + start.expires_in * 1000;
            let delay = start.interval * 1000;
            while (Date.now() < deadline) {
                if (cancellationToken.isCancellationRequested) {
                    throw new Error('Login cancelled');
                }
                await sleep(delay);
                try {
                    const tokenRes = await axios_1.default.post(`${this.apiUrl}/api/auth/device/token`, {
                        device_code: start.device_code,
                    });
                    const data = tokenRes.data;
                    return {
                        accessToken: data.access_token,
                        refreshToken: data.refresh_token,
                        expiresAt: decodeExpiry(data.access_token),
                    };
                }
                catch (error) {
                    if (axios_1.default.isAxiosError(error) && error.response?.data?.error) {
                        const code = error.response.data.error;
                        if (code === 'authorization_pending') {
                            continue;
                        }
                        if (code === 'slow_down') {
                            delay += 2000;
                            continue;
                        }
                        if (code === 'expired_token') {
                            throw new Error('Device code expired. Run the login again.');
                        }
                    }
                    throw error;
                }
            }
            throw new Error('Device code expired. Please try again.');
        });
        await this.persistTokens(tokens);
        vscode.window.showInformationMessage('DevSync VS Code extension is now authenticated.');
        return tokens;
    }
    async ensureAuthenticated() {
        let tokens = await this.readTokens();
        const now = Math.floor(Date.now() / 1000);
        if (!tokens) {
            tokens = await this.startDeviceFlow();
            return tokens;
        }
        if (now >= tokens.expiresAt - 30) {
            tokens = await this.refresh(tokens.refreshToken);
        }
        return tokens;
    }
    async getAccessToken() {
        const tokens = await this.ensureAuthenticated();
        return tokens.accessToken;
    }
}
exports.DeviceAuthManager = DeviceAuthManager;
//# sourceMappingURL=auth.js.map