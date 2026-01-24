import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useCrm } from '../../contexts/CrmContext';
import { calculateClientHealth } from '../../domain/relationshipAnalytics';
import { TimelineItem } from '../../components/crm/TimelineItem';
import { Plus, Building2, AlertTriangle, CheckCircle2, XCircle, MapPin, Globe, Mail, Info } from 'lucide-react';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { ContactModal } from '../../components/crm/ContactModal';

export const ClientDetailsView: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    // @ts-ignore
    const { clients, interactions, contacts, bids, addInteraction } = useCrm();
    const [activeTab, setActiveTab] = useState<'overview' | 'timeline'>('timeline');
    const [isContactModalOpen, setIsContactModalOpen] = useState(false);

    const client = clients.find((c: any) => c.id === id);

    if (!client) return <div className="p-8 text-center text-slate-500">Cliente não encontrado.</div>;

    // Filter Data for this Client
    const clientInteractions = interactions
        .filter((i: any) => i.clientId === client.id)
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // @ts-ignore
    const clientBids = (bids || []).filter(o => o.clientId === client.id);
    const clientContacts = contacts.filter((c: any) => c.clientId === client.id);

    // Analytics Domain
    const health = calculateClientHealth(clientInteractions, clientBids, clientContacts);

    const getHealthBadge = () => {
        switch (health.status) {
            case 'EM_RISCO':
                return <span className="flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700"><AlertTriangle className="h-4 w-4" /> Risco ({health.silenceDays}d)</span>;
            case 'PERDIDA':
                return <span className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700"><XCircle className="h-4 w-4" /> Perdida ({health.silenceDays}d)</span>;
            case 'ATENCAO':
                return <span className="flex items-center gap-1 rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-800"><AlertTriangle className="h-4 w-4" /> Atenção ({health.silenceDays}d)</span>;
            default:
                return <span className="flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700"><CheckCircle2 className="h-4 w-4" /> Ativa</span>;
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">

            {/* HEADER DO CLIENTE */}
            <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-slate-100 border border-slate-200">
                        <Building2 className="h-8 w-8 text-slate-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">{client.tradeName || client.corporateName}</h1>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 mt-2">
                            <span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wide text-slate-600">
                                {client.segment || 'Geral'}
                            </span>

                            <div className="flex items-center gap-1.5" title="CNPJ">
                                <Building2 className="w-4 h-4 text-slate-400" />
                                <span>{client.cnpj}</span>
                            </div>

                            {client.address?.city && (
                                <div className="flex items-center gap-1.5" title="Localização">
                                    <MapPin className="w-4 h-4 text-slate-400" />
                                    <span>{client.address.city} - {client.address.state}</span>
                                </div>
                            )}

                            {client.primaryEmail && (
                                <div className="flex items-center gap-1.5" title="Email Principal">
                                    <Mail className="w-4 h-4 text-slate-400" />
                                    <span>{client.primaryEmail}</span>
                                </div>
                            )}

                            {client.website && (
                                <div className="flex items-center gap-1.5" title="Website">
                                    <Globe className="w-4 h-4 text-slate-400" />
                                    <a href={client.website} target="_blank" rel="noreferrer" className="hover:text-blue-600 hover:underline">
                                        Website
                                    </a>
                                </div>
                            )}
                        </div>

                        {(client.clientType || client.origin) && (
                            <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                                {client.clientType && <span>Tipo: <strong className="text-slate-600">{client.clientType}</strong></span>}
                                {client.origin && <span>Origem: <strong className="text-slate-600">{client.origin.replace('_', ' ')}</strong></span>}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex flex-col items-end gap-3">
                    {getHealthBadge()}
                    <button
                        // TODO: Integrar modal de nova interação aqui
                        onClick={() => console.log('Abrir modal interação')}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition shadow-sm hover:shadow"
                    >
                        Registrar Interação
                    </button>
                </div>
            </div>

            {/* ÁREA DE CONTEÚDO */}
            <div className="flex gap-6 flex-col lg:flex-row">

                {/* COLUNA PRINCIPAL */}
                <div className="flex-1 space-y-6">
                    {/* Navegação de Abas */}
                    <div className="border-b border-slate-200">
                        <nav className="-mb-px flex gap-6">
                            <button
                                onClick={() => setActiveTab('timeline')}
                                className={`pb-4 text-sm font-medium transition border-b-2 ${activeTab === 'timeline' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
                            >
                                Histórico de Relacionamento
                            </button>
                            <button
                                onClick={() => setActiveTab('overview')}
                                className={`pb-4 text-sm font-medium transition border-b-2 ${activeTab === 'overview' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
                            >
                                Pessoas de Contato ({clientContacts.length})
                            </button>
                        </nav>
                    </div>

                    {activeTab === 'timeline' && (
                        <div className="bg-white rounded-xl border border-slate-200 p-6 min-h-[400px]">
                            {clientInteractions.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-slate-400 text-center">
                                    <div className="bg-slate-50 p-4 rounded-full mb-3">
                                        <CheckCircle2 className="h-8 w-8 text-slate-300" />
                                    </div>
                                    <p className="font-medium">Nenhuma interação registrada.</p>
                                    <p className="text-sm mt-1">Registre o primeiro contato para iniciar o histórico.</p>
                                </div>
                            ) : (
                                <div className="pl-2">
                                    {clientInteractions.map((interaction, idx) => (
                                        <TimelineItem
                                            key={interaction.id}
                                            interaction={interaction}
                                            isLast={idx === clientInteractions.length - 1}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'overview' && (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {clientContacts.map(contact => (
                                <div key={contact.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-4 bg-white hover:border-blue-200 transition-colors group">
                                    <UserAvatar user={{ name: contact.name }} size="md" />
                                    <div>
                                        <p className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">{contact.name}</p>
                                        <p className="text-xs text-slate-500 font-medium">{contact.role}</p>
                                        <p className="text-xs text-slate-400 mt-1">{contact.email}</p>
                                    </div>
                                </div>
                            ))}

                            {/* Botão Adicionar Contato */}
                            <button
                                onClick={() => setIsContactModalOpen(true)}
                                className="flex h-full min-h-[88px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:border-slate-400 transition hover:text-blue-600"
                            >
                                <Plus className="h-4 w-4 mr-2" /> Adicionar Contato
                            </button>
                        </div>
                    )}
                </div>

                {/* Contact Modal */}
                <ContactModal
                    isOpen={isContactModalOpen}
                    onClose={() => setIsContactModalOpen(false)}
                />

                {/* COLUNA LATERAL (KPIs Rápidos) */}
                <div className="w-full lg:w-80 shrink-0 space-y-6">
                    <div className="rounded-xl border border-slate-200 bg-white p-5 sticky top-6">
                        <h4 className="font-semibold text-slate-900 mb-4 border-b border-slate-100 pb-2">Saúde da Conta</h4>
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-slate-500">Score de Relacionamento</span>
                                    <span className="font-medium text-slate-900">{health.score}/100</span>
                                </div>
                                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                                    <div
                                        className={`h-2 rounded-full transition-all duration-500 ${health.score > 70 ? 'bg-green-500' : health.score > 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                        style={{ width: `${health.score}%` }}
                                    />
                                </div>
                            </div>

                            <div className="space-y-3 pt-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-500">Última Interação</span>
                                    <span className="font-medium text-slate-900">{health.silenceDays} dias atrás</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-500">Contatos Ativos</span>
                                    <span className="font-medium text-slate-900">{clientContacts.length}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-500">Oportunidades</span>
                                    <span className="font-medium text-slate-900">
                                        {/* @ts-ignore */}
                                        {bids ? bids.filter(o => o.clientId === client.id).length : 0}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
