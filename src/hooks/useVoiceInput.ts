import { useState, useEffect, useCallback } from 'react';

interface UseVoiceInputReturn {
    isListening: boolean;
    transcript: string;
    startListening: () => void;
    stopListening: () => void;
    resetTranscript: () => void;
    hasSupport: boolean;
}

// Minimal type definitions for the Web Speech API
interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}



interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    abort(): void;
    onresult: (event: SpeechRecognitionEvent) => void;
    onerror: (event: { error: unknown }) => void;
    onend: () => void;
}

interface WindowWithSpeech extends Window {
    webkitSpeechRecognition?: new () => SpeechRecognition;
    SpeechRecognition?: new () => SpeechRecognition;
}

export const useVoiceInput = (): UseVoiceInputReturn => {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [hasSupport, setHasSupport] = useState(() => {
        if (typeof window === 'undefined') return false;
        const w = window as unknown as WindowWithSpeech;
        return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
    });
    const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);

    useEffect(() => {
        const SpeechRecognitionClass = (globalThis as unknown as WindowWithSpeech).webkitSpeechRecognition || (globalThis as unknown as WindowWithSpeech).SpeechRecognition;
        
        if (SpeechRecognitionClass) {
            const recognitionInstance = new SpeechRecognitionClass();
            recognitionInstance.continuous = true;
            recognitionInstance.interimResults = true;
            recognitionInstance.lang = 'sv-SE';

            recognitionInstance.onresult = (event: SpeechRecognitionEvent) => {
                let currentTranscript = '';
                for (let i = 0; i < event.results.length; ++i) {
                    currentTranscript += event.results[i][0].transcript;
                }
                setTranscript(currentTranscript);
            };

            recognitionInstance.onerror = (event: { error: unknown }) => {
                console.error('Speech recognition error', event.error);
                setIsListening(false);
            };

            recognitionInstance.onend = () => {
                setIsListening(false);
            };

            setRecognition(recognitionInstance);
            setHasSupport(true);
        } else {
            setHasSupport(false);
        }
    }, []);

    useEffect(() => {
        return () => {
            if (recognition) {
                try {
                    recognition.abort();
                } catch {
                    // ignore if already closed
                }
            }
        };
    }, [recognition]);

    const startListening = useCallback(() => {
        if (recognition && !isListening) {
            try {
                setTranscript('');
                recognition.start();
                setIsListening(true);
            } catch (error) {
                console.error("Failed to start recognition:", error);
            }
        }
    }, [recognition, isListening]);

    const stopListening = useCallback(() => {
        if (recognition && isListening) {
            recognition.stop();
            setIsListening(false);
        }
    }, [recognition, isListening]);

    const resetTranscript = useCallback(() => {
        setTranscript('');
    }, []);

    return {
        isListening,
        transcript,
        startListening,
        stopListening,
        resetTranscript,
        hasSupport
    };
};
