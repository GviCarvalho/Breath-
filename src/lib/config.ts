/**
 * Runtime configuration service
 * Loads configuration from public/config.json at runtime with fallback to build-time env vars
 */

interface RuntimeConfig {
  SERVER_HTTP_URL: string;
  SERVER_WS_URL: string;
}

let cachedConfig: RuntimeConfig | null = null;
let configLoadPromise: Promise<RuntimeConfig> | null = null;

/**
 * Loads runtime configuration from public/config.json
 * Falls back to build-time environment variables if config is not available or empty
 */
async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  try {
    const response = await fetch('/Breath-/config.json');
    if (!response.ok) {
      throw new Error(`Failed to load config: ${response.status}`);
    }
    
    const config: RuntimeConfig = await response.json();
    
    // Use runtime config if both URLs are provided, otherwise fallback to env vars
    const httpUrl = config.SERVER_HTTP_URL || (import.meta as any).env?.VITE_SERVER_HTTP_URL || '';
    const wsUrl = config.SERVER_WS_URL || (import.meta as any).env?.VITE_SERVER_WS_URL || '';
    
    return {
      SERVER_HTTP_URL: httpUrl,
      SERVER_WS_URL: wsUrl,
    };
  } catch (error) {
    console.warn('[Config] Failed to load runtime config, using env vars fallback:', error);
    // Fallback to build-time env vars
    return {
      SERVER_HTTP_URL: (import.meta as any).env?.VITE_SERVER_HTTP_URL || '',
      SERVER_WS_URL: (import.meta as any).env?.VITE_SERVER_WS_URL || '',
    };
  }
}

/**
 * Gets the runtime configuration
 * Returns cached config if available, otherwise loads it
 */
export async function getConfig(): Promise<RuntimeConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }
  
  if (!configLoadPromise) {
    configLoadPromise = loadRuntimeConfig();
  }
  
  cachedConfig = await configLoadPromise;
  return cachedConfig;
}

/**
 * Checks if the server is configured (has valid URLs)
 */
export function isServerConfigured(config: RuntimeConfig): boolean {
  return !!(config.SERVER_HTTP_URL && config.SERVER_WS_URL);
}

/**
 * Gets the configuration synchronously (may return empty config if not loaded yet)
 * Use this only after calling getConfig() at least once
 */
export function getConfigSync(): RuntimeConfig {
  return cachedConfig || {
    SERVER_HTTP_URL: '',
    SERVER_WS_URL: '',
  };
}
