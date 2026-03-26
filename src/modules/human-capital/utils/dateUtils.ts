/**
 * Utilitário para cálculos de Datas no módulo Human Capital
 * Focado em DSR (Descanso Semanal Remunerado)
 */

interface PeriodStats {
  businessDays: number;    // Dias úteis (Segunda a Sábado, excluindo feriados)
  sunHolidays: number;     // Domingos e Feriados
  totalDays: number;
}

/**
 * Feriados Nacionais Brasileiros (2024-2025)
 * Formato: 'YYYY-MM-DD'
 */
const HOLIDAYS = new Set([
  // 2024
  '2024-01-01', // Confraternização Universal
  '2024-02-12', // Carnaval (Ponto Facultativo / Usual DSR)
  '2024-02-13', // Carnaval
  '2024-03-29', // Sexta-feira Santa
  '2024-04-21', // Tiradentes
  '2024-05-01', // Dia do Trabalho
  '2024-05-30', // Corpus Christi
  '2024-09-07', // Independência
  '2024-10-12', // Nsa. Sra. Aparecida
  '2024-11-02', // Finados
  '2024-11-15', // Proclamação da República
  '2024-11-20', // Consciência Negra
  '2024-12-25', // Natal
  
  // 2025
  '2025-01-01',
  '2025-03-03', // Carnaval
  '2025-03-04', // Carnaval
  '2025-04-18', // Sexta-feira Santa
  '2025-04-21',
  '2025-05-01',
  '2025-06-19', // Corpus Christi
  '2025-09-07',
  '2025-10-12',
  '2025-11-02',
  '2025-11-15',
  '2025-11-20',
  '2025-12-25'
]);

/**
 * Calcula estatísticas do período para fins de DSR.
 * @param start Data de início
 * @param end Data de fim
 * @returns Objeto com contagem de dias úteis e domingos/feriados
 */
export const getPeriodStats = (start: Date, end: Date): PeriodStats => {
  let businessDays = 0;
  let sunHolidays = 0;
  let totalDays = 0;

  const current = new Date(start);
  // Normaliza para o início do dia para evitar problemas de comparação
  current.setHours(0, 0, 0, 0);
  
  const finish = new Date(end);
  finish.setHours(23, 59, 59, 999);

  while (current <= finish) {
    const dayOfWeek = current.getDay(); // 0 = Domingo, 6 = Sábado
    const isoDate = current.toISOString().split('T')[0];
    const isHoliday = HOLIDAYS.has(isoDate);
    const isSunday = dayOfWeek === 0;

    if (isSunday || isHoliday) {
      sunHolidays++;
    } else {
      // Segunda a Sábado que não é feriado
      businessDays++;
    }

    totalDays++;
    current.setDate(current.getDate() + 1);
  }

  return { businessDays, sunHolidays, totalDays };
};
