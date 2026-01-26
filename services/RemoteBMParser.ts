import { ExtractedData } from './LocalBMParser';

// Re-using the ExtractedData interface essentially, 
// though the backend might return slightly different snake_case which we might need to normalize if we really cared about strict typing,
// but for now we expect the backend to return the "fields" object structure we need.

export const RemoteBMParser = {
    async parsePDF(file: File): Promise<ExtractedData> {
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

            // Map Valid Backend Response to ExtractedData
            return {
                type: data.fields?.entityType ? 'BM' : 'RDO', // Simple heuristic or use data.type from backend
                rawText: "Processado via Backend Python (pdfplumber)",
                confidence: 1.0,
                fields: data.fields || {}
            };
        } catch (error) {
            console.error("Remote Parse Error:", error);
            throw error;
        }
    }
};
