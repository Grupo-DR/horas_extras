/**
 * Mensagens em português para falhas do Firestore.
 * Gravações do RDO Online nunca são escondidas: se o banco recusar, o usuário precisa saber.
 */
export const firestoreErrorMessage = (action: string, error: unknown): string => {
  const code = (error as { code?: string } | null)?.code ?? '';
  if (code === 'permission-denied') {
    return `Sem permissão para ${action}. Seu perfil no RDO Online é só de leitura; peça acesso de Gerente ao administrador.`;
  }
  if (code === 'unavailable' || code === 'deadline-exceeded') {
    return `Não foi possível ${action}: sem conexão com o banco. Verifique a internet e tente de novo.`;
  }
  if (code === 'resource-exhausted') {
    return `Não foi possível ${action}: dados grandes demais para um registro.`;
  }
  const detail = error instanceof Error ? error.message : String(error ?? '');
  return `Não foi possível ${action}.${detail ? ` (${detail})` : ''}`;
};

/** Executa a operação no banco e troca o erro técnico por uma mensagem para o usuário. */
export const withFirestoreError = async <T>(action: string, operation: () => Promise<T>): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    console.error(`[RDO] Falha ao ${action}`, error);
    throw new Error(firestoreErrorMessage(action, error));
  }
};
