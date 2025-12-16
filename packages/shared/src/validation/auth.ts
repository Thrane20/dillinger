// API Key authentication utilities
// Note: Express types will be available when used in the runner application

export interface ApiKeyValidationResult {
  isValid: boolean;
  apiKey?: string;
  error?: string;
}

// Validate API key from various sources
export function validateApiKeyFromHeaders(
  headers: Record<string, string | string[] | undefined>,
  query: Record<string, any>,
  requiredApiKey: string
): ApiKeyValidationResult {
  const apiKey = (headers['x-api-key'] as string) || 
                 (headers['authorization'] as string)?.replace('Bearer ', '') ||
                 query.apiKey as string;

  if (!apiKey) {
    return {
      isValid: false,
      error: 'API key required'
    };
  }

  if (apiKey !== requiredApiKey) {
    return {
      isValid: false,
      error: 'Invalid API key'
    };
  }

  return {
    isValid: true,
    apiKey
  };
}

// Environment variable helpers
export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

export function getOptionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}