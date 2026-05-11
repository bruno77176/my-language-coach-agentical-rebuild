import { useState } from "react";

let hasMounted = false;

/**
 * Returns true on the first render of the app's lifetime, false thereafter.
 * Used to gate the intro animation so it only plays on cold start, not when
 * resuming from background.
 */
export function useColdStart(): boolean {
  const [coldStart] = useState(() => {
    if (hasMounted) return false;
    hasMounted = true;
    return true;
  });
  return coldStart;
}
