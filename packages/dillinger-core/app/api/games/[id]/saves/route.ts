import { NextRequest, NextResponse } from 'next/server';
import { JSONStorageService } from '@/lib/services/storage';
import * as fs from 'fs-extra';
import * as path from 'path';
import type { Game } from '@dillinger/shared';

const storage = JSONStorageService.getInstance();

interface SaveFile {
  filename: string;
  type: 'sram' | 'state';
  size: number;
  modified: string;
  modifiedTimestamp: number;
  slot?: number; // For numbered save states
}

/**
 * Helper to find a game and its storage filename
 */
async function findGameAndFileKey(id: string): Promise<{ game: Game | null; fileKey: string | null }> {
  const directGame = await storage.readEntity<Game>('games', id);
  if (directGame) {
    return { game: directGame, fileKey: id };
  }
  
  const allGames = await storage.listEntities<Game>('games');
  const foundGame = allGames.find((g) => g.id === id || g.slug === id);
  
  if (!foundGame) {
    return { game: null, fileKey: null };
  }
  
  return { game: foundGame, fileKey: foundGame.id };
}

/**
 * Parse save state filename to extract slot number
 * RetroArch uses: game.state, game.state1, game.state2, etc.
 */
function parseStateSlot(filename: string): number | undefined {
  const match = filename.match(/\.state(\d+)?$/i);
  if (!match) return undefined;
  return match[1] ? parseInt(match[1], 10) : 0;
}

/**
 * Get list of save files from a directory (searches recursively for core subdirs)
 * RetroArch creates subdirectories named after the core (e.g., "Beetle PSX HW/")
 */
async function getSaveFiles(dir: string, type: 'sram' | 'state'): Promise<SaveFile[]> {
  if (!await fs.pathExists(dir)) {
    return [];
  }
  
  const saveFiles: SaveFile[] = [];
  
  // File extensions by type
  const extensions = type === 'sram' 
    ? ['.srm', '.sav', '.eep', '.fla', '.sra', '.mcr'] // Added .mcr for PSX memory cards
    : ['.state', '.state0', '.state1', '.state2', '.state3', '.state4', 
       '.state5', '.state6', '.state7', '.state8', '.state9'];
  
  // Recursive function to search directories
  async function scanDir(currentDir: string, relativePath: string = ''): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        // Recurse into subdirectories (core-specific folders like "Beetle PSX HW")
        const newRelPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
        await scanDir(fullPath, newRelPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        const isStateFile = type === 'state' && (ext === '.state' || /\.state\d+$/i.test(entry.name));
        const isSramFile = type === 'sram' && extensions.includes(ext);
        
        // Skip thumbnail images for save states
        if (entry.name.endsWith('.png') || entry.name.endsWith('.jpg')) {
          continue;
        }
        
        if (isStateFile || isSramFile) {
          const stats = await fs.stat(fullPath);
          
          // Include relative path in filename for nested files
          const displayFilename = relativePath 
            ? `${relativePath}/${entry.name}` 
            : entry.name;
          
          const saveFile: SaveFile = {
            filename: displayFilename,
            type,
            size: stats.size,
            modified: stats.mtime.toISOString(),
            modifiedTimestamp: stats.mtime.getTime(),
          };
      
          if (type === 'state') {
            saveFile.slot = parseStateSlot(entry.name);
          }
      
          saveFiles.push(saveFile);
        }
      }
    }
  }
  
  // Start scanning from root
  await scanDir(dir);
  
  // Sort by modified time (newest first)
  return saveFiles.sort((a, b) => b.modifiedTimestamp - a.modifiedTimestamp);
}

// GET /api/games/[id]/saves - Get list of save files for a game
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Game ID is required' },
        { status: 400 }
      );
    }
    
    const { game, fileKey } = await findGameAndFileKey(id);
    
    if (!game || !fileKey) {
      return NextResponse.json(
        { success: false, error: 'Game not found' },
        { status: 404 }
      );
    }
    
    // Construct paths to save directories
    const dillingerRoot = storage.getDillingerRoot();
    const gameId = game.id || game.slug || 'unknown';
    const savesBasePath = path.join(dillingerRoot, 'saves', gameId);
    const sramPath = path.join(savesBasePath, 'sram');
    const statesPath = path.join(savesBasePath, 'states');
    
    // Get save files from both directories
    const [sramFiles, stateFiles] = await Promise.all([
      getSaveFiles(sramPath, 'sram'),
      getSaveFiles(statesPath, 'state'),
    ]);
    
    return NextResponse.json({
      success: true,
      data: {
        gameId,
        sram: sramFiles,
        states: stateFiles,
        paths: {
          sram: sramPath,
          states: statesPath,
        },
      },
    });
  } catch (error) {
    console.error('Error getting saves:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get saves' },
      { status: 500 }
    );
  }
}

// DELETE /api/games/[id]/saves - Delete a specific save file
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');
    const type = searchParams.get('type') as 'sram' | 'state' | null;
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Game ID is required' },
        { status: 400 }
      );
    }
    
    if (!filename || !type) {
      return NextResponse.json(
        { success: false, error: 'filename and type are required' },
        { status: 400 }
      );
    }
    
    if (type !== 'sram' && type !== 'state') {
      return NextResponse.json(
        { success: false, error: 'type must be "sram" or "state"' },
        { status: 400 }
      );
    }
    
    const { game, fileKey } = await findGameAndFileKey(id);
    
    if (!game || !fileKey) {
      return NextResponse.json(
        { success: false, error: 'Game not found' },
        { status: 404 }
      );
    }
    
    // Construct path to save file
    const dillingerRoot = storage.getDillingerRoot();
    const gameId = game.id || game.slug || 'unknown';
    const subDir = type === 'sram' ? 'sram' : 'states';
    const filePath = path.join(dillingerRoot, 'saves', gameId, subDir, filename);
    
    // Security check: ensure file is within expected directory
    const expectedDir = path.join(dillingerRoot, 'saves', gameId, subDir);
    if (!filePath.startsWith(expectedDir)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file path' },
        { status: 400 }
      );
    }
    
    // Check if file exists
    if (!await fs.pathExists(filePath)) {
      return NextResponse.json(
        { success: false, error: 'Save file not found' },
        { status: 404 }
      );
    }
    
    // Delete the file
    await fs.remove(filePath);
    
    console.log(`[Saves] Deleted ${type} file: ${filePath}`);
    
    return NextResponse.json({
      success: true,
      message: `Deleted ${filename}`,
    });
  } catch (error) {
    console.error('Error deleting save:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete save' },
      { status: 500 }
    );
  }
}
