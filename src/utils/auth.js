export const TOKEN_KEY = "zeytinerp_token";
export const USER_KEY = "zeytinerp_user";

function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getToken() {
  return getStorage()?.getItem(TOKEN_KEY) || null;
}

export function getUser() {
  const rawUser = getStorage()?.getItem(USER_KEY);
  if (!rawUser) return null;

  try {
    return JSON.parse(rawUser);
  } catch {
    return null;
  }
}

export function saveAuth(token, user) {
  const storage = getStorage();
  if (!storage) return;

  storage.setItem(TOKEN_KEY, token);
  storage.setItem(USER_KEY, JSON.stringify(user || {}));
}

export function clearAuth() {
  const storage = getStorage();
  if (!storage) return;

  storage.removeItem(TOKEN_KEY);
  storage.removeItem(USER_KEY);
}
