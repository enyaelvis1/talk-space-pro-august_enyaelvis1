export type StoredFormDraft<T> = {
  data: T;
  updatedAt: string;
};

function getStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function loadFormDraft<T>(key: string): StoredFormDraft<T> | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredFormDraft<T>;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !parsed.data ||
      typeof parsed.updatedAt !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveFormDraft<T>(key: string, data: T) {
  const storage = getStorage();
  if (!storage) return;
  try {
    const payload: StoredFormDraft<T> = {
      data,
      updatedAt: new Date().toISOString(),
    };
    storage.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignore storage failures; drafts are a convenience only.
  }
}

export function clearFormDraft(key: string) {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage failures.
  }
}
