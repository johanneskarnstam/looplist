import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the API with the key from environment variables
// Using VITE_GEMINI_KEY as requested, with fallback to VITE_GEMINI_API_KEY
const apiKey = import.meta.env.VITE_GEMINI_KEY || import.meta.env.VITE_GEMINI_API_KEY || '';

const genAI = new GoogleGenerativeAI(apiKey);

export interface GeneratedList {
    title: string;
    items: string[];
}

export const generateListContent = async (prompt: string): Promise<GeneratedList> => {
    if (!apiKey) {
        throw new Error("Ingen API-nyckel hittades. Vänligen lägg till VITE_GEMINI_KEY i din .env-fil.");
    }

    try {
        const modelName = import.meta.env.VITE_GEMINI_MODEL || "gemini-3.8-flash";
        const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: 'Du är en expert på att skapa strukturerade listor. Ta hänsyn till alla detaljer i användarens prompt. Svara ALLTID med ett strikt JSON-objekt: { "title": string, "items": string[] }. Ge inga förklaringar eller annan text, bara JSON.'
        });

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Extract JSON from potential markdown blocks in case the model wraps it still
        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, responseText];
        const jsonString = jsonMatch[1].trim();

        const data = JSON.parse(jsonString) as GeneratedList;

        if (!data.title || !Array.isArray(data.items)) {
            throw new Error("Invalid response format from AI.");
        }

        return data;
    } catch (error) {
        console.error("Error generating list with AI:", error);
        
        let errorMessage = "Kunde inte generera lista. Kontrollera din prompt eller försök igen senare.";
        
        if (error instanceof Error) {
            const raw = error.message.toLowerCase();
            if (raw.includes("api key not valid") || raw.includes("api_key_invalid")) {
                errorMessage = "Ogiltig API-nyckel för AI-tjänsten. Vänligen kontrollera dina inställningar.";
            } else if (raw.includes("fetch failed") || raw.includes("network error") || raw.includes("failed to fetch")) {
                errorMessage = "Nätverksfel: Kunde inte ansluta till AI-tjänsten. Kontrollera din internetanslutning.";
            } else if (raw.includes("429") || raw.includes("quota") || raw.includes("too many requests")) {
                errorMessage = "Servern är överbelastad just nu. Vänligen vänta en liten stund och försök igen.";
            } else if (raw.includes("safety") || raw.includes("blocked")) {
                errorMessage = "Din förfrågan blockades av säkerhetsskäl. Försök att formulera om texten.";
            } else if (raw.includes("invalid response format") || raw.includes("json")) {
                errorMessage = "AI:n returnerade ett format vi inte kunde förstå. Vänligen försök med en annan beskrivning.";
            } else if (error.message.length < 100) {
                // If it's a relatively short error message, we can show it directly,
                // but we clean up potential google prefixes
                errorMessage = error.message.replace(/\[GoogleGenerativeAI Error\]:\s*/i, '');
            }
        }
        
        throw new Error(errorMessage);
    }
};
