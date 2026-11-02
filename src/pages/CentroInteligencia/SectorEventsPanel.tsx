import React, { useMemo, useState } from 'react';
import { ArrowUpRight, MapPin } from 'lucide-react';
import {
    EVENT_CATEGORY_LABELS,
    EventCategory,
    SECTOR_EVENTS,
    SectorEvent,
    calendarBadge,
    formatEventDates,
    hasUpcomingDate,
    sortSectorEvents
} from './sectorEvents';
import { toLocalIsoDate } from '../../../utils/dateUtils';

const CATEGORY_DOT: Record<EventCategory, string> = {
    construcao: 'bg-amber-500',
    ferrovia: 'bg-sky-500',
    tecnologia: 'bg-violet-500',
    gestao: 'bg-emerald-500',
    agro: 'bg-lime-600'
};

const CalendarBlock: React.FC<{ event: SectorEvent; today: string }> = ({ event, today }) => {
    const { month, day, tentative } = calendarBadge(event, today);
    return (
        <div
            className={`flex w-14 shrink-0 flex-col overflow-hidden rounded-xl border text-center ${tentative ? 'border-dashed border-slate-300' : 'border-slate-200'}`}
            aria-hidden="true"
        >
            <span className={`py-0.5 text-[10px] font-bold uppercase tracking-wider ${tentative ? 'bg-slate-100 text-slate-500' : 'bg-[#0b1d4f] text-white'}`}>
                {month}
            </span>
            <span className={`py-1.5 text-lg font-bold leading-none ${tentative ? 'text-slate-400' : 'text-slate-900'}`}>{day}</span>
        </div>
    );
};

const EventRow: React.FC<{ event: SectorEvent; today: string }> = ({ event, today }) => {
    const upcoming = hasUpcomingDate(event, today);
    const when = upcoming && event.start
        ? `${formatEventDates(event.start, event.end)}${event.dateSource !== 'oficial' ? ' · a confirmar' : ''}`
        : `Data a confirmar${event.lastEdition ? ` · última: ${event.lastEdition}` : ''}`;

    return (
        <li>
            <a
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex gap-3.5 rounded-2xl p-3 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
            >
                <CalendarBlock event={event} today={today} />
                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                            {event.image && <img src={event.image} alt="" className="h-5 w-5 shrink-0 rounded object-contain" />}
                            <h3 className="truncate text-sm font-semibold text-slate-900 group-hover:text-[#0b1d4f]">{event.name}</h3>
                        </div>
                        <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-blue-600" aria-hidden="true" />
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500">
                        <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle ${CATEGORY_DOT[event.category]}`} />
                        {[event.organizer, when].filter(Boolean).join(' · ')}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600">{event.comment}</p>
                    <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-slate-400">
                        <MapPin className="h-3 w-3 shrink-0" /> {event.location}
                    </p>
                </div>
            </a>
        </li>
    );
};

/** Agenda de eventos do setor (dados em sectorEvents.ts). Rola por dentro para caber na tela. */
export const SectorEventsPanel: React.FC<{ className?: string }> = ({ className = '' }) => {
    const [category, setCategory] = useState<EventCategory | 'all'>('all');
    const today = toLocalIsoDate(new Date());

    const events = useMemo(
        () => sortSectorEvents(SECTOR_EVENTS, today).filter(e => category === 'all' || e.category === category),
        [category, today]
    );
    const upcomingCount = useMemo(() => SECTOR_EVENTS.filter(e => hasUpcomingDate(e, today)).length, [today]);

    const categories = Object.keys(EVENT_CATEGORY_LABELS) as EventCategory[];
    const chip = (active: boolean) =>
        `shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold transition ${active ? 'bg-[#0b1d4f] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`;

    return (
        <section className={`flex min-h-0 flex-col rounded-3xl border border-slate-200 bg-white ${className}`} aria-labelledby="agenda-setor">
            <header className="border-b border-slate-100 px-5 pb-3 pt-5">
                <div className="flex items-baseline justify-between">
                    <h2 id="agenda-setor" className="text-base font-bold text-slate-900">Agenda do setor</h2>
                    <span className="text-[11px] font-medium text-slate-400">{upcomingCount} com data divulgada</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">Eventos para a equipe participar ao longo do ano.</p>
                <div className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Filtrar por categoria">
                    <button type="button" className={chip(category === 'all')} onClick={() => setCategory('all')}>Todos</button>
                    {categories.map(c => (
                        <button key={c} type="button" className={chip(category === c)} onClick={() => setCategory(c)}>
                            {EVENT_CATEGORY_LABELS[c]}
                        </button>
                    ))}
                </div>
            </header>

            <ul className="min-h-0 flex-1 overflow-y-auto p-2">
                {events.map(event => <EventRow key={event.id} event={event} today={today} />)}
            </ul>
        </section>
    );
};
