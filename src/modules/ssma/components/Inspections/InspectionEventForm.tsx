import React from 'react';

export const InspectionEventForm: React.FC<{ onCreate: (data: any) => void }> = ({ onCreate }) => {
    return (
        <div className="border p-4 rounded mb-4 bg-gray-50">
            <h3 className="font-bold mb-2">Novo Evento de Inspeção (Teste UI)</h3>
            <button 
                onClick={() => onCreate({
                    date: new Date().toISOString(),
                    inspectionType: 'IFS',
                    functionGroup: 'TECHNICIAN',
                    regionalId: 'reg-demo',
                    costCenterId: 'cc-demo',
                    executorUid: 'user-demo',
                    executorNameSnapshot: 'Usuário Teste'
                })}
                className="bg-blue-500 text-white px-4 py-2 rounded"
            >
                Simular Criação Rápida
            </button>
        </div>
    );
};
