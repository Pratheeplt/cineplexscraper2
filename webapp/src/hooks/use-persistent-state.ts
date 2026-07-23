import { useEffect, useState } from "react";

// A useState that mirrors its value into localStorage so it survives reloads.
// Reads the stored value lazily on first render; writes on every change.
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore write failures (private mode, quota, etc.)
    }
  }, [key, value]);

  return [value, setValue] as const;
}
