import { useEffect, useState } from 'react';

/**
 * Current time that refreshes periodically, so "overdue" / "in the past"
 * labels update while a screen stays open (and render stays pure).
 */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
