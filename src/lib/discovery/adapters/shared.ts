import { AdapterError } from '../types';

export const LEADS_PER_SOURCE = 15;

/**
 * Fetch JSON with adapter-grade error classification. Every adapter failure
 * becomes an AdapterError so the orchestrator can report coverage honestly.
 */
export async function fetchJson<T>(
  url: string,
  signal: AbortSignal,
  headers?: Record<string, string>,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { headers, signal });
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new AdapterError('timeout', 'Request aborted or timed out');
    }
    throw new AdapterError('failed', (err as Error).message || 'Network error');
  }

  if (res.status === 403 || res.status === 429) {
    const reset = res.headers.get('x-ratelimit-reset');
    const hint = reset
      ? ` (resets ${new Date(Number(reset) * 1000).toLocaleTimeString()})`
      : '';
    throw new AdapterError('rate-limited', `Rate limited${hint}`);
  }
  if (!res.ok) {
    throw new AdapterError('failed', `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}
