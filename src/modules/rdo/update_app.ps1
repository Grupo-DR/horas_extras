$path = 'App.tsx'
$content = Get-Content $path -Raw
$newCall = @"
              <ProductionAnalysis 
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
              />
"@
$content = $content -replace '<ProductionAnalysis.*?/>', $newCall
$content | Set-Content $path
Write-Host "App.tsx updated with new props successfully"
