export interface PowerBiReport {
  id: string;
  title: string;
  area: string;
  guardiao: string;
  responsavel: string;
  fontes: string;
  periodicidade: string;
  detalhes: string;
  url: string;
}

export const powerBiReports: PowerBiReport[] = [
  {
    id: 'dashboardFinanceiro-rev03',
    title: 'Resultado Contábil DR',
    area: 'Financeiro',
    guardiao: 'Sergio Farinacio (Controladoria)',
    responsavel: 'Antonio Augusto da Silva (Comercial)',
    fontes: 'Razão Contábil TOTVS',
    periodicidade: 'Duas atualizações diárias de Segunda a Sexta',
    detalhes: `
      <ul class="list-disc pl-5 space-y-2 text-sm text-gray-700">
        <li><strong>Indicadores financeiros consolidados</strong>, incluindo:
          <ul class="list-circle pl-5 mt-1 space-y-1">
            <li>Faturamento bruto e líquido</li>
            <li>Custos e despesas</li>
            <li>Resultado total (margem em R$)</li>
          </ul>
        </li>
        <li><strong>Análise histórica por ano</strong>, com:
          <ul class="list-circle pl-5 mt-1 space-y-1">
            <li>Detalhamento por grupo de contas</li>
            <li>Comparação entre exercícios</li>
          </ul>
        </li>
        <li><strong>Resultado mensal</strong>, apresentando:
          <ul class="list-circle pl-5 mt-1 space-y-1">
            <li>Valores realizados</li>
            <li>Comparativos com budget e forecast</li>
            <li>Percentuais de variação</li>
          </ul>
        </li>
        <li><strong>Evolução do resultado mensal</strong>, com:
          <ul class="list-circle pl-5 mt-1 space-y-1">
            <li>Faturamento x custos/despesas por mês</li>
            <li>Evolução da margem total</li>
          </ul>
        </li>
        <li><strong>Gestão de fornecedores e clientes</strong>, com:
          <ul class="list-circle pl-5 mt-1 space-y-1">
            <li>Ranking por valor total</li>
            <li>Detalhamento por empresa/pessoa, centro de custo e histórico</li>
          </ul>
        </li>
        <li><strong>Análise de headcount</strong>, incluindo:
          <ul class="list-circle pl-5 mt-1 space-y-1">
            <li>Quantidade de pessoas (diretos e indiretos)</li>
            <li>Comparativo entre budget, forecast e realizado</li>
            <li>Indicadores de custo por pessoa</li>
          </ul>
        </li>
        <li><strong>Filtros interativos</strong>, permitindo segmentação por:
          <ul class="list-circle pl-5 mt-1 space-y-1">
            <li>Ano, Mês</li>
            <li>Centro de custo</li>
            <li>Empresa/Pessoa</li>
            <li>Contexto</li>
          </ul>
        </li>
      </ul>
    `,
    url: 'https://app.powerbi.com/view?r=eyJrIjoiNzU4ZGM5Y2EtNjllNi00ODM3LTgyOTYtN2IxNDIzNWE5MmQ4IiwidCI6ImZhMmNlZmIyLTgzMWQtNGJkZS1iNGI5LTA5ZDM4NGE4NGZmZCJ9'
  },
  {
    id: 'dashboardFinanceiro-gerencial',
    title: 'Resultado Gerencial DR',
    area: 'Financeiro',
    guardiao: 'Sergio Farinacio (Controladoria)',
    responsavel: 'Antonio Augusto da Silva (Comercial)',
    fontes: 'Razão Contábil TOTVS e Tabelas Medições',
    periodicidade: 'Duas atualizações diárias de Segunda a Sexta',
    detalhes: `
      <ul class="list-disc pl-5 space-y-2 text-sm text-gray-700">
        <li><strong>Indicadores gerenciais consolidados</strong>, incluindo:
          <ul class="list-circle pl-5 mt-1 space-y-1">
            <li>Medição bruta e líquida</li>
            <li>Custos e despesas totais</li>
            <li>Resultado total (margem em R$)</li>
          </ul>
        </li>
        <li><strong>Análise gerencial por grupo de contas</strong>, com:
          <ul class="list-circle pl-5 mt-1 space-y-1">
            <li>Comparação entre Budget, Forecast e Real</li>
            <li>Percentuais de variação (% Budget, % Forecast, % Real)</li>
            <li>Comparativo mês contra mês (% M-1)</li>
          </ul>
        </li>
        <li><strong>Detalhamento mensal por grupo</strong>, apresentando:
          <ul class="list-circle pl-5 mt-1 space-y-1">
            <li>Valores mês a mês</li>
            <li>Total acumulado por conta</li>
          </ul>
        </li>
        <li><strong>Gestão de fornecedores e clientes</strong>, com:
          <ul class="list-circle pl-5 mt-1 space-y-1">
            <li>Ranking por valor total</li>
            <li>Histórico de notas faturadas</li>
            <li>Detalhamento por empresa/pessoa, centro de custo e mês</li>
          </ul>
        </li>
        <li><strong>Análise de headcount</strong>, incluindo:
          <ul class="list-circle pl-5 mt-1 space-y-1">
            <li>Quantidade de pessoas (diretos e indiretos)</li>
            <li>Comparação entre budget e realizado</li>
            <li>Indicadores de faturamento, despesa e resultado por pessoa</li>
          </ul>
        </li>
        <li><strong>Filtros interativos</strong>, permitindo segmentação por:
          <ul class="list-circle pl-5 mt-1 space-y-1">
            <li>Ano, Mês</li>
            <li>Centro de custo</li>
            <li>Empresa/Pessoa</li>
            <li>Contexto</li>
          </ul>
        </li>
      </ul>
    `,
    url: "https://app.powerbi.com/view?r=eyJrIjoiYjc2YjQ1Y2EtNjBhMC00MzNiLWE1MDItNDM5ZWM0MjdiZTRhIiwidCI6ImZhMmNlZmIyLTgzMWQtNGJkZS1iNGI5LTA5ZDM4NGE4NGZmZCJ9&pageName=fe92497007061cb7b309"
  },
  {
    id: 'dashboardReuniaoSemanal',
    title: 'Reunião Semanal',
    area: 'Financeiro',
    guardiao: 'Sergio Farinacio (Controladoria)',
    responsavel: 'Antonio Augusto da Silva (Comercial)',
    fontes: 'Razão Contábil TOTVS e Tabelas Medições',
    periodicidade: 'Duas atualizações diárias de Segunda a Sexta',
    detalhes: `
      <ul class="list-disc pl-5 space-y-2 text-sm text-gray-700">
        <li><strong>Indicadores financeiros consolidados</strong>, incluindo:
          <ul class="list-circle pl-5 mt-1 space-y-1">
            <li>Faturamento (Budget, Forecast, Projeção e Real)</li>
            <li>Custos (Budget, Forecast, Projeção e Real)</li>
          </ul>
        </li>
        <li><strong>Controle por etapas de lançamento</strong>, permitindo:
          <ul class="list-circle pl-5 mt-1 space-y-1">
            <li>Acompanhamento por fase (Etapas 1 a 4)</li>
            <li>Análise de valores lançados e projetados</li>
          </ul>
        </li>
        <li><strong>Análise gerencial por grupo de contas</strong>, com:
          <ul class="list-circle pl-5 mt-1 space-y-1">
            <li>Comparação entre Budget, Forecast, Projeção e Real</li>
            <li>Percentuais de variação (% Budget, % Forecast, % Projeção, % Real)</li>
          </ul>
        </li>
        <li><strong>Detalhamento por centro de custo e regional</strong>, possibilitando:
          <ul class="list-circle pl-5 mt-1 space-y-1">
            <li>Análises segmentadas</li>
            <li>Identificação de desvios semanais</li>
          </ul>
        </li>
        <li><strong>Histórico de notas faturadas</strong>, com:
          <ul class="list-circle pl-5 mt-1 space-y-1">
            <li>Detalhamento por mês, centro de custo e descrição</li>
            <li>Totalização por período</li>
          </ul>
        </li>
        <li><strong>Filtros interativos</strong>, permitindo segmentação por:
          <ul class="list-circle pl-5 mt-1 space-y-1">
            <li>Contexto (Construtora / Rental)</li>
            <li>Regional, Etapa</li>
            <li>Ano, Mês</li>
            <li>Centro de custo</li>
          </ul>
        </li>
      </ul>
    `,
    url: 'https://app.powerbi.com/view?r=eyJrIjoiZjRiYmZjMTAtZGI0YS00ZWJjLTliZjQtMGMyZWUzN2JkNWJjIiwidCI6ImZhMmNlZmIyLTgzMWQtNGJkZS1iNGI5LTA5ZDM4NGE4NGZmZCJ9'
  },
  {
    id: 'saldoNotas',
    title: 'Saldo de Notas',
    area: 'Financeiro',
    guardiao: 'Sergio Farinacio (Controladoria)',
    responsavel: 'Antonio Augusto da Silva (Comercial)',
    fontes: 'Razão Contábil TOTVS e Tabelas Medições',
    periodicidade: 'Duas atualizações diárias de Segunda a Sexta',
    detalhes: `
      <ul class="list-disc pl-5 space-y-2 text-sm text-gray-700">
        <li><strong>Visão consolidada de saldo de notas</strong>, incluindo:
          <ul class="list-circle pl-5 mt-1 space-y-1">
            <li>Medição do mês</li>
            <li>Faturamento do mês</li>
            <li>Saldo mensal</li>
            <li>Saldo acumulado final</li>
          </ul>
        </li>
        <li><strong>Análise por regional e centro de custo</strong>, com:
          <ul class="list-circle pl-5 mt-1 space-y-1">
            <li>Detalhamento hierárquico</li>
            <li>Identificação de saldos positivos e negativos</li>
          </ul>
        </li>
        <li><strong>Evolução mensal</strong>, apresentando:
          <ul class="list-circle pl-5 mt-1 space-y-1">
            <li>Medição x faturamento por mês</li>
            <li>Evolução do saldo acumulado ao longo do período</li>
          </ul>
        </li>
        <li><strong>Saldo residual</strong>, destacando:
          <ul class="list-circle pl-5 mt-1 space-y-1">
            <li>Valores pendentes</li>
            <li>Ajustes acumulados</li>
          </ul>
        </li>
        <li><strong>Detalhamento mensal por centro de custo</strong>, com:
          <ul class="list-circle pl-5 mt-1 space-y-1">
            <li>Valores mês a mês</li>
            <li>Total acumulado por período</li>
          </ul>
        </li>
        <li><strong>Filtros interativos</strong>, permitindo segmentação por:
          <ul class="list-circle pl-5 mt-1 space-y-1">
            <li>Tipo de centro de custo</li>
            <li>Ano</li>
            <li>Status</li>
            <li>Mês</li>
          </ul>
        </li>
      </ul>
    `,
    url: 'https://app.powerbi.com/view?r=eyJrIjoiMzEzZjE5ZDAtYTE4YS00N2RjLWI1ZDgtYTRkNTJjZjZmYzBlIiwidCI6ImZhMmNlZmIyLTgzMWQtNGJkZS1iNGI5LTA5ZDM4NGE4NGZmZCJ9'
  },
  {
    id: 'Dashboard - Gestão Combustível',
    title: 'Gestão de Abastecimentos',
    area: 'Financeiro',
    guardiao: 'Ana Luiza (Gestão de Ativos)',
    responsavel: 'Antonio Augusto da Silva (Comercial)',
    fontes: 'Ticket Log',
    periodicidade: 'Duas atualizações diárias de Segunda a Sexta',
    detalhes: `
      <ul class="list-disc pl-5 space-y-2 text-sm text-gray-700">
        <li><strong>Indicadores consolidados de abastecimento</strong>, incluindo:
          <ul class="list-circle pl-5 mt-1 space-y-1">
            <li>Valor total de abastecimentos por tipo de combustível</li>
            <li>Média mensal de gastos</li>
          </ul>
        </li>
        <li><strong>Análise de despesas</strong>, com:
          <ul class="list-circle pl-5 mt-1 space-y-1">
            <li>Despesa mensal total</li>
            <li>Despesa por centro de custo</li>
            <li>Despesa por estado, cidade e posto</li>
          </ul>
        </li>
        <li><strong>Análise de preços de combustíveis</strong>, apresentando:
          <ul class="list-circle pl-5 mt-1 space-y-1">
            <li>Preço médio por produto</li>
            <li>Valores mínimos, médios e máximos por litro</li>
            <li>Comparativo mensal de variação de preços</li>
          </ul>
        </li>
        <li><strong>Visão analítica detalhada</strong>, com:
          <ul class="list-circle pl-5 mt-1 space-y-1">
            <li>Índices de informações por UF, cidade e estabelecimento</li>
            <li>Total abastecido</li>
            <li>Média de valor por litro</li>
            <li>Média ponderada por volume</li>
          </ul>
        </li>
        <li><strong>Filtros interativos</strong>, permitindo segmentação por:
          <ul class="list-circle pl-5 mt-1 space-y-1">
            <li>Ano, Mês</li>
            <li>UF, Cidade, Estabelecimento</li>
            <li>Tipo de combustível</li>
            <li>Centro de custo</li>
            <li>Regional</li>
          </ul>
        </li>
      </ul>
    `,
    url: 'https://app.powerbi.com/view?r=eyJrIjoiY2MzZWZmYWItYThhNC00MTE5LThmMDUtYmU2Nzg4YjIwNTFhIiwidCI6ImZhMmNlZmIyLTgzMWQtNGJkZS1iNGI5LTA5ZDM4NGE4NGZmZCJ9'
  },
  {
    id: 'saldoContratual',
    title: 'Saldo Contratual',
    area: 'Gestão de Contratos',
    guardiao: '',
    responsavel: '',
    fontes: '',
    periodicidade: '',
    detalhes: '',
    url: 'https://app.powerbi.com/view?r=eyJrIjoiN2I3YTNlYjMtNjA4ZC00ZmI1LWExNWYtMGQxZjAxMTY4YTk4IiwidCI6ImZhMmNlZmIyLTgzMWQtNGJkZS1iNGI5LTA5ZDM4NGE4NGZmZCJ9'
  },
  {
    id: 'obrigacoesContratuais',
    title: 'Obrigações Contratuais',
    area: 'Gestão de Contratos',
    guardiao: '',
    responsavel: '',
    fontes: '',
    periodicidade: '',
    detalhes: '',
    url: 'https://app.powerbi.com/view?r=eyJrIjoiODllNTZhMzgtNzM1MC00MGU1LTgxOWUtNGJiNzQxNWIwZTFiIiwidCI6ImZhMmNlZmIyLTgzMWQtNGJkZS1iNGI5LTA5ZDM4NGE4NGZmZCJ9'
  }
];
