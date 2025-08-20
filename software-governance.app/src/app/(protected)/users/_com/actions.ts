// app/users/_client/actions.ts
export class SafeFetchError extends Error {
  status: number;
  url: string;
  body: unknown;
  constructor(msg: string, status: number, url: string, body: unknown) {
    super(msg);
    this.name = 'SafeFetchError';
    this.status = status;
    this.url = url;
    this.body = body;
  }
}

async function safeFetch<T = unknown>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    cache: 'no-store',
  });

  const url = typeof input === 'string' ? input : (input as URL).toString();
  const ct = res.headers.get('content-type') ?? '';
  const isJson = ct.includes('application/json');

  let parsed: unknown = undefined;
  try {
    parsed = isJson ? await res.json() : await res.text(); // fall back to text
  } catch {
    // ignore parse errors; parsed stays undefined
  }

  if (!res.ok) {
    const msg = (() => {
        if (isJson && parsed && typeof parsed === 'object' && 'error' in parsed) {
        const e = (parsed as { error?: unknown }).error;
        if (typeof e === 'string') return e;
        }
        return `HTTP ${res.status}`;
     })();
    throw new SafeFetchError(msg, res.status, url, parsed);
  }

  // If server returned text but we expected JSON, coerce to empty
  return (isJson ? (parsed as T) : ({} as T));
}

/* API wrappers */

export async function currentAdminHasTOTP(): Promise<boolean> {
  const d = await safeFetch<{ ok: boolean; enabled: boolean }>('/api/me/totp/enabled', { method: 'GET' });
  return !!d.enabled;
}

export async function resetPassword(userId: string, totp: string): Promise<string | null> {

  const res = await fetch('/api/users/reset-password', {
    method: 'POST',
    body: JSON.stringify({ userId, totp }),
  });
  if(!res) return null;
  const data = await res.json().catch(() => ({}));
  if(!data.ok) return null;

  return data.password;
}

export async function deleteUser(userId: string, totp: string): Promise<void> {
  await safeFetch('/api/users/delete', {
    method: 'POST',
    body: JSON.stringify({ userId, totp }),
  });
}

export async function toggleUserStatus(userId: string, totp: string): Promise<void> {
  await safeFetch('/api/users/toggle-status', {
    method: 'POST',
    body: JSON.stringify({ userId, totp }),
  });
}


export async function changeUserRole(
  userId: string,
  role: string,
  totp: string
): Promise<void> {
  await safeFetch('/api/users/change-role', {
    method: 'POST',
    body: JSON.stringify({ userId, role, totp }),
  });
}
