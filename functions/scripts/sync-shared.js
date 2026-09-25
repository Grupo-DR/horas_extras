/**
 * Copia para as Functions os arquivos compartilhados com o portal.
 * Fonte única: o cadastro de CCs do portal (src/modules/human-capital/data/ccMaster.ts).
 * Roda automaticamente antes do build (script "prebuild").
 */
const fs = require('fs');
const path = require('path');

const files = [
    {
        from: path.resolve(__dirname, '../../src/modules/human-capital/data/ccMaster.ts'),
        to: path.resolve(__dirname, '../src/shared/ccMaster.ts'),
    },
];

for (const { from, to } of files) {
    const content = fs.readFileSync(from, 'utf8');
    fs.mkdirSync(path.dirname(to), { recursive: true });
    const header = '// ARQUIVO GERADO por functions/scripts/sync-shared.js. Nao editar aqui.\n'
        + `// Fonte: ${path.relative(path.resolve(__dirname, '../..'), from).replace(/\\/g, '/')}\n\n`;
    fs.writeFileSync(to, header + content);
    console.log(`[sync-shared] ${path.basename(from)} copiado para functions/src/shared`);
}
