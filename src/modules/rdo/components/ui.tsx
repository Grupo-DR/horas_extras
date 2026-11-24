/**
 * Peças visuais do RDO Online no padrão da tela inicial do portal:
 * fundo claro, cartões brancos com borda fina, azul-marinho da marca e tabelas compactas.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, MoreHorizontal, Search } from 'lucide-react';

const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');

// ─── Cabeçalho de página ─────────────────────────────────────────────────────

export const PageHeader: React.FC<{
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ title, subtitle, actions }) => (
  <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0">
      <h2 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

// ─── Botões ──────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-[#0b1d4f] text-white hover:bg-[#13296b] border border-[#0b1d4f]',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:border-slate-400 hover:bg-slate-50',
  ghost: 'text-slate-600 hover:bg-slate-100 border border-transparent',
};

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  icon?: React.ElementType;
}> = ({ variant = 'secondary', icon: Icon, className, children, type = 'button', ...props }) => (
  <button
    type={type}
    className={cx(
      'inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3.5 text-sm font-medium transition',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1d4f]/30 disabled:cursor-not-allowed disabled:opacity-50',
      BUTTON_VARIANTS[variant],
      className
    )}
    {...props}
  >
    {Icon && <Icon className="h-4 w-4" strokeWidth={1.75} />}
    {children}
  </button>
);

/** Botão só com ícone; o rótulo vira dica e texto para leitor de tela. */
export const IconButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: React.ElementType;
  label: string;
  tone?: 'default' | 'danger';
}> = ({ icon: Icon, label, tone = 'default', className, onClick, ...props }) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    onClick={(e) => {
      e.stopPropagation(); // ações dentro de linha clicável não abrem a linha
      onClick?.(e);
    }}
    className={cx(
      'inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1d4f]/30',
      tone === 'danger' ? 'hover:bg-rose-50 hover:text-rose-600' : 'hover:bg-slate-100 hover:text-slate-700',
      className
    )}
    {...props}
  >
    <Icon className="h-4 w-4" strokeWidth={1.75} />
  </button>
);

// ─── Busca e filtros ─────────────────────────────────────────────────────────

export const SearchInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}> = ({ value, onChange, placeholder }) => (
  <label className="relative block w-full sm:w-72">
    <span className="sr-only">{placeholder}</span>
    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0b1d4f] focus:outline-none focus:ring-2 focus:ring-[#0b1d4f]/15"
    />
  </label>
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }> = ({ label, className, children, ...props }) => (
  <label className="block">
    <span className="sr-only">{label}</span>
    <select
      className={cx(
        'h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:border-[#0b1d4f] focus:outline-none focus:ring-2 focus:ring-[#0b1d4f]/15',
        className
      )}
      {...props}
    >
      {children}
    </select>
  </label>
);

// ─── Tabela ──────────────────────────────────────────────────────────────────

export const TableCard: React.FC<{ children: React.ReactNode; footer?: React.ReactNode }> = ({ children, footer }) => (
  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">{children}</table>
    </div>
    {footer && <div className="border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-500">{footer}</div>}
  </div>
);

export const Th: React.FC<React.ThHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' | 'center' }> = ({ align = 'left', className, ...props }) => (
  <th
    scope="col"
    className={cx(
      'whitespace-nowrap border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-500',
      align === 'right' && 'text-right',
      align === 'center' && 'text-center',
      className
    )}
    {...props}
  />
);

export const Td: React.FC<React.TdHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' | 'center' }> = ({ align = 'left', className, ...props }) => (
  <td
    className={cx(
      'border-b border-slate-100 px-4 py-2 align-middle text-[13px] text-slate-700',
      align === 'right' && 'text-right tabular-nums',
      align === 'center' && 'text-center tabular-nums',
      className
    )}
    {...props}
  />
);

export type SortDirection = 'asc' | 'desc';

/** Cabeçalho clicável que ordena a tabela; mostra a seta só na coluna ativa. */
export const SortableTh = <K extends string>({ label, sortKey, sort, onSort, align = 'left' }: {
  label: string;
  sortKey: K;
  sort: { key: K; dir: SortDirection };
  onSort: (key: K) => void;
  align?: 'left' | 'right' | 'center';
}) => {
  const active = sort.key === sortKey;
  const Arrow = sort.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <Th align={align} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cx(
          'inline-flex items-center gap-1 rounded transition hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1d4f]/30',
          active && 'text-slate-900'
        )}
      >
        {label}
        <Arrow className={cx('h-3 w-3', active ? 'opacity-100' : 'opacity-0')} aria-hidden="true" />
      </button>
    </Th>
  );
};

