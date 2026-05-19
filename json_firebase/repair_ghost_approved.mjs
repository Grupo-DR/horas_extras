/**
 * SCRIPT DE REPARO: Restaurar status 'approved' em registros corrompidos
 * =========================================================================
 * Uso:
 *   node json_firebase/repair_ghost_approved.mjs <email> <senha>
 *   node json_firebase/repair_ghost_approved.mjs <email> <senha> --force
 *
 * Sem --force: apenas imprime o resumo, sem gravar nada.
 * Com --force: executa o reparo no Firestore.
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey:            'AIzaSyCCIPZr7nfdZZKHPQ5VdwIzwglSM7bXapo',
    authDomain:        'kanbancomercial-af561.firebaseapp.com',
    projectId:         'kanbancomercial-af561',
    storageBucket:     'kanbancomercial-af561.firebasestorage.app',
    messagingSenderId: '1034446322680',
    appId:             '1:1034446322680:web:d3d8778a6131d9bb22740d',
};

const COL_PLANNING = 'hc_planning_records';
const COL_AUDIT    = 'hc_audit_logs';

function chunkArray(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
    return chunks;
}

async function main() {
    const [,, email, password, flag] = process.argv;
    const force = flag === '--force';

    if (!email || !password) {
        console.error('Uso: node json_firebase/repair_ghost_approved.mjs <email> <senha> [--force]');
        process.exit(1);
    }

    const app  = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db   = getFirestore(app);

    console.log('\n=== REPAIR: hc_planning_records ghost-approved ===\n');

    try {
        await signInWithEmailAndPassword(auth, email.trim(), password.trim());
        console.log('Autenticado como:', email.trim());
    } catch (err) {
        console.error('Falha na autenticacao:', err.message);
        process.exit(1);
    }

    console.log('\nLendo hc_planning_records...');
    const snapshot = await getDocs(collection(db, COL_PLANNING));
    const allDocs  = snapshot.docs;
    console.log('Total de documentos:', allDocs.length);

    const toRepair = allDocs.filter(d => {
        const data = d.data();
        return data.approvedAt && data.status !== 'approved';
    });

    console.log('Registros ghost-approved encontrados:', toRepair.length);

    if (toRepair.length === 0) {
        console.log('Nenhum reparo necessario. Base ja esta consistente!');
        process.exit(0);
    }

    const byStatus = {};
    toRepair.forEach(d => {
        const s = d.data().status || 'undefined';
        byStatus[s] = (byStatus[s] || 0) + 1;
    });
    console.log('\nDistribuicao:');
    Object.entries(byStatus).forEach(([s, n]) => console.log(' ', s + ':', n));

    const byCC = {};
    toRepair.forEach(d => {
        const cc = d.data().costCenter || '?';
        byCC[cc] = (byCC[cc] || 0) + 1;
    });
    const top10 = Object.entries(byCC).sort((a,b) => b[1]-a[1]).slice(0,10);
    console.log('\nTop 10 CCs afetados:');
    top10.forEach(([cc, n]) => console.log('  CC', cc + ':', n, 'registros'));

    if (!force) {
        console.log('\nModo DRY-RUN. Para executar o reparo, adicione --force:');
        console.log('  node json_firebase/repair_ghost_approved.mjs "' + email + '" "SENHA" --force\n');
        process.exit(0);
    }

    console.log('\nIniciando reparo...');
    const chunks     = chunkArray(toRepair, 400);
    let repaired     = 0;
    const repairedAt = new Date().toISOString();

    for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(docSnap => {
            batch.update(docSnap.ref, {
                status:     'approved',
                repairedAt: repairedAt,
                repairedBy: 'repair_ghost_approved.mjs',
            });
        });
        await batch.commit();
        repaired += chunk.length;
        console.log('Progresso:', repaired + '/' + toRepair.length);
    }

    console.log('\nReparo concluido!', repaired, 'registros restaurados para status "approved".');

    try {
        const auditBatch = writeBatch(db);
        const auditRef   = doc(collection(db, COL_AUDIT));
        auditBatch.set(auditRef, {
            action:        'PLANNING_REPAIR_GHOST_APPROVED',
            description:   'Script repair_ghost_approved.mjs restaurou ' + repaired + ' registros ghost-approved.',
            repairedCount: repaired,
            byStatus,
            executedBy:    email.trim(),
            executedAt:    repairedAt,
        });
        await auditBatch.commit();
        console.log('Log de auditoria gravado em hc_audit_logs.');
    } catch (err) {
        console.warn('Aviso: nao foi possivel gravar o log de auditoria:', err.message);
    }

    process.exit(0);
}

main().catch(err => {
    console.error('Erro fatal:', err.message || err);
    process.exit(1);
});
