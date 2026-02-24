import type { GameFormData, MakeItRunCompatibilitySummary } from './game-form-types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const readErrorMessage = (payload: unknown, fallback: string): string => {
  if (isRecord(payload) && typeof payload.error === 'string') {
    return payload.error;
  }
  return fallback;
};

const ensureSuccess = (response: Response, payload: unknown, fallbackError: string) => {
  if (!response.ok) {
    throw new Error(readErrorMessage(payload, fallbackError));
  }

  if (isRecord(payload) && payload.success === false) {
    throw new Error(readErrorMessage(payload, fallbackError));
  }
};

const extractSlug = (payload: unknown, slugFallback: string) => {
  if (isRecord(payload) && isRecord(payload.data) && typeof payload.data.slug === 'string') {
    return payload.data.slug;
  }
  return slugFallback;
};

export const applyCompatibilitySummary = (
  prev: GameFormData,
  summary: MakeItRunCompatibilitySummary,
): GameFormData => ({
  ...prev,
  settings: {
    ...prev.settings,
    wine: {
      ...prev.settings?.wine,
      umuGameId: summary.suggestedUmuGameId || prev.settings?.wine?.umuGameId,
      winetricks: Array.from(new Set([...(prev.settings?.wine?.winetricks || []), ...summary.winetricks])),
    },
  },
});

export const fetchCompatibilitySummary = async (gameId: string): Promise<MakeItRunCompatibilitySummary> => {
  const response = await fetch(`/api/compatibility/${gameId}`);
  const payload: unknown = await response.json();
  ensureSuccess(response, payload, 'Compatibility lookup failed');

  const report = isRecord(payload) && isRecord(payload.data) ? payload.data : {};
  const sources = Array.isArray(report.sources) ? report.sources : [];
  const suggestions = isRecord(report.suggestions) ? report.suggestions : {};

  const protonfixesSource = sources.find((source) => isRecord(source) && source.name === 'protonfixes');
  const protonfixData = isRecord(protonfixesSource) && isRecord(protonfixesSource.data)
    ? protonfixesSource.data
    : {};

  return {
    suggestedUmuGameId: typeof suggestions.suggestedUmuGameId === 'string'
      ? suggestions.suggestedUmuGameId
      : undefined,
    winetricks: Array.isArray(suggestions.winetricks)
      ? suggestions.winetricks.filter((item): item is string => typeof item === 'string')
      : [],
    hasComplexFixes: Boolean(protonfixData.has_complex_logic),
    complexFixNotes: typeof protonfixData.notes === 'string' ? protonfixData.notes : undefined,
    protonfixScriptUrl: isRecord(protonfixesSource) && typeof protonfixesSource.url === 'string'
      ? protonfixesSource.url
      : undefined,
  };
};

export const exportMakeItRunToml = async (gameId: string, slugFallback: string) => {
  const generateResponse = await fetch(`/api/makeitrun/generate/${gameId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ useCompatibility: false }),
  });
  const generatePayload: unknown = await generateResponse.json();
  ensureSuccess(generateResponse, generatePayload, 'Failed to generate MakeItRun config');

  const slug = extractSlug(generatePayload, slugFallback);
  const exportResponse = await fetch(`/api/makeitrun/${encodeURIComponent(slug)}/export`);
  if (!exportResponse.ok) {
    throw new Error('Failed to export MakeItRun TOML');
  }

  const tomlContent = await exportResponse.text();
  return { slug, tomlContent };
};

export const importMakeItRunToml = async (toml: string, slugFallback: string, gameId: string) => {
  const saveResponse = await fetch('/api/makeitrun', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toml, slug: slugFallback }),
  });
  const savePayload: unknown = await saveResponse.json();
  ensureSuccess(saveResponse, savePayload, 'Failed to import MakeItRun TOML');

  const slug = extractSlug(savePayload, slugFallback);

  const applyResponse = await fetch(`/api/makeitrun/${encodeURIComponent(slug)}/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameId }),
  });
  const applyPayload: unknown = await applyResponse.json();
  ensureSuccess(applyResponse, applyPayload, 'Imported TOML could not be applied to this game');

  return { slug };
};

export const runWineRegistrySetup = async (gameId: string) => {
  const response = await fetch(`/api/launch/${gameId}/registry-setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  const payload: unknown = await response.json();
  ensureSuccess(response, payload, 'Failed to run Wine registry setup');

  const message = isRecord(payload) && typeof payload.message === 'string'
    ? payload.message
    : 'Registry setup completed.';

  return { message };
};

export const applyConfiguredWineRegistrySettings = async (
  gameId: string,
  registrySettings: Array<{
    path: string;
    name: string;
    type: 'REG_SZ' | 'REG_DWORD' | 'REG_BINARY' | 'REG_MULTI_SZ' | 'REG_EXPAND_SZ';
    value: string;
  }>,
  platformId?: string,
) => {
  const response = await fetch(`/api/launch/${gameId}/registry-apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ registrySettings, platformId }),
  });

  const payload: unknown = await response.json();
  ensureSuccess(response, payload, 'Failed to apply configured registry settings');

  const message = isRecord(payload) && typeof payload.message === 'string'
    ? payload.message
    : 'Registry settings applied.';
  const appliedCount = isRecord(payload) && typeof payload.appliedCount === 'number'
    ? payload.appliedCount
    : undefined;

  return { message, appliedCount };
};
