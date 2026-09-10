import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the API with the key from environment variables
// Using VITE_GEMINI_KEY as requested, with fallback to VITE_GEMINI_API_KEY
const apiKey = import.meta.env.VITE_GEMINI_KEY || import.meta.env.VITE_GEMINI_API_KEY || '';

const genAI = new GoogleGenerativeAI(apiKey);

export interface GeneratedCategory {
    name: string;
    items: string[];
}

export interface GeneratedList {
    title: string;
    items: string[];
    categories?: GeneratedCategory[];
}

export class AIError extends Error {
    rawDetails?: string;

    constructor(message: string, rawDetails?: string) {
        super(message);
        this.name = 'AIError';
        this.rawDetails = rawDetails;
    }
}

export interface AIModelOption {
    id: string;
    name: string;
    description: string;
}

export const AVAILABLE_GEMINI_MODELS: AIModelOption[] = [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Snabb & stabil' },
    { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', description: 'Nyast & smartast' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Hög precision' },
];

export const generateListContent = async (prompt: string, modelOverride?: string): Promise<GeneratedList> => {
    if (!apiKey) {
        throw new Error("Ingen API-nyckel hittades. Vänligen lägg till VITE_GEMINI_KEY i din .env-fil.");
    }

    try {
        const modelName = modelOverride || import.meta.env.VITE_GEMINI_MODEL || "gemini-3.8-flash";
        const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: 'Du är en expert på att skapa strukturerade listor. Ta hänsyn till alla detaljer i användarens prompt. Svara ALLTID med ett strikt JSON-objekt. Om listans innehåll logiskt kan grupperas i 2–5 kategorier, inkludera ett "categories"-fält. Om ingen tydlig gruppering finns, utelämna "categories". Format med kategorier: { "title": string, "items": string[], "categories": [{ "name": string, "items": string[] }] }. Format utan kategorier: { "title": string, "items": string[] }. Ge inga förklaringar eller annan text, bara JSON.'
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

        // Validate categories if present
        if (data.categories !== undefined) {
            if (!Array.isArray(data.categories)) {
                // Malformed categories – strip them and fall back to flat
                console.warn('AI returned malformed categories, falling back to flat list.');
                data.categories = undefined;
            } else {
                // Ensure each category has name and items array
                const validCategories = data.categories.filter(
                    (cat) => typeof cat.name === 'string' && Array.isArray(cat.items)
                );
                data.categories = validCategories.length > 0 ? validCategories : undefined;
            }
        }

        return data;
    } catch (error) {
        console.error("Error generating list with AI:", error);
        
        let rawDetails = '';
        if (error instanceof Error) {
            rawDetails = error.message;
        } else if (typeof error === 'object' && error !== null) {
            try {
                rawDetails = JSON.stringify(error, null, 2);
            } catch {
                rawDetails = String(error);
            }
        } else {
            rawDetails = String(error);
        }

        // Extract embedded JSON error object if returned inside error string
        const jsonSub = rawDetails.match(/\{[\s\S]*\}/);
        if (jsonSub) {
            try {
                const parsed = JSON.parse(jsonSub[0]);
                rawDetails = JSON.stringify(parsed, null, 2);
            } catch {
                // keep original rawDetails
            }
        }

        let errorMessage = "Kunde inte generera lista. Kontrollera din prompt eller försök igen senare.";
        
        if (error instanceof Error) {
            const raw = error.message.toLowerCase();
            if (raw.includes("api key not valid") || raw.includes("api_key_invalid")) {
                errorMessage = "Ogiltig API-nyckel för AI-tjänsten. Vänligen kontrollera dina inställningar.";
            } else if (raw.includes("fetch failed") || raw.includes("network error") || raw.includes("failed to fetch")) {
                errorMessage = "Nätverksfel: Kunde inte ansluta till AI-tjänsten. Kontrollera din internetanslutning.";
            } else if (raw.includes("503") || raw.includes("high demand") || raw.includes("unavailable")) {
                errorMessage = "Modellen är tillfälligt överbelastad (503 High Demand). Vänligen vänta en stund och försök igen.";
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
        
        throw new AIError(errorMessage, rawDetails);
    }
};
