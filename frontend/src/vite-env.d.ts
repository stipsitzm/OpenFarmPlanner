/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ENABLE_AI?: string;
  readonly VITE_GRAPHICAL_ENABLE_PAN?: string;
  readonly VITE_GRAPHICAL_ENABLE_ZOOM?: string;
  readonly VITE_GRAPHICAL_ENABLE_OVERLAP_GUARD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
