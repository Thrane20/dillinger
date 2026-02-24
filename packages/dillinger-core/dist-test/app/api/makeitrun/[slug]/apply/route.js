"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const storage_1 = require("@/lib/services/storage");
const makeitrun_service_1 = require("@/lib/services/makeitrun-service");
const storage = storage_1.JSONStorageService.getInstance();
async function findGameAndFileKey(id) {
    const directGame = await storage.readEntity('games', id);
    if (directGame) {
        return { game: directGame, fileKey: id };
    }
    const allGames = await storage.listEntities('games');
    const foundGame = allGames.find((game) => game.id === id || game.slug === id);
    if (!foundGame) {
        return { game: null, fileKey: null };
    }
    return { game: foundGame, fileKey: foundGame.id };
}
async function POST(request, { params }) {
    try {
        const { slug } = await params;
        if (!slug) {
            return server_1.NextResponse.json({ success: false, error: 'Slug is required' }, { status: 400 });
        }
        const body = await request.json();
        const gameId = body.gameId;
        if (!gameId) {
            return server_1.NextResponse.json({ success: false, error: 'gameId is required' }, { status: 400 });
        }
        const config = await makeitrun_service_1.makeItRunService.loadConfig(slug);
        if (!config) {
            return server_1.NextResponse.json({ success: false, error: 'MakeItRun config not found' }, { status: 404 });
        }
        const { game, fileKey } = await findGameAndFileKey(gameId);
        if (!game || !fileKey) {
            return server_1.NextResponse.json({ success: false, error: 'Game not found' }, { status: 404 });
        }
        const updatedGame = makeitrun_service_1.makeItRunService.applyToGame(game, config);
        await storage.writeEntity('games', fileKey, updatedGame);
        return server_1.NextResponse.json({
            success: true,
            data: updatedGame,
            message: 'MakeItRun config applied successfully',
        });
    }
    catch (error) {
        console.error('Error applying MakeItRun config:', error);
        return server_1.NextResponse.json({
            success: false,
            error: 'Failed to apply MakeItRun config',
            message: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
    }
}
