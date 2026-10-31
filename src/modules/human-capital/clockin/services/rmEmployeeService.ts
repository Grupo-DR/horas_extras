import { RmEmployeeRecord } from '../domain/rmEmployees';

/**
 * Cadastro de funcionários do RM (consulta "DADOS SOLIDES") pela Cloud Function
 * hcFetchEmployees — a senha do TOTVS fica no servidor e só os campos
 * necessários chegam aqui. Fica só em memória: CPF não vai para localStorage.
 */
export const fetchRmEmployees = async (): Promise<RmEmployeeRecord[]> => {
    const [{ getFunctions, httpsCallable }, { app }] = await Promise.all([
        import('firebase/functions'),
        import('@/services/firebaseConfig'),
    ]);
    const callable = httpsCallable<void, { employees: RmEmployeeRecord[] }>(
        getFunctions(app, 'us-central1'),
        'hcFetchEmployees',
        { timeout: 130_000 }
    );
    const result = await callable();
    return Array.isArray(result.data?.employees) ? result.data.employees : [];
};
