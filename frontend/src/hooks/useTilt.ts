// src/hooks/useTilt.ts
import { useEffect, useRef } from 'react';
import VanillaTilt from 'vanilla-tilt';

const options = {
  scale: 1.05,
  speed: 1000,
  max: 15,
};

export function useTilt<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (ref.current) {
      VanillaTilt.init(ref.current, options);
    }
    
    return () => {
      if (ref.current && (ref.current as any).vanillaTilt) {
        (ref.current as any).vanillaTilt.destroy();
      }
    };
  }, []);

  return ref;
}