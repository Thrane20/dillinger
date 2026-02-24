import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveWinePhase } from './wine-phase.js';
const createWinePlatform = (overrides = {}) => ({
    platformId: 'windows-wine',
    settings: {
        launch: {
            command: '',
        },
        wine: {},
    },
    installation: {
        status: 'not_installed',
    },
    ...overrides,
});
test('returns needs_install when platform is missing', () => {
    const phase = deriveWinePhase(undefined, undefined);
    assert.equal(phase, 'needs_install');
});
test('returns needs_install when installation is not installed', () => {
    const phase = deriveWinePhase({ slug: 'test-game', title: 'Test Game' }, createWinePlatform({ installation: { status: 'not_installed' } }));
    assert.equal(phase, 'needs_install');
});
test('returns installing when installation is running', () => {
    const phase = deriveWinePhase({ slug: 'test-game', title: 'Test Game' }, createWinePlatform({ installation: { status: 'installing' } }));
    assert.equal(phase, 'installing');
});
test('returns install_failed when installation failed', () => {
    const phase = deriveWinePhase({ slug: 'test-game', title: 'Test Game' }, createWinePlatform({ installation: { status: 'failed' } }));
    assert.equal(phase, 'install_failed');
});
test('returns post_install when installed without launch command', () => {
    const phase = deriveWinePhase({ slug: 'test-game', title: 'Test Game' }, createWinePlatform({
        installation: { status: 'installed' },
        settings: {
            launch: { command: '   ' },
            wine: {},
        },
    }));
    assert.equal(phase, 'post_install');
});
test('returns needs_configuration when command exists but no detected tweaks', () => {
    const phase = deriveWinePhase({ slug: 'test-game', title: 'Test Game' }, createWinePlatform({
        installation: { status: 'installed' },
        settings: {
            launch: { command: 'game.exe' },
            wine: {},
        },
    }));
    assert.equal(phase, 'needs_configuration');
});
test('returns ready when command exists and tweaks are present', () => {
    const phase = deriveWinePhase({ slug: 'test-game', title: 'Test Game' }, createWinePlatform({
        installation: { status: 'installed' },
        settings: {
            launch: { command: 'game.exe' },
            wine: { umuGameId: 'umu-test-game' },
        },
    }));
    assert.equal(phase, 'ready');
});
test('returns running when active session flag is true', () => {
    const phase = deriveWinePhase({ slug: 'test-game', title: 'Test Game' }, createWinePlatform({
        installation: { status: 'installed' },
        settings: {
            launch: { command: 'game.exe' },
            wine: { umuGameId: 'umu-test-game' },
        },
    }), { hasActiveSession: true });
    assert.equal(phase, 'running');
});
