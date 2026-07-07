export const getCompetenceFromDate = (date: Date | string): string => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
};

export const parseCompetence = (competence: string): { year: number; month: number } => {
    const [year, month] = competence.split('-');
    return {
        year: parseInt(year, 10),
        month: parseInt(month, 10)
    };
};

export const formatCompetence = (year: number, month: number): string => {
    return `${year}-${String(month).padStart(2, '0')}`;
};

export const isClosedCompetence = (competence: string, closedCompetences: string[]): boolean => {
    return closedCompetences.includes(competence);
};
