/**
 * Lutris Service - Fetch and parse Lutris installers for GOG games
 * 
 * Lutris provides community-maintained install scripts that automate
 * Wine configuration and game installation.
 */

import axios from 'axios';

const LUTRIS_API_URL = 'https://lutris.net/api';

// Lutris script file reference
export interface LutrisFile {
  [key: string]: string; // e.g., { "installer": "N/A:Select the Windows installer" }
}

// Lutris script task
export interface LutrisTask {
  name: string; // e.g., 'wineexec', 'winetricks', 'create_prefix'
  executable?: string;
  prefix?: string;
  arch?: 'win32' | 'win64';
  args?: string;
  app?: string; // For winetricks
  silent?: boolean;
}

// Lutris script step - can be task, extract, move, merge, execute, etc.
export interface LutrisStep {
  task?: LutrisTask;
  extract?: {
    file: string;
    dst: string;
    format?: string;
  };
  move?: {
    src: string;
    dst: string;
  };
  merge?: {
    src: string;
    dst: string;
  };
  execute?: {
    file?: string;
    command?: string;
    args?: string;
  };
  chmodx?: string;
  write_config?: {
    file: string;
    section?: string;
    key: string;
    value: string;
  };
}

// Lutris game configuration
export interface LutrisGameConfig {
  exe?: string;
  prefix?: string;
  arch?: 'win32' | 'win64';
  args?: string;
  working_dir?: string;
}

// Lutris Wine configuration
export interface LutrisWineConfig {
  version?: string;
  dxvk?: boolean;
  esync?: boolean;
  overrides?: Record<string, string>;
}

// The full Lutris script
export interface LutrisScript {
  'custom-name'?: string;
  files?: LutrisFile[];
  game?: LutrisGameConfig;
  installer?: LutrisStep[];
  wine?: LutrisWineConfig;
  system?: {
    env?: Record<string, string>;
  };
}

// A Lutris installer from the API
export interface LutrisInstaller {
  id: number;
  game_id: number;
  game_slug: string;
  name: string;
  year: number;
  user: string;
  runner: string; // 'wine', 'linux', 'steam', etc.
  slug: string;
  version: string;
  description: string | null;
  notes: string;
  credits: string;
  created_at: string;
  updated_at: string;
  draft: boolean;
  published: boolean;
  rating: string;
  steamid: number | null;
  gogid: number | null;
  gogslug: string | null;
  humbleid: string | null;
  script: LutrisScript;
  content: string; // YAML content as string
}

// Lutris game from the API
export interface LutrisGame {
  name: string;
  slug: string;
  year: number;
  platforms: Array<{ name: string }>;
  genres: Array<{ name: string }>;
  description: string;
  banner_url: string;
  icon_url: string;
  coverart: string;
  steamid: number | null;
  gogslug: string | null;
  humblestoreid: string | null;
  installers: LutrisInstaller[];
}

// Simplified installer info for UI
export interface LutrisInstallerSummary {
  id: number;
  slug: string;
  version: string;
  runner: string;
  description: string | null;
  notes: string;
  user: string;
  updatedAt: string;
  gogid: number | null;
  script: LutrisScript;
}

// Lutris search result item
interface LutrisSearchResult {
  id: number;
  name: string;
  slug: string;
  year: number | null;
  banner_url: string;
  icon_url: string;
  coverart: string | null;
  platforms: Array<{ name: string }>;
  provider_games: Array<{
    name: string;
    slug: string;
    service: string; // 'gog', 'steam', 'igdb', etc.
  }>;
  aliases: Array<{
    slug: string;
    name: string;
  }>;
}

interface LutrisSearchResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: LutrisSearchResult[];
}

/**
 * Generate search variations for a game title to improve Lutris matching
 * e.g., "Diablo + Hellfire" -> ["Diablo + Hellfire", "Diablo Hellfire", "Diablo", "Hellfire"]
 */
