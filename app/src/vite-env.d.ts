/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Deployment channel shown as a badge in the header (e.g. "v2" for the /v2/ preview). */
  readonly VITE_CHANNEL?: string;
}
