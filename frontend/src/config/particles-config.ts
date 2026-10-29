// src/config/particles-config.ts -> OPTIMIZED VERSION

import type { ISourceOptions } from "tsparticles-engine";

export const particlesConfig: ISourceOptions = {
  background: {
    color: { value: "transparent" },
  },
  // --- PERFORMANCE OPTIMIZATIONS ---
  fpsLimit: 40, // Lower the frame rate limit slightly. 40 is still very smooth.
  detectRetina: false, // Disabling this can save resources on high-DPI screens.
  
  // Disable interactivity on hover, which is a major performance cost.
  interactivity: {
    events: {
      onHover: {
        enable: false, 
      },
    },
  },
  
  particles: {
    color: {
      value: ["#f7797d", "#c471ed", "#e5a1ad"],
    },
    links: {
      enable: false,
    },
    shape: {
      type: "line",
    },
    size: {
      value: { min: 1, max: 3 },
    },
    opacity: {
      value: { min: 0.1, max: 0.4 },
    },
    move: {
      direction: "bottom",
      enable: true,
      outModes: {
        default: "out",
      },
      speed: { min: 0.5, max: 1.5 },
      straight: true,
    },
    number: {
      density: {
        enable: true,
        area: 1200, // Increase the area to reduce the overall density.
      },
      value: 60, // Reduce the number of particles.
    },
  },
};