function generateSearchVariations(title: string): string[] {
  const variations: string[] = [title];
  
  // Replace special separators with space
  const normalized = title
    .replace(/[+:;–—-]+/g, ' ')  // Replace +, :, ;, dashes with space
    .replace(/\s+/g, ' ')         // Collapse multiple spaces
    .trim();
  
  if (normalized !== title) {
    variations.push(normalized);
  }
  
  // Remove common suffixes/editions
  const withoutEdition = normalized
    .replace(/\s*(game of the year|goty|gold|complete|definitive|enhanced|remastered|edition|collection)\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  if (withoutEdition && withoutEdition !== normalized && withoutEdition.length > 3) {
    variations.push(withoutEdition);
  }
  
  // Split by common separators and try individual significant words
  const words = normalized.split(/\s+/).filter(w => w.length > 3);
  if (words.length >= 2) {
    // Try first two significant words
    variations.push(words.slice(0, 2).join(' '));
    // Try just the first word if it's substantial
    if (words[0].length >= 4) {
      variations.push(words[0]);
    }
  }
  
  // Remove duplicates while preserving order
  return [...new Set(variations)];
}

/**
 * Search Lutris with multiple query variations
 */
async function searchLutrisWithVariations(
  searchQueries: string[],
  gogId: number
): Promise<{ results: LutrisSearchResult[]; matchedQuery: string } | null> {
  const gogIdStr = String(gogId);
  
  for (const query of searchQueries) {
    console.log(`[Lutris] Trying search: "${query}"`);
    
    try {
      const searchResponse = await axios.get<LutrisSearchResponse>(
        `${LUTRIS_API_URL}/games`,
        {
          params: { search: query },
          timeout: 10000,
        }
      );
      
      if (!searchResponse.data.results || searchResponse.data.results.length === 0) {
        continue;
      }
      
      // Check if any result has our GOG ID
      const exactMatch = searchResponse.data.results.find(r =>
        r.provider_games?.some(p => p.service === 'gog' && p.slug === gogIdStr)
      );
      
      if (exactMatch) {
        console.log(`[Lutris] Found exact GOG match with query "${query}": ${exactMatch.name}`);
        return { results: searchResponse.data.results, matchedQuery: query };
      }
      
      // If we got results but no exact GOG match, keep them as fallback
      if (searchResponse.data.results.length > 0) {
        console.log(`[Lutris] Found ${searchResponse.data.results.length} results with query "${query}" (no exact GOG match)`);
        return { results: searchResponse.data.results, matchedQuery: query };
      }
    } catch (error: any) {
      console.log(`[Lutris] Search failed for "${query}": ${error.message}`);
    }
  }
  
  return null;
}

/**
 * Search for Lutris installers for a GOG game
 * @param gameTitle - The game title to search for
 * @param gogId - The GOG game ID for matching
 */
export async function searchLutrisInstallers(
  gameTitle: string,
  gogId: number
): Promise<LutrisInstallerSummary[]> {
  try {
    console.log(`[Lutris] Searching for installers for: "${gameTitle}" (GOG ID: ${gogId})`);
    
    // Generate search variations to improve matching
    const searchQueries = generateSearchVariations(gameTitle);
    console.log(`[Lutris] Search variations: ${searchQueries.join(', ')}`);
    
    // Step 1: Search Lutris with various query variations
    const searchResult = await searchLutrisWithVariations(searchQueries, gogId);
    
    if (!searchResult) {
      console.log(`[Lutris] No games found for any search variation`);
      return [];
    }
    
    // Step 2: Find the game that matches our GOG ID in provider_games
    let matchedGameSlug: string | null = null;
    const gogIdStr = String(gogId);
    
    for (const result of searchResult.results) {
      // Check if this game has our GOG ID in provider_games
      const gogProvider = result.provider_games?.find(
        p => p.service === 'gog' && p.slug === gogIdStr
      );
      
      if (gogProvider) {
        console.log(`[Lutris] Found matching game: ${result.name} (slug: ${result.slug})`);
        matchedGameSlug = result.slug;
        break;
      }
    }
    
    // If no exact GOG match, try the first result as a fallback
    if (!matchedGameSlug && searchResult.results.length > 0) {
      const firstResult = searchResult.results[0];
      console.log(`[Lutris] No exact GOG match, using first result: ${firstResult.name} (slug: ${firstResult.slug})`);
      matchedGameSlug = firstResult.slug;
    }
    
    if (!matchedGameSlug) {
      return [];
    }
    
    // Step 3: Get full game details including installers
    const gameResponse = await axios.get<LutrisGame>(`${LUTRIS_API_URL}/games/${matchedGameSlug}`, {
      timeout: 10000,
    });
    
    const game = gameResponse.data;
    
    if (!game.installers || game.installers.length === 0) {
      console.log(`[Lutris] No installers found for ${matchedGameSlug}`);
      return [];
    }
    
    // Filter to Wine-based installers that are for GOG
    // Prefer installers with matching gogid or gogslug
    const allWineInstallers = game.installers.filter(installer => {
      // Must be a Wine runner (not Steam, not native Linux, etc.)
      if (installer.runner !== 'wine') {
        return false;
      }
      
      // Must be published
      if (installer.draft || !installer.published) {
        return false;
      }
      
      return true;
    });
    
    console.log(`[Lutris] Found ${allWineInstallers.length} Wine installers total, ${game.installers.length} installers overall`);
    
    // From the Wine installers, prefer ones explicitly for GOG
    const gogInstallers = allWineInstallers.filter(installer => {
      const isGogInstaller = 
        (installer.gogid === gogId) ||
        installer.slug.includes('gog') ||
        installer.version.toLowerCase().includes('gog');
      
      return isGogInstaller;
    });
    
    // If no GOG-specific installers, fall back to any Wine installer
    const installers = gogInstallers.length > 0 
      ? gogInstallers 
      : allWineInstallers;
    
    console.log(`[Lutris] Returning ${installers.length} installers (${gogInstallers.length} GOG-specific)`);
    
    // Transform to summary format
    return installers.map(installer => ({
      id: installer.id,
      slug: installer.slug,
      version: installer.version,
      runner: installer.runner,
      description: installer.description,
      notes: installer.notes,
      user: installer.user,
      updatedAt: installer.updated_at,
      gogid: installer.gogid,
      script: installer.script,
    }));
    
  } catch (error: any) {
    if (error.response?.status === 404) {
      console.log(`[Lutris] Game not found for: "${gameTitle}"`);
      return [];
    }
    console.error(`[Lutris] Error searching for installers:`, error.message);
    throw new Error(`Failed to search Lutris: ${error.message}`);
  }
}

/**
 * Get a specific Lutris installer by slug
 */
export async function getLutrisInstaller(
  gameSlug: string,
  installerSlug: string
): Promise<LutrisInstaller | null> {
  try {
    const response = await axios.get<LutrisGame>(`${LUTRIS_API_URL}/games/${gameSlug}`, {
      timeout: 10000,
    });
    
    const installer = response.data.installers?.find(i => i.slug === installerSlug);
    return installer || null;
    
  } catch (error: any) {
    console.error(`[Lutris] Error fetching installer:`, error.message);
    return null;
  }
}

/**
 * Parse Lutris script to extract key configuration
 */
export function parseLutrisScript(script: LutrisScript): {
  requiresUserFile: boolean;
  userFilePrompt?: string;
  wineArch: 'win32' | 'win64';
  exePath?: string;
  winetricks: string[];
  hasExtractStep: boolean;
  hasWineExecStep: boolean;
} {
  const result = {
    requiresUserFile: false,
    userFilePrompt: undefined as string | undefined,
    wineArch: (script.game?.arch || 'win64') as 'win32' | 'win64',
    exePath: script.game?.exe,
    winetricks: [] as string[],
    hasExtractStep: false,
    hasWineExecStep: false,
  };
  
  // Check files for user-provided files (N/A: prefix)
  if (script.files) {
    for (const fileEntry of script.files) {
      for (const [_key, value] of Object.entries(fileEntry)) {
        if (typeof value === 'string' && value.startsWith('N/A:')) {
          result.requiresUserFile = true;
          result.userFilePrompt = value.substring(4).trim();
          break;
        }
      }
    }
  }
  
  // Check installer steps
  if (script.installer) {
    for (const step of script.installer) {
      if (step.extract) {
        result.hasExtractStep = true;
      }
      if (step.task?.name === 'wineexec') {
        result.hasWineExecStep = true;
        // Get arch from task if specified
        if (step.task.arch) {
          result.wineArch = step.task.arch;
        }
      }
      if (step.task?.name === 'winetricks' && step.task.app) {
        result.winetricks.push(...step.task.app.split(/\s+/));
      }
    }
  }
  
  return result;
}

/**
 * Get the file key that maps to the GOG installer
 * Lutris scripts typically use "installer" as the key for user-provided files
 */
export function getInstallerFileKey(script: LutrisScript): string | null {
  if (!script.files) return null;
  
  for (const fileEntry of script.files) {
    for (const [key, value] of Object.entries(fileEntry)) {
      if (typeof value === 'string' && value.startsWith('N/A:')) {
        return key;
      }
    }
  }
  
  return null;
}
