"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const react_1 = __importDefault(require("react"));
const server_1 = require("react-dom/server");
const WineRenderingSection_1 = __importDefault(require("../../app/components/WineRenderingSection"));
const WineMakeItRunSection_1 = __importDefault(require("../../app/components/WineMakeItRunSection"));
const WinePerformanceSection_1 = __importDefault(require("../../app/components/WinePerformanceSection"));
const noopSectionRef = () => undefined;
const noopChange = () => undefined;
const renderingFormData = {
    settings: {
        wine: {
            renderer: 'opengl',
        },
        launch: {
            fullscreen: false,
            resolution: '1920x1080',
            useXrandr: false,
            xrandrMode: '',
        },
    },
};
const makeItRunFormData = {
    settings: {
        wine: {
            umuGameId: '',
            dllOverrides: '',
            winetricks: [],
            registrySettings: [],
        },
        launch: {
            environment: {},
        },
    },
};
const performanceFormData = {
    settings: {
        gamescope: {
            enabled: false,
            width: 1920,
            height: 1080,
            refreshRate: 60,
            fullscreen: false,
            upscaler: 'auto',
        },
        mangohud: {
            enabled: false,
        },
    },
};
const noopSetRendering = () => undefined;
const noopSetMakeItRun = () => undefined;
const noopSetPerformance = () => undefined;
(0, node_test_1.default)('Wine section components render lock placeholders for pre-install phases', async () => {
    const renderingLocked = (0, server_1.renderToStaticMarkup)(react_1.default.createElement(WineRenderingSection_1.default, {
        formData: renderingFormData,
        handleChange: noopChange,
        setFormData: noopSetRendering,
        phase: 'needs_install',
        sectionRef: noopSectionRef,
    }));
    const makeItRunLocked = (0, server_1.renderToStaticMarkup)(react_1.default.createElement(WineMakeItRunSection_1.default, {
        gameId: 'game-1',
        formData: makeItRunFormData,
        setFormData: noopSetMakeItRun,
        handleChange: noopChange,
        selectedLutrisInstallerId: undefined,
        makeItRunCompatLoading: false,
        makeItRunCompatSummary: null,
        makeItRunIoLoading: false,
        winetricksVerbQuery: '',
        setWinetricksVerbQuery: () => undefined,
        filteredWinetricksVerbs: [],
        commonWinetricksVerbs: [],
        applyDllQuickAdd: () => undefined,
        onAutoDetect: () => undefined,
        onExportToml: () => undefined,
        onImportFileSelected: () => undefined,
        phase: 'needs_install',
        sectionRef: noopSectionRef,
    }));
    const performanceLocked = (0, server_1.renderToStaticMarkup)(react_1.default.createElement(WinePerformanceSection_1.default, {
        formData: performanceFormData,
        setFormData: noopSetPerformance,
        handleChange: noopChange,
        isLocked: false,
        phase: 'needs_install',
        sectionRef: noopSectionRef,
    }));
    strict_1.default.match(renderingLocked, /Install the game first to access rendering settings\./);
    strict_1.default.match(makeItRunLocked, /Install the game first to access MakeItRun configuration\./);
    strict_1.default.match(performanceLocked, /Install the game first to access performance settings\./);
});
(0, node_test_1.default)('Wine section components hide lock placeholders for unlocked phases', async () => {
    const renderingUnlocked = (0, server_1.renderToStaticMarkup)(react_1.default.createElement(WineRenderingSection_1.default, {
        formData: renderingFormData,
        handleChange: noopChange,
        setFormData: noopSetRendering,
        phase: 'ready',
        sectionRef: noopSectionRef,
    }));
    const makeItRunUnlocked = (0, server_1.renderToStaticMarkup)(react_1.default.createElement(WineMakeItRunSection_1.default, {
        gameId: 'game-1',
        formData: makeItRunFormData,
        setFormData: noopSetMakeItRun,
        handleChange: noopChange,
        selectedLutrisInstallerId: undefined,
        makeItRunCompatLoading: false,
        makeItRunCompatSummary: null,
        makeItRunIoLoading: false,
        winetricksVerbQuery: '',
        setWinetricksVerbQuery: () => undefined,
        filteredWinetricksVerbs: [],
        commonWinetricksVerbs: [],
        applyDllQuickAdd: () => undefined,
        onAutoDetect: () => undefined,
        onExportToml: () => undefined,
        onImportFileSelected: () => undefined,
        phase: 'ready',
        sectionRef: noopSectionRef,
    }));
    const performanceUnlocked = (0, server_1.renderToStaticMarkup)(react_1.default.createElement(WinePerformanceSection_1.default, {
        formData: performanceFormData,
        setFormData: noopSetPerformance,
        handleChange: noopChange,
        isLocked: false,
        phase: 'ready',
        sectionRef: noopSectionRef,
    }));
    strict_1.default.doesNotMatch(renderingUnlocked, /Install the game first to access rendering settings\./);
    strict_1.default.doesNotMatch(makeItRunUnlocked, /Install the game first to access MakeItRun configuration\./);
    strict_1.default.doesNotMatch(performanceUnlocked, /Install the game first to access performance settings\./);
    strict_1.default.match(renderingUnlocked, /WineD3D Renderer/);
    strict_1.default.match(makeItRunUnlocked, /UMU Game ID/);
    strict_1.default.match(performanceUnlocked, /Use Gamescope compositor/);
});
