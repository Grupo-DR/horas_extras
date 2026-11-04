import path from 'path';
import { execSync } from 'child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import packageJson from './package.json';

/** Commit publicado: Vercel informa na build; localmente vem do git. */
const resolveCommit = (): string => {
  const vercelSha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (vercelSha) return vercelSha.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'local';
  }
};

/** Ambiente da build: production e preview na Vercel; development no resto. */
const resolveEnvironment = (): 'production' | 'preview' | 'development' => {
  const vercelEnv = process.env.VERCEL_ENV;
  return vercelEnv === 'production' || vercelEnv === 'preview' ? vercelEnv : 'development';
};

export default defineConfig(() => {
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      // Versão exibida no rodapé (utils/appVersion.ts). Regra: README, seção "Versionamento".
      __APP_VERSION__: JSON.stringify(packageJson.version),
      __APP_COMMIT__: JSON.stringify(resolveCommit()),
      __APP_BUILT_AT__: JSON.stringify(new Date().toISOString()),
      __APP_ENV__: JSON.stringify(resolveEnvironment()),
      // A chave do Gemini não entra mais no build: fica na Cloud Function aiGenerateContent.
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-ai': ['@google/generative-ai'],
            'vendor-firebase': ['firebase/app', 'firebase/firestore', 'firebase/auth']
          }
        }
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
