import { ProviderError } from './types.js';

export async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number; provider: string },
): Promise<Response> {
  const timeoutMs = init.timeoutMs ?? 120_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // Merge abort signals if provided
  const parent = init.signal;
  if (parent) {
    if (parent.aborted) controller.abort();
    else parent.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    return res;
  } catch (err) {
    const retryable =
      err instanceof Error &&
      (err.name === 'AbortError' || /network|fetch|ECONN/i.test(err.message));
    throw new ProviderError(
      `${init.provider} request failed: ${err instanceof Error ? err.message : String(err)}`,
      init.provider,
      retryable,
      err,
    );
  } finally {
    clearTimeout(timer);
  }
}

export function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}
