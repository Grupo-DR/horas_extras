/**
 * Carrega os indicadores das fontes oficiais com cache no navegador.
 * - Cache recente (até CACHE_TTL_MS) é usado sem consultar as fontes.
 * - Se uma fonte falhar, mostra o último valor bom em cache, marcado como desatualizado.
 * Fase 2 (planilhas ANP/ANTT) troca esta camada por leitura do Firestore sem mudar a tela.
 */
import { FocusExpectation, IndicatorMeta, IndicatorResult, latestFocusExpectations } from './marketIndicators';
import { INDICATOR_LOADERS, fetchFocus } from './marketSources';

const CACHE_KEY = 'market_indicators_v1';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export interface IndicatorEntry {
    meta: IndicatorMeta;
    result?: IndicatorResult;
    /** Quando o resultado veio do cache por falha na fonte: data em que foi obtido. */
    staleSince?: string;
    error?: string;
}

export interface MarketSnapshot {
    entries: IndicatorEntry[];
    focus: FocusExpectation[];
    focusError?: string;
    fetchedAt: string;
}

interface CachedData {
    savedAt: string;
    results: Record<string, { result: IndicatorResult; fetchedAt: string }>;
    focus?: { rows: FocusExpectation[]; fetchedAt: string };
}

const readCache = (): CachedData | null => {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        return raw ? (JSON.parse(raw) as CachedData) : null;
    } catch {
        return null;
    }
};

const writeCache = (data: CachedData) => {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {
        // Sem armazenamento local (modo privado, cota): segue sem cache.
    }
};

const errorMessage = (reason: unknown) => (reason instanceof Error ? reason.message : 'Falha ao consultar a fonte');

const fromCache = (cache: CachedData): MarketSnapshot => ({
    entries: INDICATOR_LOADERS.map(({ meta }) => ({ meta, result: cache.results[meta.id]?.result })),
    focus: cache.focus?.rows ?? [],
    fetchedAt: cache.savedAt
});

/** Focus como resultado (dados ou erro), para não interromper os demais indicadores. */
const loadFocus = async (todayIso: string): Promise<{ rows?: FocusExpectation[]; error?: string }> => {
    try {
        return { rows: latestFocusExpectations(await fetchFocus(todayIso)) };
    } catch (reason) {
        return { error: errorMessage(reason) };
    }
};

export const loadMarketIndicators = async (todayIso: string, { force = false } = {}): Promise<MarketSnapshot> => {
    const cache = readCache();
    if (!force && cache && Date.now() - new Date(cache.savedAt).getTime() < CACHE_TTL_MS) {
        return fromCache(cache);
    }

    const now = new Date().toISOString();
    const [settled, focusOutcome] = await Promise.all([
        Promise.allSettled(INDICATOR_LOADERS.map(({ load }) => load(todayIso))),
        loadFocus(todayIso)
    ]);

    const nextCache: CachedData = { savedAt: now, results: { ...(cache?.results ?? {}) }, focus: cache?.focus };

    const entries: IndicatorEntry[] = INDICATOR_LOADERS.map(({ meta }, index) => {
        const outcome = settled[index];
        if (outcome.status === 'fulfilled') {
            nextCache.results[meta.id] = { result: outcome.value, fetchedAt: now };
            return { meta, result: outcome.value };
        }
        const cached = cache?.results[meta.id];
        return { meta, result: cached?.result, staleSince: cached?.fetchedAt, error: errorMessage(outcome.reason) };
    });

    if (focusOutcome.rows) nextCache.focus = { rows: focusOutcome.rows, fetchedAt: now };

    writeCache(nextCache);
    return {
        entries,
        focus: focusOutcome.rows ?? cache?.focus?.rows ?? [],
        focusError: focusOutcome.error,
        fetchedAt: now
    };
};
