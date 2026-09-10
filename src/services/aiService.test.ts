import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGenerateContent = vi.fn();
const mockGetGenerativeModel = vi.fn().mockImplementation(() => ({
    generateContent: mockGenerateContent,
}));

vi.mock('@google/generative-ai', () => {
    return {
        GoogleGenerativeAI: class {
            getGenerativeModel = mockGetGenerativeModel;
        },
    };
});

describe('aiService - generateListContent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    it('throws a user-friendly error when no API key is present', async () => {
        vi.stubEnv('VITE_GEMINI_KEY', '');
        vi.stubEnv('VITE_GEMINI_API_KEY', '');

        const { generateListContent } = await import('./aiService');
        await expect(generateListContent('a prompt')).rejects.toThrow(
            /API-nyckel/
        );
    });

    it('returns GeneratedList on a successful API response', async () => {
        vi.stubEnv('VITE_GEMINI_KEY', 'test-api-key');

        const payload = { title: 'Shopping', items: ['Milk', 'Eggs'] };
        mockGenerateContent.mockResolvedValueOnce({
            response: { text: () => JSON.stringify(payload) },
        });

        const { generateListContent } = await import('./aiService');
        const result = await generateListContent('a shopping list');
        expect(result.title).toBe('Shopping');
        expect(result.items).toEqual(['Milk', 'Eggs']);
    });

    it('parses JSON wrapped in markdown code blocks', async () => {
        vi.stubEnv('VITE_GEMINI_KEY', 'test-api-key');

        const payload = { title: 'Gym', items: ['Towel', 'Shoes'] };
        const markdownWrapped = '```json\n' + JSON.stringify(payload) + '\n```';
        mockGenerateContent.mockResolvedValueOnce({
            response: { text: () => markdownWrapped },
        });

        const { generateListContent } = await import('./aiService');
        const result = await generateListContent('gym bag');
        expect(result.title).toBe('Gym');
        expect(result.items).toHaveLength(2);
    });

    it('throws user-friendly error on network failure (fetch failed)', async () => {
        vi.stubEnv('VITE_GEMINI_KEY', 'test-api-key');

        mockGenerateContent.mockRejectedValueOnce(new Error('fetch failed'));

        const { generateListContent } = await import('./aiService');
        await expect(generateListContent('test')).rejects.toThrow(/Nätverksfel/);
    });

    it('throws user-friendly error on rate-limit / quota exceeded', async () => {
        vi.stubEnv('VITE_GEMINI_KEY', 'test-api-key');

        mockGenerateContent.mockRejectedValueOnce(new Error('429 quota exceeded'));

        const { generateListContent } = await import('./aiService');
        await expect(generateListContent('test')).rejects.toThrow(/överbelastad/);
    });

    it('throws user-friendly error for invalid API key', async () => {
        vi.stubEnv('VITE_GEMINI_KEY', 'bad-key');

        mockGenerateContent.mockRejectedValueOnce(new Error('api key not valid'));

        const { generateListContent } = await import('./aiService');
        await expect(generateListContent('test')).rejects.toThrow(/Ogiltig API-nyckel/);
    });

    it('throws user-friendly error when safety blocked', async () => {
        vi.stubEnv('VITE_GEMINI_KEY', 'test-key');

        mockGenerateContent.mockRejectedValueOnce(new Error('content blocked by safety filters'));

        const { generateListContent } = await import('./aiService');
        await expect(generateListContent('test')).rejects.toThrow(/blockades/);
    });

    it('throws user-friendly error when JSON response format is invalid', async () => {
        vi.stubEnv('VITE_GEMINI_KEY', 'test-api-key');

        // Response has title but no items array
        mockGenerateContent.mockResolvedValueOnce({
            response: { text: () => JSON.stringify({ title: 'Oops' }) },
        });

        const { generateListContent } = await import('./aiService');
        await expect(generateListContent('test')).rejects.toThrow(/format/i);
    });

    it('uses gemini-3.8-flash by default when VITE_GEMINI_MODEL is not set', async () => {
        vi.stubEnv('VITE_GEMINI_KEY', 'test-api-key');
        vi.stubEnv('VITE_GEMINI_MODEL', '');

        const payload = { title: 'Shopping', items: ['Milk'] };
        mockGenerateContent.mockResolvedValueOnce({
            response: { text: () => JSON.stringify(payload) },
        });

        const { generateListContent } = await import('./aiService');
        await generateListContent('a shopping list');

        expect(mockGetGenerativeModel).toHaveBeenCalledWith(
            expect.objectContaining({
                model: 'gemini-3.8-flash',
            })
        );
    });

    it('uses custom model from VITE_GEMINI_MODEL when configured', async () => {
        vi.stubEnv('VITE_GEMINI_KEY', 'test-api-key');
        vi.stubEnv('VITE_GEMINI_MODEL', 'custom-model');

        const payload = { title: 'Shopping', items: ['Milk'] };
        mockGenerateContent.mockResolvedValueOnce({
            response: { text: () => JSON.stringify(payload) },
        });

        const { generateListContent } = await import('./aiService');
        await generateListContent('a shopping list');

        expect(mockGetGenerativeModel).toHaveBeenCalledWith(
            expect.objectContaining({
                model: 'custom-model',
            })
        );
    });
});

