import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCrm } from '../../contexts/CrmContext';
import { getClientHealth } from '../../src/lib/crm-analytics';
import { Building2, ArrowLeft, Mail, Phone, Users, Plus, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { TimelineItem } from '../../components/crm/TimelineItem';
import { ContactModal } from '../../components/crm/ContactModal';
// import { InteractionModal } from '../../components/crm/InteractionModal'; // Future
// import { UserAvatar } from '../../components/ui/UserAvatar'; // Can be used for contacts

export const ClientDetailsView: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { clients, contacts, interactions, removeContact } = useCrm();
    const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'TIMELINE'>('TIMELINE');
    const [showContactModal, setShowContactModal] = useState(false);
    // const [showInteractionModal, setShowInteractionModal] = useState(false);

    const client = clients.find(c => c.id === id);

    // Derived Data
    const clientContacts = contacts.filter(c => c.clientId === id);
    const clientInteractions = interactions
        .filter(i => i.clientId === id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const health = useMemo(() => {
        if (!client) return null;
        return getClientHealth(client, interactions, []);
    }, [client, interactions]);

    if (!client) {
        return <div className="p-10 text-center">Empresa não encontrada.</div>;
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* TOP BAR / HEADER */}
            <div className="bg-white border-b border-slate-200">
                <div className="max-w-5xl mx-auto px-6 py-6">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-1 text-slate-400 hover:text-slate-600 text-sm font-medium mb-4 transition-colors"
                    >
                        <ArrowLeft size={16} /> Voltar para Dashboard
                    </button>

                    <div className="flex justify-between items-start">
                        <div className="flex items-start gap-4">
                            <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                                <Building2 size={32} />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-800">{client.tradeName}</h1>
                                <p className="text-slate-500">{client.corporateName}</p>
                                <div className="flex items-center gap-3 mt-2">
                                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                                        {client.segment || 'Geral'}
                                    </span>
                                    <span className="text-xs text-slate-400">CNPJ: {client.cnpj}</span>
                                </div>
                            </div>
                        </div>

                        {/* Health Status Badge */}
                        {health && (
                            <div className={`px-4 py-2 rounded-lg border flex flex-col items-end ${health.status === 'RISCO' ? 'bg-red-50 border-red-100 text-red-700' :
                                    health.status === 'ATENÇÃO' ? 'bg-orange-50 border-orange-100 text-orange-700' :
                                        'bg-emerald-50 border-emerald-100 text-emerald-700'
                                }`}>
                                <div className="flex items-center gap-2 font-bold text-sm">
                                    {health.status === 'RISCO' && <AlertTriangle size={16} />}
                                    {health.status === 'ATENÇÃO' && <Clock size={16} />}
                                    {health.status === 'ATIVO' && <CheckCircle size={16} />}
                                    {health.status}
                                </div>
                                <span className="text-xs opacity-80">{health.daysSilence} dias sem contato</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* TABS */}
                <div className="max-w-5xl mx-auto px-6 flex gap-6 mt-4">
                    <button
                        onClick={() => setActiveTab('TIMELINE')}
                        className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'TIMELINE'
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        Timeline & Histórico
                    </button>
                    <button
                        onClick={() => setActiveTab('OVERVIEW')}
                        className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'OVERVIEW'
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        Pessoas de Contato <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full ml-1 text-slate-500">{clientContacts.length}</span>
                    </button>
                </div>
            </div>

            {/* CONTENT AREA */}
            <div className="max-w-5xl mx-auto px-6 py-8">

                {/* TAB 1: OVERVIEW / CONTACTS */}
                {activeTab === 'OVERVIEW' && (
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-slate-700">Pessoas Chave</h3>
                            <button
                                onClick={() => setShowContactModal(true)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm transition-colors"
                            >
                                <Plus size={16} /> Novo Contato
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {clientContacts.map(contact => (
                                <div key={contact.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-blue-200 transition-all group">
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold">
                                            {contact.name.charAt(0)}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 text-sm">{contact.name}</h4>
                                            <p className="text-xs text-blue-600 font-medium">{contact.role}</p>
                                        </div>
                                    </div>
                                    <div className="mt-4 space-y-2 text-sm text-slate-500">
                                        <div className="flex items-center gap-2">
                                            <Mail size={14} />
                                            <span className="truncate">{contact.email}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Phone size={14} />
                                            <span className="truncate">{contact.phone}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {clientContacts.length === 0 && (
                                <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
                                    Sem contatos cadastrados.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB 2: TIMELINE */}
                {activeTab === 'TIMELINE' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-bold text-slate-700">Linha do Tempo</h3>
                                <button
                                    // onClick={() => setShowInteractionModal(true)} 
                                    className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-colors"
                                >
                                    <Plus size={16} /> Registrar Interação
                                </button>
                            </div>

                            <div className="space-y-0">
                                {clientInteractions.map(interaction => (
                                    <TimelineItem key={interaction.id} interaction={interaction} />
                                ))}
                                {clientInteractions.length === 0 && (
                                    <div className="py-12 text-center text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
                                        Nenhuma interação registrada.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* SIDEBAR RIGHT: INFO OR STATS */}
                        <div>
                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm sticky top-6">
                                <h4 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-wide">Resumo de Engajamento</h4>
                                <div className="space-y-4">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Total Interações</span>
                                        <span className="font-bold text-slate-800">{clientInteractions.length}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Última</span>
                                        <span className="font-bold text-slate-800">
                                            {health?.daysSilence === 999 ? 'N/A' : `${health?.daysSilence} dias atrás`}
                                        </span>
                                    </div>
                                    <div className="h-px bg-slate-100 my-2" />
                                    {/* Placeholder for future specific stats */}
                                    <p className="text-xs text-slate-400 italic">
                                        Métricas de engajamento em desenvolvimento.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </div>

            {/* Modals */}
            <ContactModal isOpen={showContactModal} onClose={() => setShowContactModal(false)} />
            {/* InteractionModal Component Coming Soon */}

        </div>
    );
};
