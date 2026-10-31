/**
 * Versão do sistema exibida no rodapé de todas as telas.
 *
 * Os valores são injetados pelo Vite na build (ver `vite.config.ts`):
 * - version: campo "version" do package.json (SemVer, atualizado a cada entrega);
 * - commit: commit publicado (Vercel: VERCEL_GIT_COMMIT_SHA; local: git);
 * - builtAt: data/hora da build (ISO);
 * - environment: production | preview | development (Vercel: VERCEL_ENV).
 *
 * Regra de versionamento: README.md, seção "Versionamento".
 */

export type AppEnvironment = 'production' | 'preview' | 'development';

export interface AppBuildInfo {
    version: string;
    commit: string;
    builtAt: string;
    environment: AppEnvironment;
}

export const APP_BUILD_INFO: AppBuildInfo = {
    version: __APP_VERSION__,
    commit: __APP_COMMIT__,
    builtAt: __APP_BUILT_AT__,
    environment: __APP_ENV__
};

const ENVIRONMENT_LABELS: Record<Exclude<AppEnvironment, 'production'>, string> = {
    preview: 'homologação',
    development: 'local'
};

/** Ex.: "v1.0.0 · 582d65c" em produção; "v1.0.0 · 582d65c · homologação" fora dela. */
export const formatVersionLabel = (info: AppBuildInfo): string => {
    const base = `v${info.version} · ${info.commit}`;
    return info.environment === 'production' ? base : `${base} · ${ENVIRONMENT_LABELS[info.environment]}`;
};

/** Ex.: "31/10/2026 15:41". Retorna o texto original se a data for inválida. */
export const formatBuildDate = (iso: string): string => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};
