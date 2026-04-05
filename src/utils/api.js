const baseUrl = () =>
  (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");

const requestJson = async (path, options = {}) => {
  const url = `${baseUrl()}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...options.headers,
    },
    credentials: "include",
  });
  if (!res.ok) {
    const message = await res.text().catch(() => res.statusText);
    throw new Error(message || `Request failed: ${res.status}`);
  }
  return res.json();
};

export const api = {
  get: (path) => requestJson(path),
};

// Fetches the currently active queue token number from the live API
export const fetchCurrentToken = () => api.get("/queue/current-token");
