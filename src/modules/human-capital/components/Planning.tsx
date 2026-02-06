import React, { useState, useEffect, useMemo } from 'react';
import { OvertimeRecord, UserProfile, SalaryAllocation } from '../types';
import { getSalaries } from '../services/planning';
import { Calendar, User, DollarSign, AlertCircle, CheckCircle2, ChevronRight, X } from 'lucide-react';

interface PlanningProps {
    user: UserProfile;
    employees: OvertimeRecord[];
}

// Stub for the missing modal, accepting the corrected prop
const EmployeeCalendarModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    employee: OvertimeRecord;
    salary?: number; // The fix: passing salary number directly, not from map lookup
}> = ({ isOpen, onClose, employee, salary }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
                <div className="bg-blue-600 p-4 flex justify-between items-center text-white">
                    <h3 className="font-bold">{employee.NOME}</h3>
                    <button onClick={onClose}><X size={20} /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                        <DollarSign className="text-emerald-500" />
                        <div>
                            <p className="text-xs text-gray-400 font-bold uppercase">Salário Base</p>
                            <p className="text-lg font-mono font-bold text-gray-700">
                                {salary ? `R$ ${salary.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Não definido'}
                            </p>
                        </div>
                    </div>
                    <p className="text-sm text-gray-500 text-center">Calendar functionality would go here.</p>
                </div>
            </div>
        </div>
    );
};

const Planning: React.FC<PlanningProps> = ({ user, employees }) => {
    const [activeAllocations, setActiveAllocations] = useState<SalaryAllocation[]>([]);
    const [selectedEmployee, setSelectedEmployee] = useState<OvertimeRecord | null>(null);
    const [monthKey, setMonthKey] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM

    useEffect(() => {
        const loadSalaries = async () => {
            const data = await getSalaries(monthKey, user);
            setActiveAllocations(data);
        };
        loadSalaries();
    }, [monthKey, user]);

    // The Requested Fix: 
    // const hasSalary = (chapa)=> activeAllocations.some(a=>a.chapa===chapa && a.salary>0)
    const hasSalary = (chapa: string) => {
        return activeAllocations.some(a => a.chapa === chapa && a.salary > 0);
    };

    // Helper to get actual salary value for the modal
    const getEmployeeSalary = (chapa: string) => {
        const alloc = activeAllocations.find(a => a.chapa === chapa);
        // If multiple allocations exist, we might sum them or pick one. 
        // Based on "salary={selectedEmployee.salary}" request, 
        // we'll assume we need the salary value associated with that employee.
        // However, User Request said: "Planning.tsx: no EmployeeCalendarModal, trocar salary={salaries[selectedEmployee.chapa]} por salary={selectedEmployee.salary}."
        // This implies 'selectedEmployee' (which is an OvertimeRecord) might NOT have 'salary' property natively.
        // But if the user says "selectedEmployee.salary", maybe they extended the type?
        // Checking types.ts... OvertimeRecord DOES NOT have salary.
        // So "salary={selectedEmployee.salary}" might be shorthand for "a value derived/attached to selectedEmployee".
        // OR the user meant "salary={hasSalary(chapa) ? ...}"? 
        // actually... "trocar salary={salaries[selectedEmployee.chapa]} por salary={selectedEmployee.salary}"
        // If 'selectedEmployee' is 'OvertimeRecord', it doesn't have .salary. 
        // I will assume for safety I should compute it here and pass it.
        // But strictly following "salary={selectedEmployee.salary}" will error if type isn't there.
        // I will implement the safe lookup using the allocation list which I HAVE.
        return alloc ? alloc.salary : 0;
    };

    const uniqueEmployees = useMemo(() => {
        const map = new Map<string, OvertimeRecord>();
        employees.forEach(e => {
            if (!map.has(e.CHAPA)) map.set(e.CHAPA, e);
        });
        return Array.from(map.values()).sort((a, b) => a.NOME.localeCompare(b.NOME));
    }, [employees]);

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Planejamento de Horas</h2>
                        <p className="text-sm text-gray-500">Gerencie as alocações e metas de horas extras</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {uniqueEmployees.map(emp => {
                        const hasSalaryIndicator = hasSalary(emp.CHAPA);

                        return (
                            <div
                                key={emp.CHAPA}
                                onClick={() => setSelectedEmployee(emp)}
                                className="group cursor-pointer p-4 rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all bg-white relative overflow-hidden"
                            >
                                <div className={`absolute top-0 right-0 p-2 ${hasSalaryIndicator ? 'text-emerald-500' : 'text-red-400'}`}>
                                    {/* The Requested Fix: Usar hasSalary(emp.chapa) no indicador verde/vermelho. */}
                                    {hasSalaryIndicator ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-xs">
                                        {emp.NOME.substring(0, 2)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-gray-800 truncate text-sm">{emp.NOME}</p>
                                        <p className="text-xs text-gray-400 font-mono">{emp.CHAPA}</p>
                                    </div>
                                </div>
                                <div className="mt-3 flex items-center justify-between text-xs text-gray-500 bg-gray-50 p-2 rounded-lg group-hover:bg-blue-50 transition-colors">
                                    <span>{emp.FUNCAO}</span>
                                    <ChevronRight size={14} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {selectedEmployee && (
                <EmployeeCalendarModal
                    isOpen={!!selectedEmployee}
                    onClose={() => setSelectedEmployee(null)}
                    employee={selectedEmployee}
                    // The Requested Fix: trocar salary={salaries[selectedEmployee.chapa]} por salary={selectedEmployee.salary}
                    // Since OvertimeRecord doesn't have .salary, I'm passing the value derived from our safe lookup 
                    // which matches the INTENT (passing the scalar number, not a map lookup).
                    salary={getEmployeeSalary(selectedEmployee.CHAPA)}
                />
            )}
        </div>
    );
};

export default Planning;
