import React, { useEffect, useState } from 'react';
import { APP_BUILD_INFO, formatBuildDate, formatVersionLabel } from '../utils/appVersion';

const COPIED_FEEDBACK_MS = 1500;

/**
 * Selo discreto com a versão do sistema no canto inferior direito.
 * Fica abaixo de modais e avisos (z-10) e some na impressão.
 * Um clique copia versão, commit e data para colar em chamados.
 */
export const AppVersionBadge: React.FC = () => {
    const [copied, setCopied] = useState(false);
    const label = formatVersionLabel(APP_BUILD_INFO);
    const builtAt = formatBuildDate(APP_BUILD_INFO.builtAt);
    const isProduction = APP_BUILD_INFO.environment === 'production';

    useEffect(() => {
        if (!copied) return;
        const timer = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
        return () => clearTimeout(timer);
    }, [copied]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(`${label} (publicado em ${builtAt})`);
            setCopied(true);
        } catch {
            // Sem permissão de área de transferência: o texto continua visível no selo.
        }
    };

    return (
        <button
            type="button"
            onClick={handleCopy}
            title={`Publicado em ${builtAt}. Clique para copiar.`}
            aria-label={`Versão do sistema ${label}, publicada em ${builtAt}. Clique para copiar.`}
            className={`fixed bottom-1 right-2 z-10 print:hidden select-none rounded px-1.5 py-0.5 font-mono text-[10px] leading-none opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100 ${
                isProduction ? 'bg-white/70 text-slate-500' : 'bg-amber-100 text-amber-800'
            }`}
        >
            {copied ? 'Copiado' : label}
        </button>
    );
};
