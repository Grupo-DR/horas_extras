import { ImportedData } from '../types';

export const RemoteBMParser = {
    async parsePDF(file: File): Promise<ImportedData> {
        const formData = new FormData();
        formData.append('file', file);

        try {
            // Assuming the backend is running on localhost:8000
            // In a real app, this URL should be in an env var
            const response = await fetch('http://localhost:8000/parse-pdf', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const err = await response.text();
                throw new Error(`Server Error: ${response.status} - ${err}`);
            }

            const data = await response.json();

            // The Backend returns { fields: ... } or just the object.
            // But since we want to align with the "JSON as Source of Truth",
            // The backend should ideally return exactly what the JSON structure is (ExtractedBM or ExtractedRDO)
            // For now, let's assume `data.fields` or `data` IS the object we want.

            // We want the full raw object (which matches the JSON structure)
            // The backend puts 'fields' inside it, but we want the top-level keys like 'itens', 'relatorio', etc.
            const result = data;

            // Helper to tag it so frontend knows which one it is, if strict checking is needed
            // But strict ExtractedBM has 'itens', ExtractedRDO has 'relatorio'.
            return result as ImportedData;

        } catch (error) {
            console.error("Remote Parse Error:", error);
            throw error;
        }
    }
};
