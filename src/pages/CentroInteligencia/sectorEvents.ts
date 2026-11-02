/**
 * Agenda de eventos do setor exibida na tela inicial.
 *
 * Para atualizar: edite a lista SECTOR_EVENTS abaixo e publique (regra de versionamento no README).
 * - Use `start`/`end` (AAAA-MM-DD) só quando a data estiver divulgada.
 *   `dateSource: 'oficial'` = site do organizador; `'imprensa'` = notícias (aparece "a confirmar").
 * - Sem data divulgada, deixe `start` vazio e informe `lastEdition` (e `usualMonth` se o mês for regular).
 * - `image` é opcional: caminho em /public (ex.: '/assets/eventos/feicon.png'). Sem imagem, aparece
 *   o ícone da categoria.
 *
 * Datas conferidas em 02/11/2026.
 */

export type EventCategory = 'construcao' | 'ferrovia' | 'tecnologia' | 'gestao' | 'agro';

export interface SectorEvent {
    id: string;
    name: string;
    organizer?: string;
    category: EventCategory;
    location: string;
    url: string;
    comment: string;
    start?: string;
    end?: string;
    dateSource?: 'oficial' | 'imprensa';
    /** Edição anterior, mostrada quando a próxima ainda não tem data. */
    lastEdition?: string;
    /** Mês em que costuma acontecer (1–12), usado para ordenar eventos sem data. */
    usualMonth?: number;
    image?: string;
}

export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
    construcao: 'Construção',
    ferrovia: 'Ferrovias',
    tecnologia: 'Tecnologia',
    gestao: 'Gestão e pessoas',
    agro: 'Agro'
};

