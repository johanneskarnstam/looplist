import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AIListGeneratorModal } from './AIListGeneratorModal';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as aiService from '../services/aiService';

// Mock aiService
vi.mock('../services/aiService', () => ({
    generateListContent: vi.fn(),
}));

// Mock assets
vi.mock('../assets/gemini.svg', () => ({
    default: 'mock-svg-url'
}));

const mockStartListening = vi.fn();
const mockStopListening = vi.fn();
const mockResetTranscript = vi.fn();
let mockVoiceState = {
    isListening: false,
    transcript: '',
    startListening: mockStartListening,
    stopListening: mockStopListening,
    resetTranscript: mockResetTranscript,
    hasSupport: true,
};

vi.mock('../hooks/useVoiceInput', () => ({
    useVoiceInput: () => mockVoiceState,
}));

describe('AIListGeneratorModal', () => {
    const mockOnClose = vi.fn();
    const mockOnSave = vi.fn();
    const mockCategories = [{ id: 'cat1', name: 'Work' }];

    beforeEach(() => {
        vi.clearAllMocks();
        mockVoiceState = {
            isListening: false,
            transcript: '',
            startListening: mockStartListening,
            stopListening: mockStopListening,
            resetTranscript: mockResetTranscript,
            hasSupport: true,
        };
    });

    it('allows rephrasing and regenerating after initial generation', async () => {
        const mockGeneratedList = {
            title: 'Packing List',
            items: ['Shirt', 'Pants']
        };
        vi.mocked(aiService.generateListContent).mockResolvedValue(mockGeneratedList);

        render(
            <AIListGeneratorModal 
                isOpen={true} 
                onClose={mockOnClose} 
                onSave={mockOnSave} 
                categories={mockCategories} 
            />
        );

        // Initial generation
        const textarea = screen.getByPlaceholderText(/Ex: Packlista för en snowboardresa/);
        fireEvent.change(textarea, { target: { value: 'Packing for Hawaii' } });
        
        const generateButton = screen.getByText('Generera list-förslag');
        fireEvent.click(generateButton);

        await waitFor(() => {
            expect(screen.getByText('Packing List')).toBeDefined();
        });

        // Verify textarea is still there
        expect(screen.getByDisplayValue('Packing for Hawaii')).toBeDefined();

        // Rephrase
        fireEvent.change(textarea, { target: { value: 'Packing for Hawaii with snorkeling' } });
        
        // Find and click "Generera om"
        const regenerateButton = screen.getByText('Generera om');
        fireEvent.click(regenerateButton);

        await waitFor(() => {
            expect(aiService.generateListContent).toHaveBeenCalledTimes(2);
            expect(aiService.generateListContent).toHaveBeenLastCalledWith('Packing for Hawaii with snorkeling');
        });
    });

    it('displays a nice error message and retry button when generation fails', async () => {
        const errorMessage = 'Nätverksfel: Kunde inte ansluta till AI-tjänsten.';
        vi.mocked(aiService.generateListContent).mockRejectedValue(new Error(errorMessage));

        render(
            <AIListGeneratorModal 
                isOpen={true} 
                onClose={mockOnClose} 
                onSave={mockOnSave} 
                categories={mockCategories} 
            />
        );

        const textarea = screen.getByPlaceholderText(/Ex: Packlista för en snowboardresa/);
        fireEvent.change(textarea, { target: { value: 'Test prompt' } });
        
        const generateButton = screen.getByText('Generera list-förslag');
        fireEvent.click(generateButton);

        await waitFor(() => {
            expect(screen.getByText('Ett fel uppstod')).toBeDefined();
            expect(screen.getByText(errorMessage)).toBeDefined();
            expect(screen.getByText('Försök igen')).toBeDefined();
        });

        // Test retry button
        vi.mocked(aiService.generateListContent).mockResolvedValue({ title: 'Success', items: ['Item 1'] });
        const retryButton = screen.getByText('Försök igen');
        fireEvent.click(retryButton);

        await waitFor(() => {
            expect(screen.getByText('Success')).toBeDefined();
            expect(screen.queryByText('Ett fel uppstod')).toBeNull();
        });
    });

    it('renders cleanly when opening without hook order errors', () => {
        const { rerender } = render(
            <AIListGeneratorModal 
                isOpen={false} 
                onClose={mockOnClose} 
                onSave={mockOnSave} 
                categories={mockCategories} 
            />
        );

        expect(screen.queryByText('Skapa lista med AI')).toBeNull();

        // Rerender with isOpen = true (this previously threw the hooks error)
        rerender(
            <AIListGeneratorModal 
                isOpen={true} 
                onClose={mockOnClose} 
                onSave={mockOnSave} 
                categories={mockCategories} 
            />
        );

        expect(screen.getByText('Skapa lista med AI')).toBeDefined();
    });

    it('renders voice input mic button when supported and handles toggling', () => {
        render(
            <AIListGeneratorModal 
                isOpen={true} 
                onClose={mockOnClose} 
                onSave={mockOnSave} 
                categories={mockCategories} 
            />
        );

        const micButton = screen.getByLabelText('Tala in prompt');
        expect(micButton).toBeDefined();

        fireEvent.click(micButton);
        expect(mockResetTranscript).toHaveBeenCalled();
        expect(mockStartListening).toHaveBeenCalled();
    });

    it('stops listening when clicking the active mic button', () => {
        mockVoiceState.isListening = true;

        render(
            <AIListGeneratorModal 
                isOpen={true} 
                onClose={mockOnClose} 
                onSave={mockOnSave} 
                categories={mockCategories} 
            />
        );

        expect(screen.getByText(/Lyssnar... tala in din prompt/)).toBeDefined();
        const activeMicButton = screen.getByLabelText('Sluta lyssna');
        fireEvent.click(activeMicButton);

        expect(mockStopListening).toHaveBeenCalled();
    });

    it('updates textarea prompt as speech transcript arrives', () => {
        mockVoiceState.isListening = true;
        mockVoiceState.transcript = 'Packlista för fjällen';

        render(
            <AIListGeneratorModal 
                isOpen={true} 
                onClose={mockOnClose} 
                onSave={mockOnSave} 
                categories={mockCategories} 
            />
        );

        expect(screen.getByDisplayValue('Packlista för fjällen')).toBeDefined();
    });

    it('stops voice listening when user closes the modal', () => {
        mockVoiceState.isListening = true;

        render(
            <AIListGeneratorModal 
                isOpen={true} 
                onClose={mockOnClose} 
                onSave={mockOnSave} 
                categories={mockCategories} 
            />
        );

        // Click close button
        const closeBtn = screen.getByRole('button', { name: '' });
        fireEvent.click(closeBtn);

        expect(mockStopListening).toHaveBeenCalled();
        expect(mockOnClose).toHaveBeenCalled();
    });
});
