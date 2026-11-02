import React, { useMemo, useState } from 'react';
import { ArrowUpRight, CalendarDays, Cpu, HardHat, MapPin, Sprout, TrainFront, Users } from 'lucide-react';
import {
    EVENT_CATEGORY_LABELS,
    EventCategory,
    SECTOR_EVENTS,
    SectorEvent,
    formatEventDates,
    hasUpcomingDate,
    sortSectorEvents,
    toLocalIsoDate
} from './sectorEvents';

const CATEGORY_STYLE: Record<EventCategory, { icon: React.ElementType; tile: string }> = {
    construcao: { icon: HardHat, tile: 'bg-amber-100 text-amber-700' },
    ferrovia: { icon: TrainFront, tile: 'bg-sky-100 text-sky-700' },
    tecnologia: { icon: Cpu, tile: 'bg-violet-100 text-violet-700' },
    gestao: { icon: Users, tile: 'bg-emerald-100 text-emerald-700' },
    agro: { icon: Sprout, tile: 'bg-lime-100 text-lime-700' }
};

const EventThumb: React.FC<{ event: SectorEvent }> = ({ event }) => {
    if (event.image) {
        return <img src={event.image} alt="" className="h-12 w-12 shrink-0 rounded-xl border border-slate-100 object-cover" />;
    }
    const { icon: Icon, tile } = CATEGORY_STYLE[event.category];
    return (
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tile}`} aria-hidden="true">
            <Icon className="h-5 w-5" />
        </div>
    );
};

const EventDate: React.FC<{ event: SectorEvent; upcoming: boolean }> = ({ event, upcoming }) => {
    if (upcoming && event.start) {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                <CalendarDays className="h-3 w-3" />
                {formatEventDates(event.start, event.end)}
                {event.dateSource !== 'oficial' && <span className="font-normal text-blue-500">· a confirmar</span>}
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">
            <CalendarDays className="h-3 w-3" />
            Próxima edição a confirmar
        </span>
    );
};

/** Agenda de eventos do setor (dados em sectorEvents.ts). */
export const SectorEventsPanel: React.FC = () => {
    const [category, setCategory] = useState<EventCategory | 'all'>('all');
    const today = toLocalIsoDate(new Date());

    const events = useMemo(
        () => sortSectorEvents(SECTOR_EVENTS, today).filter(e => category === 'all' || e.category === category),
        [category, today]
    );

    const categories = Object.keys(EVENT_CATEGORY_LABELS) as EventCategory[];
    const chip = (active: boolean) =>
        `rounded-full px-3 py-1.5 text-xs font-semibold transition ${active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`;

    return (
        <section className="flex h-full flex-col rounded-3xl border border-slate-200/70 bg-white/80 shadow-sm backdrop-blur" aria-labelledby="agenda-setor">
            <header className="border-b border-slate-100 p-6 pb-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-600">Agenda do setor</p>
                <h2 id="agenda-setor" className="mt-1 text-lg font-bold text-slate-900">Eventos para a equipe participar</h2>
                <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar por categoria">
                    <button type="button" className={chip(category === 'all')} onClick={() => setCategory('all')}>Todos</button>
                    {categories.map(c => (
                        <button key={c} type="button" className={chip(category === c)} onClick={() => setCategory(c)}>
                            {EVENT_CATEGORY_LABELS[c]}
                        </button>
                    ))}
                </div>
            </header>

            <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto px-3 py-2 xl:max-h-[640px]">
                {events.map(event => {
                    const upcoming = hasUpcomingDate(event, today);
                    return (
                        <li key={event.id} className="group flex gap-4 rounded-2xl px-3 py-4 transition hover:bg-slate-50">
                            <EventThumb event={event} />
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                    <h3 className="font-semibold text-slate-900">{event.name}</h3>
                                    {event.organizer && <span className="text-xs text-slate-400">{event.organizer}</span>}
                                </div>
                                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                    <EventDate event={event} upcoming={upcoming} />
                                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                                        <MapPin className="h-3 w-3" /> {event.location}
                                    </span>
                                </div>
                                <p className="mt-2 text-sm leading-relaxed text-slate-600">{event.comment}</p>
                                {!upcoming && event.lastEdition && (
                                    <p className="mt-1 text-[11px] text-slate-400">Última edição: {event.lastEdition}</p>
                                )}
                                <a
                                    href={event.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800"
                                >
                                    Acessar site <ArrowUpRight className="h-3.5 w-3.5" />
                                </a>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
};