export const SECTOR_EVENTS: SectorEvent[] = [
    {
        id: 'megaobra',
        name: 'Megaobra',
        organizer: 'Fiemg',
        category: 'construcao',
        location: 'Belo Horizonte (MG) · Expominas',
        url: 'https://www.fiemg.com.br',
        comment: 'Feira da cadeia da construção civil mineira: fornecedores, redução de custos e mão de obra.',
        start: '2026-11-24',
        end: '2026-11-26',
        dateSource: 'imprensa'
    },
    {
        id: 'conexao-cbic',
        name: 'Conexão CBIC',
        organizer: 'CBIC',
        category: 'construcao',
        location: 'Brasília (DF)',
        url: 'https://cbic.org.br',
        comment: 'Encontro de executivos da construção com governo e especialistas sobre os rumos do setor.',
        lastEdition: '2 dez 2025',
        usualMonth: 12
    },
    {
        id: 'feicon',
        name: 'FEICON',
        organizer: 'RX Brasil',
        category: 'construcao',
        location: 'São Paulo (SP) · São Paulo Expo',
        url: 'https://www.feicon.com.br',
        comment: 'Maior feira de construção civil e arquitetura da América Latina: materiais, sistemas e tendências.',
        start: '2027-04-06',
        end: '2027-04-09',
        dateSource: 'oficial'
    },
    {
        id: 'concrete-show',
        name: 'Concrete Show South America',
        organizer: 'Informa Markets',
        category: 'construcao',
        location: 'São Paulo (SP) · São Paulo Expo',
        url: 'https://www.concreteshow.com.br',
        comment: 'Concreto, pré-fabricados, equipamentos e tecnologia de obra, com foco em infraestrutura.',
        lastEdition: '25–27 ago 2026',
        usualMonth: 8
    },
    {
        id: 'mt-expo',
        name: 'M&T Expo',
        organizer: 'Sobratema e Messe München',
        category: 'construcao',
        location: 'São Paulo (SP) · São Paulo Expo',
        url: 'https://www.mtexpo.com.br',
        comment: 'Equipamentos para construção e mineração: referência para frota, locação e manutenção.',
        start: '2027-11-16',
        end: '2027-11-19',
        dateSource: 'oficial'
    },
    {
        id: 'construsummit',
        name: 'Construsummit',
        organizer: 'Sienge',
        category: 'construcao',
        location: 'Florianópolis (SC)',
        url: 'https://sienge.com.br/construsummit',
        comment: 'Gestão e tecnologia na construção e no mercado imobiliário: dados, IA e processos de obra.',
        lastEdition: '1–2 jul 2026'
    },
    {
        id: 'nt-expo',
        name: 'NT Expo – Negócios nos Trilhos',
        category: 'ferrovia',
        location: 'São Paulo (SP) · Distrito Anhembi',
        url: 'https://www.ntexpo.com.br',
        comment: 'Principal feira ferroviária da América Latina: material rodante, via permanente e manutenção.',
        start: '2027-10-19',
        end: '2027-10-21',
        dateSource: 'oficial'
    },
    {
        id: 'semana-metroferroviaria',
        name: 'Semana de Tecnologia Metroferroviária',
        organizer: 'AEAMESP',
        category: 'ferrovia',
        location: 'São Paulo (SP)',
        url: 'https://www.aeamesp.org.br',
        comment: 'Congresso técnico de metrôs e ferrovias com exposição; bom para relacionamento com operadoras.',
        lastEdition: '1–4 set 2026',
        usualMonth: 9
    },
    {
        id: 'conexao-anptrilhos',
        name: 'Conexão ANPTrilhos',
        organizer: 'ANPTrilhos',
        category: 'ferrovia',
        location: 'Brasília (DF)',
        url: 'https://anptrilhos.org.br',
        comment: 'Encontro do transporte de passageiros sobre trilhos com governo, operadoras e especialistas.',
        lastEdition: 'ago 2026',
        usualMonth: 8
    },
    {
        id: 'brasil-nos-trilhos',
        name: 'Brasil nos Trilhos',
        organizer: 'ANTF',
        category: 'ferrovia',
        location: 'Brasília (DF)',
        url: 'https://www.antf.org.br',
        comment: 'Evento das concessionárias de carga ferroviária: investimentos e expansão da malha.',
        lastEdition: '10ª edição, 2026'
    },
    {
        id: 'web-summit-rio',
        name: 'Web Summit Rio',
        organizer: 'Web Summit',
        category: 'tecnologia',
        location: 'Rio de Janeiro (RJ) · Riocentro',
        url: 'https://rio.websummit.com',
        comment: 'Tecnologia, startups e inovação; útil para IA, dados e transformação digital.',
        start: '2027-06-14',
        end: '2027-06-17',
        dateSource: 'oficial'
    },
    {
        id: 'universo-totvs',
        name: 'Universo TOTVS',
        organizer: 'TOTVS',
        category: 'tecnologia',
        location: 'São Paulo (SP)',
        url: 'https://universo.totvs.com',
        comment: 'Evento da TOTVS, nosso ERP: novidades do RM, folha, gestão e IA aplicada aos negócios.',
        lastEdition: '13–14 out 2026'
    },
    {
        id: 'febraban-tech',
        name: 'Febraban Tech',
        organizer: 'Febraban',
        category: 'tecnologia',
        location: 'São Paulo (SP) · Distrito Anhembi',
        url: 'https://febrabantech.febraban.org.br',
        comment: 'Tecnologia no setor financeiro: pagamentos, crédito, segurança e IA.',
        lastEdition: '24–26 ago 2026'
    },
    {
        id: 'lean-summit',
        name: 'Lean Summit',
        organizer: 'Lean Institute Brasil',
        category: 'gestao',
        location: 'São Paulo (SP)',
        url: 'https://www.lean.org.br',
        comment: 'Bienal de gestão lean: produtividade, melhoria contínua e redução de desperdícios.',
        lastEdition: '26–27 ago 2025 (edição 2027 anunciada)',
        usualMonth: 8
    },
    {
        id: 'conarh',
        name: 'CONARH',
        organizer: 'ABRH Brasil',
        category: 'gestao',
        location: 'São Paulo (SP) · São Paulo Expo',
        url: 'https://www.conarh.org.br',
        comment: 'Maior congresso de gestão de pessoas do país: tendências de RH, benefícios e cultura.',
        start: '2027-08-10',
        end: '2027-08-12',
        dateSource: 'oficial'
    },
    {
        id: 'cbc',
        name: 'Congresso Brasileiro de Contabilidade',
        organizer: 'CFC',
        category: 'gestao',
        location: 'Cidade a definir',
        url: 'https://cfc.org.br',
        comment: 'Principal congresso da contabilidade no país: normas, tributário e gestão.',
        lastEdition: '21º, set 2024 em Balneário Camboriú (SC)'
    },
    {
        id: 'agrishow',
        name: 'Agrishow',
        organizer: 'Informa Markets',
        category: 'agro',
        location: 'Ribeirão Preto (SP)',
        url: 'https://www.agrishow.com.br',
        comment: 'Maior feira do agronegócio do país: máquinas, tecnologia e infraestrutura rural.',
        start: '2027-04-26',
        end: '2027-04-30',
        dateSource: 'oficial'
    }
];

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const parts = (iso: string) => {
    const [year, month, day] = iso.split('-').map(Number);
    return { year, month, day };
};

