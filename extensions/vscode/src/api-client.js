"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DevSyncApiClient = void 0;
const axios_1 = __importDefault(require("axios"));
class DevSyncApiClient {
    constructor(apiUrl, projectId, authManager) {
        this.apiUrl = apiUrl;
        this.projectId = projectId;
        this.authManager = authManager;
        this.client = axios_1.default.create({
            baseURL: apiUrl,
        });
    }
    async authHeaders() {
        const token = await this.authManager.getAccessToken();
        return {
            Authorization: `Bearer ${token}`,
        };
    }
    async scan(projectPath, databaseConnection) {
        const headers = await this.authHeaders();
        const response = await this.client.post('/api/scans', {
            projectId: this.projectId,
            path: projectPath,
            databaseConnection,
        }, { headers });
        return response.data;
    }
    async getScanReports(limit = 10) {
        const headers = await this.authHeaders();
        const response = await this.client.get('/api/scans', {
            params: {
                projectId: this.projectId,
                limit,
            },
            headers,
        });
        return response.data.scanReports || [];
    }
    async getLatestScanReport() {
        const reports = await this.getScanReports(1);
        return reports.length > 0 ? reports[0] : null;
    }
    async generateMigration(scanReportId, format = 'sql') {
        const headers = await this.authHeaders();
        const response = await this.client.post('/api/migrations', {
            scanReportId,
            format,
        }, { headers });
        return response.data;
    }
    async getMigrations(scanReportId) {
        const params = { projectId: this.projectId };
        if (scanReportId) {
            params.scanReportId = scanReportId;
        }
        const headers = await this.authHeaders();
        const response = await this.client.get('/api/migrations', { params, headers });
        return response.data.migrations || [];
    }
    getDashboardUrl() {
        return `${this.apiUrl}/dashboard/projects/${this.projectId}`;
    }
}
exports.DevSyncApiClient = DevSyncApiClient;
//# sourceMappingURL=api-client.js.map