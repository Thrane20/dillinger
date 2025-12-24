import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const SESSIONS_DIR = path.join(process.cwd(), 'data/storage/sessions');
const GAMES_DIR = path.join(process.cwd(), 'data/storage/games');

interface SessionData {
  id: string;
  gameId: string;
  platformId?: string;
  status: string;
  performance?: {
    startTime: string;
    endTime?: string;
  };
  containerId?: string;
  screenshots?: string[];
}

interface GameMetadata {
  title?: string;
  primaryImage?: string;
}

export async function GET(request: NextRequest) {
  try {
    // Read all session files
    const sessionFiles = await fs.readdir(SESSIONS_DIR).catch(() => []);
    
    const sessions = await Promise.all(
      sessionFiles
        .filter(file => file.endsWith('.json') && file !== 'index.json')
        .map(async (file) => {
          try {
            const sessionPath = path.join(SESSIONS_DIR, file);
            const sessionData = JSON.parse(await fs.readFile(sessionPath, 'utf-8')) as SessionData;
            
            // Calculate duration from performance data
            let duration = 0;
            let startTime = '';
            let endTime = '';
            
            if (sessionData.performance?.startTime) {
              startTime = sessionData.performance.startTime;
              endTime = sessionData.performance.endTime || new Date().toISOString();
              
              const start = new Date(startTime).getTime();
              const end = new Date(endTime).getTime();
              duration = (end - start) / 1000 / 60; // Convert to minutes
            }
            
            // Get game metadata
            let gameTitle = sessionData.gameId;
            let gamePrimaryImage: string | undefined;
            
            try {
              const gamePath = path.join(GAMES_DIR, `${sessionData.gameId}.json`);
              const gameData = JSON.parse(await fs.readFile(gamePath, 'utf-8'));
              gameTitle = gameData.title || gameData.id;
              gamePrimaryImage = gameData.metadata?.primaryImage;
            } catch (err) {
              // Game file not found or couldn't be read
              console.error(`Failed to load game metadata for ${sessionData.gameId}:`, err);
            }
            
            // Map status
            let status: 'running' | 'completed' | 'crashed' = 'completed';
            if (sessionData.status === 'running' || sessionData.status === 'active') {
              status = 'running';
            } else if (sessionData.status === 'crashed' || sessionData.status === 'error') {
              status = 'crashed';
            }
            
            return {
              id: sessionData.id,
              gameId: sessionData.gameId,
              gameTitle,
              gamePrimaryImage,
              startTime,
              endTime: sessionData.performance?.endTime,
              duration,
              status,
              platform: sessionData.platformId,
              screenshots: sessionData.screenshots || [],
            };
          } catch (err) {
            console.error(`Failed to parse session file ${file}:`, err);
            return null;
          }
        })
    );
    
    // Filter out null entries and sort by start time (newest first)
    const validSessions = sessions
      .filter((s): s is NonNullable<typeof s> => s !== null && s.startTime)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    
    return NextResponse.json({ sessions: validSessions });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sessions', sessions: [] },
      { status: 500 }
    );
  }
}