/** "06–09 abr 2027", "30 jun – 02 jul 2027" ou "28 dez 2026 – 02 jan 2027". */
export const formatEventDates = (start: string, end = start): string => {
    const s = parts(start);
    const e = parts(end);
    const pad = (n: number) => String(n).padStart(2, '0');
    if (start === end) return `${pad(s.day)} ${MONTHS[s.month - 1]} ${s.year}`;
    if (s.year !== e.year) return `${pad(s.day)} ${MONTHS[s.month - 1]} ${s.year} – ${pad(e.day)} ${MONTHS[e.month - 1]} ${e.year}`;
    if (s.month !== e.month) return `${pad(s.day)} ${MONTHS[s.month - 1]} – ${pad(e.day)} ${MONTHS[e.month - 1]} ${e.year}`;
    return `${pad(s.day)}–${pad(e.day)} ${MONTHS[s.month - 1]} ${s.year}`;
};

/** Data divulgada e ainda não encerrada (comparação por AAAA-MM-DD). */
export const hasUpcomingDate = (event: SectorEvent, todayIso: string): boolean =>
    !!event.start && (event.end || event.start) >= todayIso;

/**
 * Bloco de calendário da agenda: mês e dia da próxima edição; sem data divulgada, o mês
 * habitual (ou "—") marcado como provisório.
 */
export const calendarBadge = (event: SectorEvent, todayIso: string): { month: string; day: string; tentative: boolean } => {
    if (hasUpcomingDate(event, todayIso)) {
        const { month, day } = parts(event.start!);
        return { month: MONTHS[month - 1], day: String(day).padStart(2, '0'), tentative: event.dateSource !== 'oficial' };
    }
    return { month: event.usualMonth ? MONTHS[event.usualMonth - 1] : '—', day: '—', tentative: true };
};

/** Meses até o mês habitual do evento (0 = mês atual); sem mês habitual vai para o fim. */
const monthsUntil = (usualMonth: number | undefined, todayMonth: number): number =>
    usualMonth ? (usualMonth - todayMonth + 12) % 12 : 12;

/**
 * Ordem da agenda: primeiro os eventos com data divulgada, do mais próximo ao mais distante;
 * depois os sem data, pelo mês habitual mais próximo; por fim, ordem alfabética.
 */
export const sortSectorEvents = (events: SectorEvent[], todayIso: string): SectorEvent[] => {
    const todayMonth = parts(todayIso).month;
    return [...events].sort((a, b) => {
        const aDated = hasUpcomingDate(a, todayIso);
        const bDated = hasUpcomingDate(b, todayIso);
        if (aDated !== bDated) return aDated ? -1 : 1;
        if (aDated && bDated) return a.start!.localeCompare(b.start!);
        const byMonth = monthsUntil(a.usualMonth, todayMonth) - monthsUntil(b.usualMonth, todayMonth);
        return byMonth || a.name.localeCompare(b.name, 'pt-BR');
    });
};

/** Data local de hoje em AAAA-MM-DD. */
export const toLocalIsoDate = (date: Date): string =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
