import { getConfig } from './config.js';

export type CoreBootstrapStatus = {
  initialized: boolean;
  dillingerCorePath: string;
  runtime: 'native' | 'container';
  hostDataPath: string | null;
  volume: {
    name: string;
    containerMount: string;
    envVar: string;
  };
};

export type CoreHealthStatus = {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime?: number;
  counts?: {
    games?: number;
    platforms?: number;
    sessions?: number;
    collections?: number;
  };
};

export type CoreGame = {
  id: string;
  slug?: string;
  title: string;
  platformId?: string;
  defaultPlatformId?: string;
  metadata?: {
    lastPlayed?: string;
    playCount?: number;
  };
  platforms?: Array<{
    platformId: string;
  }>;
};

type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  count?: number;
  error?: string;
  message?: string;
};

function getCoreBaseUrl(): string {
  const { port } = getConfig();
  return `http://127.0.0.1:${port}`;
}

async function fetchCoreJson<T>(pathname: string, init?: RequestInit, timeoutMs: number = 4_000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${getCoreBaseUrl()}${pathname}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getCoreBootstrapStatus(): Promise<CoreBootstrapStatus> {
  return fetchCoreJson<CoreBootstrapStatus>('/api/bootstrap/status');
}

export async function getCoreHealthStatus(): Promise<CoreHealthStatus> {
  return fetchCoreJson<CoreHealthStatus>('/api/health');
}

export async function listCoreGames(): Promise<CoreGame[]> {
  const response = await fetchCoreJson<ApiEnvelope<CoreGame[]>>('/api/games');
  if (response.success === false) {
    throw new Error(response.error ?? response.message ?? 'Failed to load games');
  }

  return response.data ?? [];
}

export async function launchCoreGame(gameId: string): Promise<{ session?: { id: string; status: string } }> {
  return fetchCoreJson<{ session?: { id: string; status: string } }>(`/api/launch/${encodeURIComponent(gameId)}`, {
    method: 'POST',
    body: JSON.stringify({ mode: 'local' }),
  }, 10_000);
}

export async function isCoreReachable(): Promise<boolean> {
  try {
    await getCoreBootstrapStatus();
    return true;
  } catch {
    return false;
  }
}
