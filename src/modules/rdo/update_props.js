const fs = require('fs');
const path = 'App.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Update the ProductionAnalysis call in App.tsx
const oldCall = /<ProductionAnalysis[\s\S]+?\/>/;
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

if (oldCall.test(content)) {
    content = content.replace(oldCall, newCall);
    fs.writeFileSync(path, content);
    console.log('App.tsx updated with new ProductionAnalysis props');
} else {
    console.error('Could not find old ProductionAnalysis call');
    process.exit(1);
}
