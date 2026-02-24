"use strict";
// Settings storage service for application configuration
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsService = exports.DILLINGER_CORE_PATH = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
// Use the same DILLINGER_CORE_PATH logic as storage service
// This MUST point to the dillinger_core Docker volume mount point
exports.DILLINGER_CORE_PATH = process.env.DILLINGER_CORE_PATH || '/data';
const SETTINGS_PATH = path_1.default.join(exports.DILLINGER_CORE_PATH, 'storage', 'settings.json');
class SettingsService {
    static instance;
    settings = {};
    initialized = false;
    initPromise = null;
    constructor() { }
    static getInstance() {
        if (!SettingsService.instance) {
            SettingsService.instance = new SettingsService();
        }
        return SettingsService.instance;
    }
    async ensureInitialized() {
        if (this.initialized)
            return;
        if (this.initPromise)
            return this.initPromise;
        this.initPromise = this.initialize();
        await this.initPromise;
    }
    async initialize() {
        if (this.initialized)
            return;
        await fs_extra_1.default.ensureDir(path_1.default.dirname(SETTINGS_PATH));
        if (await fs_extra_1.default.pathExists(SETTINGS_PATH)) {
            const data = await fs_extra_1.default.readJSON(SETTINGS_PATH);
            this.settings = data;
        }
        else {
            await this.save();
        }
        this.initialized = true;
    }
    async save() {
        await fs_extra_1.default.writeJSON(SETTINGS_PATH, this.settings, { spaces: 2 });
    }
    async getScraperSettings() {
        await this.ensureInitialized();
        return this.settings.scrapers || {};
    }
    async updateScraperSettings(settings) {
        await this.ensureInitialized();
        this.settings.scrapers = {
            ...this.settings.scrapers,
            ...settings,
        };
        await this.save();
    }
    async getAudioSettings() {
        await this.ensureInitialized();
        return this.settings.audio || {};
    }
    async updateAudioSettings(settings) {
        await this.ensureInitialized();
        this.settings.audio = {
            ...this.settings.audio,
            ...settings,
        };
        await this.save();
    }
    async getDockerSettings() {
        await this.ensureInitialized();
        return this.settings.docker || { autoRemoveContainers: true };
    }
    async updateDockerSettings(settings) {
        await this.ensureInitialized();
        this.settings.docker = {
            ...this.settings.docker,
            ...settings,
        };
        await this.save();
    }
    async getGpuSettings() {
        await this.ensureInitialized();
        return this.settings.gpu || { vendor: 'auto' };
    }
    async updateGpuSettings(settings) {
        await this.ensureInitialized();
        this.settings.gpu = {
            ...this.settings.gpu,
            ...settings,
        };
        await this.save();
    }
    async getGOGSettings() {
        await this.ensureInitialized();
        return this.settings.gog || {};
    }
    async updateGOGSettings(settings) {
        await this.ensureInitialized();
        this.settings.gog = {
            ...this.settings.gog,
            ...settings,
        };
        await this.save();
    }
    async getDownloadSettings() {
        await this.ensureInitialized();
        return {
            maxConcurrent: 2,
            installerCacheMode: 'custom_volume',
            autoCheckCompatibilityDatabases: true,
            ...this.settings.downloads,
        };
    }
    async updateDownloadSettings(settings) {
        await this.ensureInitialized();
        this.settings.downloads = {
            ...this.settings.downloads,
            ...settings,
        };
        await this.save();
    }
    async getJoystickSettings() {
        await this.ensureInitialized();
        return this.settings.joysticks || {};
    }
    async updateJoystickSettings(settings) {
        await this.ensureInitialized();
        this.settings.joysticks = {
            ...(this.settings.joysticks || {}),
            ...settings,
        };
        await this.save();
    }
    async getJoystickConfig(platform) {
        await this.ensureInitialized();
        return this.settings.joysticks?.[platform];
    }
    async getAllSettings() {
        await this.ensureInitialized();
        return { ...this.settings };
    }
    async getRetroarchSettings() {
        await this.ensureInitialized();
        const defaults = {
            mame: {
                aspect: 'auto',
                integerScale: true,
                borderlessFullscreen: true,
            },
        };
        return {
            ...defaults,
            ...this.settings.retroarch,
            mame: {
                ...defaults.mame,
                ...this.settings.retroarch?.mame,
            },
        };
    }
    async updateRetroarchSettings(settings) {
        await this.ensureInitialized();
        this.settings.retroarch = {
            ...this.settings.retroarch,
            ...settings,
            mame: {
                ...this.settings.retroarch?.mame,
                ...settings.mame,
            },
        };
        await this.save();
    }
    // ============================================================================
    // Streaming Settings
    // ============================================================================
    async getStreamingSettings() {
        await this.ensureInitialized();
        // Return stored settings merged with defaults
        const defaults = {
            streamingMode: 'profiles',
            gpuType: 'auto',
            codec: 'h264',
            quality: 'high',
            idleTimeoutMinutes: 15,
            waylandSocketPath: '/run/dillinger/wayland-dillinger',
            defaultProfileId: '1080p60',
            autoStart: true,
            streamingGraphPath: '/data/storage/streaming-graph.json',
        };
        return {
            ...defaults,
            ...this.settings.streaming,
        };
    }
    async updateStreamingSettings(settings) {
        await this.ensureInitialized();
        this.settings.streaming = {
            ...this.settings.streaming,
            ...settings,
        };
        await this.save();
    }
}
exports.SettingsService = SettingsService;
