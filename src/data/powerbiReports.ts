export interface PowerBiReport {
  id: string;
  title: string;
  area: string;
  url: string;
}

export const powerBiReports: PowerBiReport[] = [
  {
    id: 'dashboardFinanceiro-rev03',
    title: 'Resultado Contábil DR',
    area: 'Financeiro',
    url: 'https://app.powerbi.com/view?r=eyJrIjoiNzU4ZGM5Y2EtNjllNi00ODM3LTgyOTYtN2IxNDIzNWE5MmQ4IiwidCI6ImZhMmNlZmIyLTgzMWQtNGJkZS1iNGI5LTA5ZDM4NGE4NGZmZCJ9'
  },
  {
    id: 'dashboardFinanceiro-gerencial',
    title: 'Resultado Gerencial DR',
    area: 'Financeiro',
    url: 'https://app.powerbi.com/view?r=eyJrIjoiYjc2YjQ1Y2EtNjBhMC00MzNiLWE1MDItNDM5ZWM0MjdiZTRhIiwidCI6ImZhMmNlZmIyLTgzMWQtNGJkZS1iNGI5LTA5ZDM4NGE4NGZmZCJ9&pageName=fe92497007061cb7b309'
  },
  {
    id: 'dashboardReuniaoSemanal',
    title: 'Reunião Semanal',
    area: 'Financeiro',
    url: 'https://app.powerbi.com/view?r=eyJrIjoiZjRiYmZjMTAtZGI0YS00ZWJjLTliZjQtMGMyZWUzN2JkNWJjIiwidCI6ImZhMmNlZmIyLTgzMWQtNGJkZS1iNGI5LTA5ZDM4NGE4NGZmZCJ9'
  },
  {
    id: 'saldoNotas',
    title: 'Saldo de Notas',
    area: 'Financeiro',
    url: 'https://app.powerbi.com/view?r=eyJrIjoiMzEzZjE5ZDAtYTE4YS00N2RjLWI1ZDgtYTRkNTJjZjZmYzBlIiwidCI6ImZhMmNlZmIyLTgzMWQtNGJkZS1iNGI5LTA5ZDM4NGE4NGZmZCJ9'
  },
  {
    id: 'Dashboard - Gestão Combustível',
    title: 'Gestão de Abastecimentos',
    area: 'Financeiro',
    url: 'https://app.powerbi.com/view?r=eyJrIjoiY2MzZWZmYWItYThhNC00MTE5LThmMDUtYmU2Nzg4YjIwNTFhIiwidCI6ImZhMmNlZmIyLTgzMWQtNGJkZS1iNGI5LTA5ZDM4NGE4NGZmZCJ9'
  },
  {
    id: 'Pedidos_Compra_rev00',
    title: 'Pedidos de Compra',
    area: 'Financeiro',
    url: 'https://app.powerbi.com/view?r=eyJrIjoiOWNjYWY4MGEtZjNlNy00NzRjLWIxMTMtY2ViNTQyZmM3ZTkzIiwidCI6ImZhMmNlZmIyLTgzMWQtNGJkZS1iNGI5LTA5ZDM4NGE4NGZmZCJ9'
  },
  {
    id: 'saldoContratual',
    title: 'Saldo Contratual',
    area: 'Gestão de Contratos',
    url: 'https://app.powerbi.com/view?r=eyJrIjoiN2I3YTNlYjMtNjA4ZC00ZmI1LWExNWYtMGQxZjAxMTY4YTk4IiwidCI6ImZhMmNlZmIyLTgzMWQtNGJkZS1iNGI5LTA5ZDM4NGE4NGZmZCJ9'
  },
  {
    id: 'obrigacoesContratuais',
    title: 'Obrigações Contratuais',
    area: 'Gestão de Contratos',
    url: 'https://app.powerbi.com/view?r=eyJrIjoiODllNTZhMzgtNzM1MC00MGU1LTgxOWUtNGJiNzQxNWIwZTFiIiwidCI6ImZhMmNlZmIyLTgzMWQtNGJkZS1iNGI5LTA5ZDM4NGE4NGZmZCJ9'
  }
];
