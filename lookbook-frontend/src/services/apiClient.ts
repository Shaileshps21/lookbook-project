const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// The CSRF cookie (set alongside the refresh cookie on login/refresh) is
// deliberately NOT httpOnly, precisely so this can read it and echo it back
// as a header — the backend's double-submit check on /auth/refresh and
// /auth/logout compares the two. Read fresh each call rather than cached,
// since the value rotates on every refresh.
const getCsrfCookie = (): string | undefined =>
  document.cookie.match(/(?:^|;\s*)lookbook_csrf=([^;]+)/)?.[1];

export class ApiClientError extends Error {
  status: number;
  errors?: { path: string; message: string }[];

  constructor(status: number, message: string, errors?: { path: string; message: string }[]) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

// The access token lives in memory only (never localStorage) to limit XSS
// blast radius. It's lost on a hard refresh by design — AuthContext restores
// it on load via a silent /auth/refresh call using the httpOnly refresh cookie.
let accessToken: string | null = null;

export const getAccessToken = () => accessToken;
export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  skipAuthRetry?: boolean;
}

const buildUrl = (path: string, query?: RequestOptions["query"]) => {
  const url = new URL(`${API_URL}${path}`);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
    });
  }
  return url.toString();
};

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
  errors?: { path: string; message: string }[];
}

const rawRequest = async (path: string, options: RequestOptions): Promise<Response> => {
  const csrfToken = getCsrfCookie();
  return fetch(buildUrl(path, options.query), {
    method: options.method ?? "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
};

interface RefreshResult<TUser> {
  user: TUser;
  accessToken: string;
}

// Only one refresh should ever be in flight from this tab — every caller
// (the 401-retry path below, and AuthContext's explicit session-restore call
// on load, including React StrictMode's double-invoked mount effect in dev)
// shares the same in-flight promise instead of each firing its own
// /auth/refresh request, which would otherwise race the same rotating cookie.
let refreshPromise: Promise<RefreshResult<unknown> | null> | null = null;

export const refreshAccessToken = async <TUser>(): Promise<RefreshResult<TUser> | null> => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        // The CSRF cookie is set on the API's own origin, which is
        // different from this app's origin (e.g. a Render API domain vs a
        // Vercel frontend domain) — document.cookie can never read a
        // cross-origin cookie, so it's normal for this to be undefined even
        // when a valid session exists. Send it when readable (same-origin
        // dev setups, or a proxy), but don't gate the call on it — the
        // backend falls back to validating the Origin header instead, and
        // an absent session simply 401s here, which is a normal "guest"
        // outcome for the caller.
        const csrfToken = getCsrfCookie();
        const res = await fetch(buildUrl("/auth/refresh"), {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
          },
        });
        if (!res.ok) return null;
        const payload = (await res.json()) as ApiEnvelope<RefreshResult<unknown>>;
        setAccessToken(payload.data.accessToken);
        return payload.data;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise as Promise<RefreshResult<TUser> | null>;
};

export async function request<T>(
  path: string,
  options: RequestOptions = {}
): Promise<{ data: T; meta?: Record<string, unknown> }> {
  let response = await rawRequest(path, options);

  if (response.status === 401 && !options.skipAuthRetry && path !== "/auth/refresh") {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await rawRequest(path, options);
    }
  }

  let payload: ApiEnvelope<T> | undefined;
  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }

  if (!response.ok || !payload?.success) {
    throw new ApiClientError(
      response.status,
      payload?.message ?? "Something went wrong. Please try again.",
      payload?.errors
    );
  }

  return { data: payload.data, meta: payload.meta };
}

export const api = {
  get: <T>(path: string, query?: RequestOptions["query"]) => request<T>(path, { method: "GET", query }),
  post: <T>(path: string, body?: unknown, options?: Pick<RequestOptions, "skipAuthRetry">) =>
    request<T>(path, { method: "POST", body, ...options }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
