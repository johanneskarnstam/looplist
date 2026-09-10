import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useVoiceInput } from './useVoiceInput';

describe('useVoiceInput', () => {
    let mockStart: ReturnType<typeof vi.fn>;
    let mockStop: ReturnType<typeof vi.fn>;
    let mockAbort: ReturnType<typeof vi.fn>;
    let instance: {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        start: ReturnType<typeof vi.fn>;
        stop: ReturnType<typeof vi.fn>;
        abort: ReturnType<typeof vi.fn>;
        onresult: ((event: unknown) => void) | null;
        onerror: ((event: unknown) => void) | null;
        onend: (() => void) | null;
    };

    beforeEach(() => {
        vi.clearAllMocks();

        mockStart = vi.fn();
        mockStop = vi.fn();
        mockAbort = vi.fn();

        instance = {
            continuous: false,
            interimResults: false,
            lang: '',
            start: mockStart,
            stop: mockStop,
            abort: mockAbort,
            onresult: null,
            onerror: null,
            onend: null,
        };

        class MockSpeechRecognition {
            constructor() {
                instance.start = mockStart;
                instance.stop = mockStop;
                instance.abort = mockAbort;
                return instance;
            }
        }

        // @ts-expect-error Mocking window speech recognition
        window.SpeechRecognition = MockSpeechRecognition;
        // @ts-expect-error Mocking window speech recognition
        window.webkitSpeechRecognition = MockSpeechRecognition;
    });

    it('detects browser support when SpeechRecognition is available', () => {
        const { result } = renderHook(() => useVoiceInput());
        expect(result.current.hasSupport).toBe(true);
        expect(result.current.isListening).toBe(false);
        expect(result.current.transcript).toBe('');
    });

    it('reports hasSupport as false when SpeechRecognition is not available', () => {
        // @ts-expect-error Mocking missing speech recognition
        delete window.SpeechRecognition;
        // @ts-expect-error Mocking missing speech recognition
        delete window.webkitSpeechRecognition;

        const { result } = renderHook(() => useVoiceInput());
        expect(result.current.hasSupport).toBe(false);
    });

    it('starts listening and updates state', () => {
        const { result } = renderHook(() => useVoiceInput());

        act(() => {
            result.current.startListening();
        });

        expect(mockStart).toHaveBeenCalled();
        expect(result.current.isListening).toBe(true);
    });

    it('stops listening and updates state', () => {
        const { result } = renderHook(() => useVoiceInput());

        act(() => {
            result.current.startListening();
        });
        expect(result.current.isListening).toBe(true);

        act(() => {
            result.current.stopListening();
        });
        expect(mockStop).toHaveBeenCalled();
        expect(result.current.isListening).toBe(false);
    });

    it('accumulates results from onresult events', () => {
        const { result } = renderHook(() => useVoiceInput());

        act(() => {
            result.current.startListening();
        });

        act(() => {
            instance.onresult?.({
                resultIndex: 0,
                results: [
                    [{ transcript: 'Köp mjölk och ' }],
                    [{ transcript: 'ägg' }],
                ],
            });
        });

        expect(result.current.transcript).toBe('Köp mjölk och ägg');
    });

    it('resets transcript via resetTranscript', () => {
        const { result } = renderHook(() => useVoiceInput());

        act(() => {
            result.current.startListening();
        });

        act(() => {
            instance.onresult?.({
                resultIndex: 0,
                results: [[{ transcript: 'Test' }]],
            });
        });

        expect(result.current.transcript).toBe('Test');

        act(() => {
            result.current.resetTranscript();
        });

        expect(result.current.transcript).toBe('');
    });

    it('handles onend and onerror properly', () => {
        const { result } = renderHook(() => useVoiceInput());

        act(() => {
            result.current.startListening();
        });
        expect(result.current.isListening).toBe(true);

        act(() => {
            instance.onerror?.({ error: 'network' });
        });
        expect(result.current.isListening).toBe(false);

        act(() => {
            result.current.startListening();
        });
        expect(result.current.isListening).toBe(true);

        act(() => {
            instance.onend?.();
        });
        expect(result.current.isListening).toBe(false);
    });

    it('aborts recognition on unmount', () => {
        const { unmount } = renderHook(() => useVoiceInput());
        unmount();
        expect(mockAbort).toHaveBeenCalled();
    });
});
