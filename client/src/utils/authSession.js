const ACCESS_TOKEN_KEY = "accessToken";
const PERSISTED_CACHE_PREFIX = "persist:sellsquare-cache:";

export const getAccessToken = () => {
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY) || "";
  } catch (error) {
    return "";
  }
};

export const setAccessToken = (token) => {
  try {
    if (!token) return;
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
  } catch (error) {
    // no-op: avoid blocking auth flow when storage is unavailable
  }
};

export const clearAccessToken = () => {
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  } catch (error) {
    // no-op
  }
};

export const hasAccessToken = () => Boolean(getAccessToken());

export const clearLegacyPersistedCache = () => {
  try {
    const keysToDelete = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(PERSISTED_CACHE_PREFIX)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    // no-op
  }
};
