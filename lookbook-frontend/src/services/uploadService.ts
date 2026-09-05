import { getAccessToken, refreshAccessToken, ApiClientError } from "./apiClient";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

/** File uploads use multipart/form-data, which the shared `api` JSON client
 * doesn't model — this hits the endpoint directly but reuses the same
 * bearer-token-in-memory + 401-refresh-retry behavior.
 *
 * `skipQualityCheck` bypasses the backend's AI "is this a clear book cover"
 * gate (§3.7) — appropriate for community post photos, which aren't book
 * covers and shouldn't be rejected for not looking like one. Book cover and
 * avatar uploads keep the check by leaving this false. */
export const uploadImage = async (file: File, skipQualityCheck = false): Promise<string> => {
  const form = new FormData();
  form.append("image", file);

  const doUpload = async () => {
    const token = getAccessToken();
    const query = skipQualityCheck ? "?skipQualityCheck=true" : "";
    return fetch(`${API_URL}/uploads/image${query}`, {
      method: "POST",
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });
  };

  let response = await doUpload();
  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) response = await doUpload();
  }

  const payload = await response.json().catch(() => undefined);
  if (!response.ok || !payload?.success) {
    throw new ApiClientError(response.status, payload?.message ?? "Image upload failed.");
  }

  return payload.data.url as string;
};
