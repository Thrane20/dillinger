import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated, getGOGLibrary } from '@/lib/services/gog-auth';
import { GOGCacheService } from '@/lib/services/gog-cache';

// Disable caching for this dynamic route
export const dynamic = 'force-dynamic';

const gogCache = GOGCacheService.getInstance();

interface FilterOptions {
  page: number;
  limit: number;
  search: string;
  sortBy: string;
  sortOrder: string;
}

// Using a generic GameLike type that both GOGGame and cache games can satisfy
interface GameLike {
  id: number | string;
  title: string;
  image?: string | null;
  url?: string;
  worksOn?: {
    Windows: boolean;
    Mac: boolean;
    Linux: boolean;
  };
}

function filterAndPaginate(games: GameLike[], options: FilterOptions) {
  let filtered = [...games];
  
  // Search filter
  if (options.search) {
    const searchLower = options.search.toLowerCase();
    filtered = filtered.filter(game => 
      game.title.toLowerCase().includes(searchLower)
    );
  }
  
  // Sort
  filtered.sort((a, b) => {
    const aVal = String((a as unknown as Record<string, unknown>)[options.sortBy] || '');
    const bVal = String((b as unknown as Record<string, unknown>)[options.sortBy] || '');
    const cmp = aVal.localeCompare(bVal);
    return options.sortOrder === 'desc' ? -cmp : cmp;
  });
  
  // Paginate
  const start = (options.page - 1) * options.limit;
  const end = start + options.limit;
  const paged = filtered.slice(start, end);
  
  return {
    games: paged,
    total: filtered.length,
    page: options.page,
    limit: options.limit,
    totalPages: Math.ceil(filtered.length / options.limit),
  };
}

// GET /api/online-sources/gog/games - Get GOG library
export async function GET(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    
    if (!authenticated) {
      return NextResponse.json(
        { error: 'Not authenticated with GOG' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'title';
    const sortOrder = searchParams.get('sortOrder') || 'asc';
    const refresh = searchParams.get('refresh') === 'true';

    // Check if we have cached games and don't need refresh
    if (!refresh && await gogCache.isCacheValid()) {
      const cachedData = await gogCache.getCachedGames();
      if (cachedData && cachedData.games && cachedData.games.length > 0) {
        return NextResponse.json(filterAndPaginate(cachedData.games, { page, limit, search, sortBy, sortOrder }));
      }
    }

    // Fetch from GOG API
    const games = await getGOGLibrary();
    
    // Cache the games - convert to cache format
    const cacheGames = games.map(g => ({
      id: String(g.id),
      title: g.title,
      image: g.image || null,
      url: g.url || '',
    }));
    await gogCache.cacheGames(cacheGames, 1);

    return NextResponse.json(filterAndPaginate(games, { page, limit, search, sortBy, sortOrder }));
  } catch (error) {
    console.error('Failed to get GOG library:', error);
    return NextResponse.json(
      { error: 'Failed to get GOG library', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
