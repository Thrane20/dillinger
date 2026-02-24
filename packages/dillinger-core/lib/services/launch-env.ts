export function buildLaunchEnvironmentVariables(
  gameId: string,
  sessionId: string,
  environment: Record<string, string>
): string[] {
  return [
    `GAME_ID=${gameId}`,
    `SESSION_ID=${sessionId}`,
    `SAVES_PATH=/data/saves/${gameId}`,
    ...Object.entries(environment).map(([key, value]) => `${key}=${value}`),
  ];
}
