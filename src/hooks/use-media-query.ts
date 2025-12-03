
"use client";

import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }

    const listener = () => {
      setMatches(media.matches);
    };
    
    // addEventListener is the modern way, but for broader compatibility with older browsers, we can use addListener.
    // However, since we are using React 18 and Next.js, modern browsers are expected.
    try {
        media.addEventListener('change', listener);
    } catch (e) {
        // Fallback for older browsers
        media.addListener(listener);
    }


    return () => {
        try {
            media.removeEventListener('change', listener);
        } catch (e) {
            // Fallback for older browsers
            media.removeListener(listener);
        }
    };
  }, [matches, query]);

  return matches;
}
