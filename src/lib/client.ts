import { useAuthStore } from "@/store/auth";

const BASE = "/api";

async function fetchWithAuth(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const store = useAuthStore.getState();
  let { accessToken } = store;
  const { refreshToken, setAccessToken, logout } = store;

  const buildHeaders = (token: string | null): Record<string, string> => ({
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  let res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: buildHeaders(accessToken),
  });

  if (res.status === 401 && refreshToken) {
    const refreshRes = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (refreshRes.ok) {
      const json = await refreshRes.json();
      const newToken = json.data?.accessToken;
      if (newToken) {
        setAccessToken(newToken);
        accessToken = newToken;
        res = await fetch(`${BASE}${path}`, {
          ...options,
          headers: buildHeaders(newToken),
        });
      }
    } else {
      logout();
      if (typeof window !== "undefined") window.location.href = "/login";
    }
  }

  return res;
}

export const api = {
  get: (path: string) => fetchWithAuth(path),
  post: (path: string, body?: unknown) =>
    fetchWithAuth(path, { method: "POST", body: JSON.stringify(body) }),
  patch: (path: string, body?: unknown) =>
    fetchWithAuth(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: (path: string) => fetchWithAuth(path, { method: "DELETE" }),
  upload: (path: string, formData: FormData) => {
    const { accessToken } = useAuthStore.getState();
    return fetch(`${BASE}${path}`, {
      method: "POST",
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      body: formData,
    });
  },
};

/** Unwrap { success, data } responses */
export async function apiJson<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Request failed");
  return json as T; // return full body so callers can access .data AND .pagination
}

/** Shorthand: unwrap just the .data field */
export async function apiData<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Request failed");
  return json.data as T;
}
