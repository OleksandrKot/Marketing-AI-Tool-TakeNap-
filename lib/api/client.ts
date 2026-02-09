export type ApiError = { status: number; message: string; details?: unknown };

export async function fetchJSON<T>(
  input: string | URL,
  init?: RequestInit & { timeoutMs?: number }
): Promise<T> {
  const controller = new AbortController();
  const timeout = init?.timeoutMs ? setTimeout(() => controller.abort(), init.timeoutMs) : null;
  try {
    const res = await fetch(input, { ...init, signal: controller.signal });
    const isJson = (res.headers.get('content-type') || '').includes('application/json');
    const data = isJson ? await res.json() : await res.text();
    if (!res.ok) {
      const message = isJson ? data?.error || data?.message || String(data) : String(data);
      const err: ApiError = { status: res.status, message, details: isJson ? data : undefined };
      throw err;
    }
    return data as T;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function postJSON<T>(
  input: string | URL,
  body: unknown,
  init?: RequestInit & { timeoutMs?: number }
): Promise<T> {
  return fetchJSON<T>(input, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    body: JSON.stringify(body),
    ...init,
  });
}
