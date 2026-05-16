export const readProjectEditorPersistedCacheEntry = <T>({
  key,
  shouldDiscard,
}: {
  key: string;
  shouldDiscard?: (payload: T) => boolean;
}) => {
  try {
    const rawValue = window.localStorage.getItem(key);

    if (!rawValue) {
      return null;
    }

    const payload = JSON.parse(rawValue) as T;

    if (shouldDiscard?.(payload)) {
      window.localStorage.removeItem(key);
      return null;
    }

    return payload;
  } catch {
    return null;
  }
};

export const writeProjectEditorPersistedCacheEntry = ({
  key,
  maxSerializedBytes = 250_000,
  payload,
}: {
  key: string;
  maxSerializedBytes?: number;
  payload: unknown;
}) => {
  try {
    const serializedPayload = JSON.stringify(payload);
    const serializedBytes = new Blob([serializedPayload]).size;

    if (serializedBytes > maxSerializedBytes) {
      window.localStorage.removeItem(key);
      return;
    }

    window.localStorage.setItem(key, serializedPayload);
  } catch {
    return;
  }
};

export const clearProjectEditorPersistedCacheEntries = (prefix: string) => {
  try {
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);

      if (key?.startsWith(prefix)) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    return;
  }
};
