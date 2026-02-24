"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildLaunchEnvironmentVariables = buildLaunchEnvironmentVariables;
function buildLaunchEnvironmentVariables(gameId, sessionId, environment) {
    return [
        `GAME_ID=${gameId}`,
        `SESSION_ID=${sessionId}`,
        `SAVES_PATH=/data/saves/${gameId}`,
        ...Object.entries(environment).map(([key, value]) => `${key}=${value}`),
    ];
}
