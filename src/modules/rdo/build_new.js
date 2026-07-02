const fs = require('fs');
const path = 'App.tsx';
const backupPath = 'App_backup.tsx';

// Use backup as source to ensure we are starting clean
const content = fs.readFileSync(backupPath, 'utf8');

const newCall = `<ProductionAnalysis 
                projects={projects}
                rdos={rdos}
                teams={teams}
                filterStartDate={filterStartDate}
                setFilterStartDate={setFilterStartDate}
                filterEndDate={filterEndDate}
                setFilterEndDate={setFilterEndDate}
                filterRegional={filterRegional}
                setFilterRegional={setFilterRegional}
                filterProject={filterProject}
                setFilterProject={setFilterProject}
              />`;

// Find everything between <ProductionAnalysis and />
// We use [\s\S]+? for non-greedy match across newlines
const tagRegex = /<ProductionAnalysis[\s\S]+?\/>/;

if (tagRegex.test(content)) {
    const updatedContent = content.replace(tagRegex, newCall);
    // Write to a temporary file first
    fs.writeFileSync('App_new.tsx', updatedContent);
    console.log('App_new.tsx created successfully');
} else {
    console.error('ProductionAnalysis tag not found in backup');
    process.exit(1);
}
