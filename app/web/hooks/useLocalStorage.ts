
import { useState, useEffect, useRef, useCallback } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T) {
  // Use a ref to track if it's the initial mount to avoid overwriting local storage on first render
  const isInitialMount = useRef(true);
  const previousKeyRef = useRef(key);

  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  useEffect(() => {
    if (previousKeyRef.current === key) return;
    previousKeyRef.current = key;

    try {
      const item = window.localStorage.getItem(key);
      setStoredValue(item ? JSON.parse(item) : initialValue);
    } catch (error) {
      console.error(`Error switching localStorage key "${key}":`, error);
      setStoredValue(initialValue);
    }

    isInitialMount.current = true;
  }, [key, initialValue]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Performance optimization: Debounce the synchronous localStorage write
    // This prevents blocking the main thread during rapid state updates (like typing or batch ops)
    const handler = setTimeout(() => {
      try {
        window.localStorage.setItem(key, JSON.stringify(storedValue));
      } catch (error) {
        console.error(`Error saving localStorage key "${key}":`, error);
      }
    }, 100);

    return () => clearTimeout(handler);
  }, [key, storedValue]);

  // Force a re-read from local storage (useful for sync features)
  const syncFromStorage = useCallback(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        setStoredValue(JSON.parse(item));
        return true;
      }
    } catch (error) {
      console.error(`Error syncing localStorage key "${key}":`, error);
    }
    return false;
  }, [key]);

  return [storedValue, setStoredValue, syncFromStorage] as const;
}
