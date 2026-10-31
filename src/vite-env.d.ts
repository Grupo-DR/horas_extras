/// <reference types="vite/client" />

declare module '*.png';
declare module '*.jpg';
declare module '*.svg';

// Injetados pelo Vite na build (vite.config.ts → define).
declare const __APP_VERSION__: string;
declare const __APP_COMMIT__: string;
declare const __APP_BUILT_AT__: string;
declare const __APP_ENV__: 'production' | 'preview' | 'development';
