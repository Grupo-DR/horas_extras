/**
 * Peças visuais do RDO Online no padrão da tela inicial do portal:
 * fundo claro, cartões brancos com borda fina, azul-marinho da marca e tabelas compactas.
 */
import React from 'react';
import { Search } from 'lucide-react';

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
      'whitespace-nowrap border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500',
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
      'border-b border-slate-100 px-4 py-3 align-middle text-slate-700',
      align === 'right' && 'text-right tabular-nums',
      align === 'center' && 'text-center tabular-nums',
      className
    )}
    {...props}
  />
);

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
