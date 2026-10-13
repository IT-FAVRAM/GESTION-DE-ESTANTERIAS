/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_FIREBASE_VAPID_KEY: string;
    // more env variables...
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

/** Id único de cada build (vite.config `define`); se publica también en /version.json. */
declare const __BUILD_ID__: string;


