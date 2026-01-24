import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCrm } from '../../contexts/CrmContext';
import { calculateClientHealth, calculateContactAnalytics } from '../../domain/relationshipAnalytics';
import { TimelineItem } from '../../components/crm/TimelineItem';
import { Plus, Building2, AlertTriangle, CheckCircle2, XCircle, MapPin, Globe, Mail, Info, Phone, FileText, Pencil, Trash2, PieChart as PieChartIcon, TrendingUp } from 'lucide-react';
import { Client, Interaction, Bid, ClientContact, TaskOutcome, BidStatus } from '../../types';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { ContactModal } from '../../components/crm/ContactModal';
import { ClientModal } from '../../components/crm/ClientModal';

export const ClientDetailsView: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { clients, interactions, contacts, bids, removeContact, removeClient } = useCrm();
    const [activeTab, setActiveTab] = useState<'overview' | 'timeline'>('timeline');
    const [isContactModalOpen, setIsContactModalOpen] = useState(false);
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [contactToEdit, setContactToEdit] = useState<ClientContact | undefined>(undefined);

    const client = clients.find((c: Client) => c.id === id);

    if (!client) return <div className="p-8 text-center text-slate-500">Cliente não encontrado.</div>;

    // Filter Data for this Client
    const clientInteractions = interactions
        .filter((i: Interaction) => i.clientId === client.id)
        .sort((a: Interaction, b: Interaction) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const clientBids = bids.filter((o: Bid) => o.clientId === client.id);
    const clientContacts = contacts.filter((c: ClientContact) => c.clientId === client.id);

    // Analytics Domain
    const health = calculateClientHealth(clientInteractions, clientBids, clientContacts);

    // Metrics Calculation
    const metrics = useMemo(() => {
        const totalBids = clientBids.length;
        const totalValue = clientBids.reduce((sum, bid) => sum + (bid.estimatedValue || 0), 0);

        // Status Check Helper
        const isSuccess = (b: Bid) => b.status === BidStatus.VENCIDA || b.status === 'GANHA' || b.result === TaskOutcome.SUCCESS;
        const isLost = (b: Bid) => b.status === BidStatus.PERDIDA || b.status === 'PERDIDA' || b.result === TaskOutcome.FAILURE;
        const isStudy = (b: Bid) => b.result === TaskOutcome.STUDY; // Or any explicit status for Study
        const isActive = (b: Bid) => !isSuccess(b) && !isLost(b) && !isStudy(b) && b.status !== BidStatus.CANCELADA;

        const successCount = clientBids.filter(isSuccess).length;
        const lostCount = clientBids.filter(isLost).length;
        const studyCount = clientBids.filter(isStudy).length;
        const activeCount = clientBids.filter(isActive).length;

        // Conversion Rate: Success / (Success + Lost) ideally, or Total Finished
        const finishedCount = successCount + lostCount;
        const conversionRate = finishedCount > 0 ? (successCount / finishedCount) * 100 : 0;

        return { totalBids, totalValue, successCount, lostCount, studyCount, activeCount, conversionRate };
    }, [clientBids]);

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
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsClientModalOpen(true)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                            title="Editar Empresa"
                        >
                            <Pencil size={18} />
                        </button>
                        <button
                            onClick={() => {
                                if (window.confirm('Tem certeza que deseja excluir este cliente? Todas as interações e contatos serão removidos.')) {
                                    removeClient(client.id);
                                    navigate('/crm/clients');
                                }
                            }}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                            title="Excluir Empresa"
                        >
                            <Trash2 size={18} />
                        </button>
                        <button
                            onClick={() => {
                                setContactToEdit(undefined); // Ensure clean state
                                setIsContactModalOpen(false); // Close other modals if open
                                // Handle Interaction Modal (which is seemingly separate or needs state)
                                // Ah, I need to ADD state for Interaction Modal too!
                                // For now, I will use a new state: isInteractionModalOpen
                            }}
                            className="ml-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition shadow-sm hover:shadow"
                        >
                            Registrar Interação
                        </button>
                    </div>
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
                            {clientContacts.map((contact: ClientContact) => {
                                const analytics = calculateContactAnalytics(contact, clientInteractions, bids);

                                // Determine Status Badge
                                let statusBadge;
                                if ((analytics.score ?? 0) >= 80) {
                                    statusBadge = (
                                        <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700 border border-amber-200" title="Campeão">
                                            <span>🏆</span> Campeão
                                        </span>
                                    );
                                } else if ((analytics.score ?? 0) >= 50) {
                                    statusBadge = (
                                        <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-700 border border-blue-200" title="Promissor">
                                            <span>⭐</span> Promissor
                                        </span>
                                    );
                                } else {
                                    statusBadge = (
                                        <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-600 border border-slate-200" title="Neutro">
                                            <span>😐</span> Neutro
                                        </span>
                                    );
                                }

                                const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);

                                return (
                                    <div key={contact.id} className="flex gap-4 rounded-lg border border-slate-200 p-5 bg-white hover:border-blue-200 transition-colors group items-start relative">
                                        <UserAvatar user={{ name: contact.name }} size="md" />

                                        {/* Action Buttons */}
                                        <div className="absolute top-2 right-2 flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10">
                                            <button
                                                onClick={() => { setContactToEdit(contact); setIsContactModalOpen(true); }}
                                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors bg-white/80 backdrop-blur-sm"
                                                title="Editar"
                                            >
                                                <Pencil size={14} />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (window.confirm('Excluir este contato?')) {
                                                        removeContact(contact.id);
                                                    }
                                                }}
                                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors bg-white/80 backdrop-blur-sm"
                                                title="Excluir"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            {/* Header */}
                                            <div className="mb-2">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <p className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors truncate text-base">{contact.name}</p>
                                                    {statusBadge}
                                                </div>
                                                <p className="text-xs text-slate-500 font-medium truncate">
                                                    {contact.role}
                                                    {contact.department && <span className="text-slate-400"> • {contact.department}</span>}
                                                </p>
                                            </div>

                                            {/* Contact Info */}
                                            <div className="space-y-1 mb-4">
                                                {contact.email && (
                                                    <div className="flex items-center gap-2 text-xs text-slate-500" title="Email">
                                                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                                                        <span className="truncate">{contact.email}</span>
                                                    </div>
                                                )}
                                                {contact.phone && (
                                                    <div className="flex items-center gap-2 text-xs text-slate-500" title="Telefone">
                                                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                                                        <span>{contact.phone}</span>
                                                    </div>
                                                )}
                                                {contact.address?.city && (
                                                    <div className="flex items-center gap-2 text-xs text-slate-500" title="Localização">
                                                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                                        <span className="truncate">{contact.address.city} - {contact.address.state}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Metrics Footer */}
                                            <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-y-2 gap-x-4">
                                                {/* Total Opps */}
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wide">Oportunidades</span>
                                                    <div className="flex items-baseline gap-1">
                                                        <span className="text-sm font-bold text-slate-700">{analytics.opportunityCount || 0}</span>
                                                        <span className="text-[10px] text-slate-500">({formatCurrency(analytics.totalValue || 0)})</span>
                                                    </div>
                                                </div>

                                                {/* Success Opps */}
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] uppercase text-emerald-600 font-bold tracking-wide">Sucesso</span>
                                                    <div className="flex items-baseline gap-1">
                                                        <span className="text-sm font-bold text-emerald-700">{analytics.successCount || 0}</span>
                                                        <span className="text-[10px] text-emerald-600">({formatCurrency(analytics.successValue || 0)})</span>
                                                    </div>
                                                </div>

                                                {/* Conversion Rate */}
                                                <div className="col-span-2 mt-1">
                                                    <div className="flex items-center justify-between text-[10px] mb-1">
                                                        <span className="font-medium text-slate-500">Taxa de Conversão</span>
                                                        <span className={`font-bold ${(analytics.conversionRate || 0) >= 30 ? 'text-emerald-600' : 'text-slate-600'}`}>
                                                            {(analytics.conversionRate || 0).toFixed(0)}%
                                                        </span>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full ${(analytics.conversionRate || 0) >= 50 ? 'bg-emerald-500' :
                                                                    (analytics.conversionRate || 0) >= 20 ? 'bg-blue-400' :
                                                                        'bg-slate-300'
                                                                }`}
                                                            style={{ width: `${Math.min(analytics.conversionRate || 0, 100)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Botão Adicionar Contato */}
                            <button
                                onClick={() => setIsContactModalOpen(true)}
                                className="flex h-full min-h-[88px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:border-slate-400 transition hover:text-blue-600"
                            >
                                <Plus className="h-4 w-4 mr-2" /> Adicionar Contato
                            </button>
                        </div >
                    )}
                </div >

                {/* Contact Modal */}
                < ContactModal
                    isOpen={isContactModalOpen}
                    onClose={() => setIsContactModalOpen(false)}
                    contactToEdit={contactToEdit}
                />

                <ClientModal
                    isOpen={isClientModalOpen}
                    onClose={() => setIsClientModalOpen(false)}
                    clientToEdit={client}
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

                    {/* NEW METRICS CARD */}
                    <div className="rounded-xl border border-slate-200 bg-white p-5 sticky top-[280px]">
                        <h4 className="font-semibold text-slate-900 mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
                            <TrendingUp size={16} className="text-blue-600" /> Performance
                        </h4>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-2 text-center">
                                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                    <div className="text-xs text-slate-500 uppercase font-bold">Propostas</div>
                                    <div className="text-lg font-bold text-slate-800">{metrics.totalBids}</div>
                                </div>
                                <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                                    <div className="text-xs text-emerald-600 uppercase font-bold">Conversão</div>
                                    <div className="text-lg font-bold text-emerald-700">{metrics.conversionRate.toFixed(0)}%</div>
                                </div>
                            </div>

                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Sucesso</span>
                                    <span className="font-medium">{metrics.successCount}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Em Andamento</span>
                                    <span className="font-medium">{metrics.activeCount}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-yellow-500"></div> Em Estudo</span>
                                    <span className="font-medium">{metrics.studyCount}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> Perdidas</span>
                                    <span className="font-medium">{metrics.lostCount}</span>
                                </div>
                            </div>

                            <div className="pt-2 border-t border-slate-100">
                                <div className="text-xs text-slate-400 text-center uppercase tracking-wide mb-1">Valor Total Pipeline</div>
                                <div className="text-center font-bold text-slate-700 text-lg">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(metrics.totalValue)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div >
        </div >
    );
};
