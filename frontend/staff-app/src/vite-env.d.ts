/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Declare ion-icon custom element
declare namespace JSX {
  interface IntrinsicElements {
    'ion-icon': any;
  }
}
