// API Key authentication utilities
// Note: Express types will be available when used in the runner application
// Validate API key from various sources
export function validateApiKeyFromHeaders(headers, query, requiredApiKey) {
    const apiKey = headers['x-api-key'] ||
        headers['authorization']?.replace('Bearer ', '') ||
        query.apiKey;
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
export function getRequiredEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Required environment variable ${name} is not set`);
    }
    return value;
}
export function getOptionalEnv(name, defaultValue) {
    return process.env[name] || defaultValue;
}
