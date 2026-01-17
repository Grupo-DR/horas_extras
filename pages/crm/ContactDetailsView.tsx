import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ClientContact, Interaction, Bid } from '../../types';
import { ClientContactService } from '../../services/clientContactService';
import { InteractionService } from '../../services/interactionService';
import { calculateContactAnalytics } from '../../domain/relationshipAnalytics';
import { InteractionTimeline } from '../../components/crm/InteractionTimeline';
import { InteractionFormModal } from '../../components/crm/InteractionFormModal';
import { ContactCard } from '../../components/crm/ContactCard';
import { ArrowLeft, User, Calendar, FileText, Plus } from 'lucide-react';

export const ContactDetailsView: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [contact, setContact] = useState<ClientContact | null>(null);
    const [interactions, setInteractions] = useState<Interaction[]>([]);
    const [activeTab, setActiveTab] = useState<'RESUMO' | 'INTERACOES'>('RESUMO');
    const [modalOpen, setModalOpen] = useState(false);

    useEffect(() => {
        if (!id) return;

        const unsubContact = ClientContactService.subscribeById(id, setContact);
        const unsubInteractions = InteractionService.subscribeByContact(id, setInteractions);

        return () => {
            unsubContact();
            unsubInteractions();
        };
    }, [id]);

    const enrichedContact = useMemo(() => {
        if (!contact) return null;
        const metrics = calculateContactAnalytics(contact, interactions);
        return { ...contact, analytics: metrics };
    }, [contact, interactions]);

    if (!enrichedContact) return <div className="p-8 text-center text-slate-500">Carregando contato...</div>;

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="bg-white border-b border-slate-200">
                <div className="p-6 max-w-5xl mx-auto">
                    <button
                        onClick={() => navigate('/crm/contacts')}
                        className="flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 mb-4 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Voltar para Contatos
                    </button>

                    <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                        <ContactCard
                            contact={enrichedContact}
                            onRegisterInteraction={() => setModalOpen(true)}
                        />

                        <button
                            onClick={() => setModalOpen(true)}
                            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg flex items-center gap-2 font-medium hover:bg-blue-700 shadow-sm transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Registrar Interação
                        </button>
                    </div>

                    <div className="flex items-center gap-6 mt-8">
                        {[
                            { id: 'RESUMO', label: 'Resumo', icon: User },
                            { id: 'INTERACOES', label: 'Interações', icon: FileText },
                        ].map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`flex items-center gap-2 pb-3 px-1 border-b-2 transition-all whitespace-nowrap ${isActive
                                            ? 'border-blue-600 text-blue-600 font-medium'
                                            : 'border-transparent text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="p-6 max-w-5xl mx-auto">
                {activeTab === 'RESUMO' && (
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Métricas de Engajamento</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="p-4 bg-slate-50 rounded-lg">
                                <span className="text-slate-500 text-sm">Perfil</span>
                                <p className="text-lg font-bold text-slate-800">{enrichedContact.analytics?.profile}</p>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-lg">
                                <span className="text-slate-500 text-sm">Interações (90d)</span>
                                <p className="text-lg font-bold text-slate-800">{enrichedContact.analytics?.totalInteractions90d}</p>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-lg">
                                <span className="text-slate-500 text-sm">Desde última interação</span>
                                <p className={`text-lg font-bold ${enrichedContact.analytics?.daysSinceLastInteraction > 45 ? 'text-red-600' : 'text-slate-800'}`}>
                                    {enrichedContact.analytics?.daysSinceLastInteraction === -1 ? '-' : `${enrichedContact.analytics?.daysSinceLastInteraction} dias`}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'INTERACOES' && (
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <InteractionTimeline contactId={id} />
                    </div>
                )}
            </div>

            {modalOpen && enrichedContact && (
                <InteractionFormModal
                    isOpen={modalOpen}
                    onClose={() => setModalOpen(false)}
                    clientId={enrichedContact.clientId}
                    contactId={enrichedContact.id} // Locked
                />
            )}
        </div>
    );
};
