import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Project, RDOData } from '../../types';

const extract = vi.fn();
const save = vi.fn();

vi.mock('../../services/rdoModels', async () => {
  const actual = await vi.importActual<typeof import('../../services/rdoModels')>('../../services/rdoModels');
  return { ...actual, extractRDOForProject: (...args: unknown[]) => extract(...args) };
});
vi.mock('../../services/geminiService', () => ({ fileToBase64: async () => 'BASE64' }));
vi.mock('../repositories/FirestoreRDORepository', () => ({
  FirestoreRDORepository: class { save = save; getAll = async () => []; update = vi.fn(); delete = vi.fn(); },
}));

const { useRdoStore } = await import('./rdoStore');

const files = (...names: string[]) => names.map(name => ({ name, type: 'application/pdf' })) as unknown as FileList;
const rdo = (reportNumber: string, date: string): RDOData =>
  ({ id: `id_${reportNumber}`, teamId: '', date, reportNumber, workforce: [], equipment: [], activities: [], occurrences: [] });
const project: Project = { id: 'p1', name: '3047.01', createdAt: '', services: [{ code: 'C.1', scope: 'x', unit: 'm', value: 1 }] };

describe('envio de RDOs em lote', () => {
  beforeEach(() => {
    extract.mockReset();
    save.mockReset();
    useRdoStore.setState({ rdos: [] });
  });

  it('um arquivo com falha não interrompe os demais', async () => {
    extract
      .mockResolvedValueOnce(rdo('10', '01/10/2026'))
      .mockRejectedValueOnce(new Error('A IA devolveu uma resposta incompleta ao ler o RDO da Vale.'))
      .mockResolvedValueOnce(rdo('4', '02/10/2026'));

    const result = await useRdoStore.getState().actions.handleFileUpload(files('a.pdf', 'b.pdf', 'c.pdf'), 't1', project);

    expect(result?.saved.map(r => r.reportNumber)).toEqual(['10', '4']);
    expect(result?.failed).toEqual([{ file: 'b.pdf', message: 'A IA devolveu uma resposta incompleta ao ler o RDO da Vale.' }]);
    expect(save).toHaveBeenCalledTimes(2);
    expect(useRdoStore.getState().rdos).toHaveLength(2);
  });

  it('ignora o RDO repetido no mesmo lote (mesma turma, data e número)', async () => {
    extract.mockResolvedValueOnce(rdo('16', '08/10/2026')).mockResolvedValueOnce(rdo('16', '08/10/2026'));

    const result = await useRdoStore.getState().actions.handleFileUpload(files('08.pdf', '09.pdf'), 't1', project);

    expect(result?.saved).toHaveLength(1);
    expect(result?.skipped).toEqual(['09.pdf (RDO nº 16 de 08/10/2026)']);
  });

  it('obra Vale sem PQ é barrada antes de chamar a IA', async () => {
    const semPQ: Project = { ...project, rdoModel: 'VALE_NOVAS_FERROVIAS', services: [] };

    await expect(useRdoStore.getState().actions.handleFileUpload(files('a.pdf'), 't1', semPQ))
      .rejects.toThrow('Importe a PQ da obra');
    expect(extract).not.toHaveBeenCalled();
  });
});