/** Alterna a ordenação: mesma coluna inverte o sentido; outra coluna começa no sentido indicado. */
export const useSort = <K extends string>(initial: { key: K; dir: SortDirection }) => {
  const [sort, setSort] = useState(initial);
  const onSort = (key: K, firstDir: SortDirection = 'asc') =>
    setSort(prev => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: firstDir }));
  return { sort, onSort };
};

/** Compara valores para ordenação; vazios sempre no fim. */
export const compareValues = (a: string | number | null | undefined, b: string | number | null | undefined, dir: SortDirection) => {
  const emptyA = a === null || a === undefined || a === '';
  const emptyB = b === null || b === undefined || b === '';
  if (emptyA || emptyB) return emptyA === emptyB ? 0 : emptyA ? 1 : -1;
  const result = typeof a === 'number' && typeof b === 'number'
    ? a - b
    : String(a).localeCompare(String(b), 'pt-BR', { numeric: true });
  return dir === 'asc' ? result : -result;
};

// ─── Menu de ações da linha ──────────────────────────────────────────────────

export interface RowAction {
  label: string;
  icon: React.ElementType;
  onSelect: (e: React.MouseEvent) => void;
  tone?: 'default' | 'danger';
}

const MENU_WIDTH = 176;
const MENU_ITEM_HEIGHT = 36;

/**
 * Menu "⋯" com as ações da linha. Abre em posição fixa na tela (a tabela tem rolagem e
 * cortaria um menu absoluto nas últimas linhas); fecha ao clicar fora, com Esc ou ao rolar.
 */
export const RowMenu: React.FC<{ label: string; actions: RowAction[] }> = ({ label, actions }) => {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const open = position !== null;

  const toggle = () => {
    if (open || !ref.current) return setPosition(null);
    const rect = ref.current.getBoundingClientRect();
    const height = actions.length * MENU_ITEM_HEIGHT + 8;
    const fitsBelow = rect.bottom + height + 8 < window.innerHeight;
    setPosition({
      top: fitsBelow ? rect.bottom + 4 : rect.top - height - 4,
      left: Math.max(8, rect.right - MENU_WIDTH),
    });
  };

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return;
      if (e.type === 'mousedown' && ref.current?.contains(e.target as Node)) return;
      setPosition(null);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <div ref={ref} className="inline-block text-left" onClick={e => e.stopPropagation()}>
      <IconButton icon={MoreHorizontal} label={label} aria-haspopup="menu" aria-expanded={open} onClick={toggle} />
      {position && (
        <div
          role="menu"
          style={{ top: position.top, left: position.left, width: MENU_WIDTH }}
          className="fixed z-40 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {actions.map(({ label: actionLabel, icon: Icon, onSelect, tone }) => (
            <button
              key={actionLabel}
              type="button"
              role="menuitem"
              onClick={e => { e.stopPropagation(); setPosition(null); onSelect(e); }}
              className={cx(
                'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition',
                tone === 'danger' ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-700 hover:bg-slate-50'
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
              {actionLabel}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/** Linha que abre o item: clique, Enter ou espaço. */
export const ClickableRow: React.FC<{ onOpen: () => void; label: string; children: React.ReactNode }> = ({ onOpen, label, children }) => (
  <tr
    tabIndex={0}
    aria-label={label}
    onClick={onOpen}
    onKeyDown={(e) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onOpen();
      }
    }}
    className="group cursor-pointer transition-colors hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
  >
    {children}
  </tr>
);

// ─── Etiquetas ───────────────────────────────────────────────────────────────

type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-600 ring-slate-200',
  info: 'bg-blue-50 text-blue-700 ring-blue-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
  danger: 'bg-rose-50 text-rose-700 ring-rose-200',
};

export const Badge: React.FC<{ tone?: BadgeTone; title?: string; children: React.ReactNode }> = ({ tone = 'neutral', title, children }) => (
  <span
    title={title}
    className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset', BADGE_TONES[tone])}
  >
    {children}
  </span>
);

// ─── Estado vazio ────────────────────────────────────────────────────────────

export const EmptyState: React.FC<{
  icon: React.ElementType;
  title: string;
  description: string;
  action?: React.ReactNode;
}> = ({ icon: Icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
    <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-400">
      <Icon className="h-5 w-5" strokeWidth={1.75} />
    </span>
    <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
    <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
    {action && <div className="mt-5">{action}</div>}
  </div>
);
