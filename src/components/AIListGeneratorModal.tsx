import React, { useState, useEffect, useRef } from 'react';
import { X, Folder, Loader2, Wand2, AlertTriangle, Sparkles, Mic, MicOff, ChevronDown } from 'lucide-react';
import { Category, Item, Section } from '../types';
import { generateListContent, GeneratedList, AVAILABLE_GEMINI_MODELS } from '../services/aiService';
import { useVoiceInput } from '../hooks/useVoiceInput';
import geminiIconUrl from '../assets/gemini.svg';

interface AIListGeneratorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (name: string, items: Item[], categoryId: string, aiPrompt?: string, sections?: Section[]) => Promise<void>;
    categories: Category[];
    onAddCategory?: (name: string) => Promise<string>;
}

export const AIListGeneratorModal: React.FC<AIListGeneratorModalProps> = ({ isOpen, onClose, onSave, categories, onAddCategory }) => {
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [generatedList, setGeneratedList] = useState<GeneratedList | null>(null);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);
    const [isCreatingCategory, setIsCreatingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [errorDetails, setErrorDetails] = useState<string | null>(null);
    const [isErrorDetailsOpen, setIsErrorDetailsOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'flat' | 'categories'>('flat');
    const [selectedModel, setSelectedModel] = useState<string>(() => {
        try {
            return localStorage.getItem('looplist_gemini_model') || import.meta.env.VITE_GEMINI_MODEL || AVAILABLE_GEMINI_MODELS[0].id;
        } catch {
            return import.meta.env.VITE_GEMINI_MODEL || AVAILABLE_GEMINI_MODELS[0].id;
        }
    });

    // Automatically set viewMode based on whether categories exist
    useEffect(() => {
        if (generatedList?.categories?.length) {
            setViewMode('categories');
        } else {
            setViewMode('flat');
        }
    }, [generatedList]);

    const handleModelChange = (modelId: string) => {
        setSelectedModel(modelId);
        try {
            localStorage.setItem('looplist_gemini_model', modelId);
        } catch {
            // ignore
        }
    };

    const basePromptRef = useRef('');
    const { isListening, transcript, startListening, stopListening, resetTranscript, hasSupport } = useVoiceInput();

    useEffect(() => {
        if (isListening && transcript) {
            const combined = basePromptRef.current
                ? `${basePromptRef.current.trim()} ${transcript.trim()}`
                : transcript;
            setPrompt(combined);
            setError('');
        }
    }, [isListening, transcript]);

    const handleToggleVoiceInput = () => {
        if (isListening) {
            stopListening();
        } else {
            basePromptRef.current = prompt;
            resetTranscript();
            startListening();
        }
    };

    useEffect(() => {
        if (isOpen && categories.length > 0 && !selectedCategoryId) {
            setSelectedCategoryId(categories[0].id);
        }
    }, [isOpen, categories, selectedCategoryId]);

    const isDuplicateCategory = React.useMemo(() => {
        if (!isCreatingCategory) return false;
        const trimmed = (newCategoryName || '').trim().toLowerCase();
        if (!trimmed) return false;
        return (categories || []).some((c) => (c?.name || '').trim().toLowerCase() === trimmed);
    }, [isCreatingCategory, newCategoryName, categories]);

    if (!isOpen) return null;

    const handleClose = () => {
        if (isListening) {
            stopListening();
        }
        resetTranscript();
        setPrompt('');
        setError('');
        setErrorDetails(null);
        setIsErrorDetailsOpen(false);
        setGeneratedList(null);
        setIsLoading(false);
        setIsCreatingCategory(false);
        setNewCategoryName('');
        onClose();
    };

    const handleGenerate = async () => {
        if (isListening) {
            stopListening();
        }
        if (!prompt.trim()) {
            setError('Vänligen beskriv vad du vill ha för lista först.');
            return;
        }

        setIsLoading(true);
        setError('');
        setErrorDetails(null);
        setIsErrorDetailsOpen(false);
        setGeneratedList(null);

        try {
            const result = await generateListContent(prompt, selectedModel);
            setGeneratedList(result);
            // Auto-select categories view if AI returned categories
            setViewMode(result.categories && result.categories.length > 0 ? 'categories' : 'flat');
        } catch (err) {
            let message = 'Ett oväntat fel uppstod vid generering.';
            let details: string | null = null;
            if (err instanceof Error) {
                message = err.message;
                if ('rawDetails' in err && typeof (err as { rawDetails?: unknown }).rawDetails === 'string') {
                    details = (err as { rawDetails: string }).rawDetails;
                } else {
                    details = err.stack || err.message;
                }
            } else if (typeof err === 'string') {
                message = err;
                details = err;
            }
            setError(message);
            setErrorDetails(details);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!generatedList) return;

        if (isCreatingCategory) {
            if (!newCategoryName.trim()) {
                setError('Vänligen ange ett namn för den nya kategorin.');
                return;
            }
            if (isDuplicateCategory) {
                setError('En kategori med detta namn finns redan.');
                return;
            }
            if (!onAddCategory) {
                setError('Det går tyvärr inte att skapa en kategori just nu.');
                return;
            }
        } else if (!selectedCategoryId) {
            setError('Vänligen välj en kategori.');
            return;
        }

        setIsSaving(true);
        setError('');
        setErrorDetails(null);

        try {
            let targetCategoryId = selectedCategoryId;
            if (isCreatingCategory && onAddCategory) {
                targetCategoryId = await onAddCategory(newCategoryName);
            }

            let sections: Section[] | undefined;
            let formattedItems: Item[];

            if (viewMode === 'categories' && generatedList.categories && generatedList.categories.length > 0) {
                // Build Section objects
                sections = generatedList.categories.map((cat, i) => ({
                    id: crypto.randomUUID(),
                    name: cat.name,
                    order: i,
                }));
                // Assign sectionId to each item
                formattedItems = generatedList.categories.flatMap((cat, catIdx) =>
                    cat.items.map(text => ({
                        id: crypto.randomUUID(),
                        text,
                        completed: false,
                        sectionId: sections![catIdx].id,
                    }))
                );
            } else {
                formattedItems = generatedList.items.map(text => ({
                    id: crypto.randomUUID(),
                    text,
                    completed: false
                }));
            }

            await onSave(generatedList.title, formattedItems, targetCategoryId, prompt, sections);
            handleClose();
        } catch (err) {
            setError('Kunde inte spara listan. Vänligen försök igen.');
            setErrorDetails(err instanceof Error ? err.stack || err.message : String(err));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden transform transition-all">
                <div className="p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                            <img src={geminiIconUrl} alt="Gemini" className="w-5 h-5 drop-shadow-sm" />
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                Skapa lista med AI
                            </h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <select
                                    id="ai-model-select"
                                    aria-label="Välj AI-modell"
                                    value={selectedModel}
                                    onChange={(e) => handleModelChange(e.target.value)}
                                    disabled={isLoading || isSaving}
                                    className="text-xs bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-lg pl-2.5 pr-7 py-1.5 font-medium outline-none focus:ring-2 focus:ring-purple-500 appearance-none cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {AVAILABLE_GEMINI_MODELS.map((m) => (
                                        <option key={m.id} value={m.id}>
                                            {m.name} ({m.description})
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-purple-600 dark:text-purple-400" />
                            </div>
                            <button
                                onClick={handleClose}
                                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors p-1 rounded-lg"
                                aria-label="Stäng"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-3">
                            {!generatedList && (
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Beskriv vilken typ av lista du vill skapa, till exempel &quot;Packlista för weekend i Sthlm&quot; eller &quot;Ingredienser för lasagne&quot;.
                                </p>
                            )}

                            <div className="relative">
                                <textarea
                                    value={prompt}
                                    onChange={(e) => {
                                        setPrompt(e.target.value);
                                        basePromptRef.current = e.target.value;
                                        setError('');
                                    }}
                                    placeholder="Ex: Packlista för en snowboardresa i fjällen..."
                                    className={`w-full p-4 pr-12 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 text-sm focus:ring-2 focus:ring-purple-500 outline-none resize-none transition-all placeholder:text-gray-400 disabled:opacity-60 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed ${generatedList ? 'h-20' : 'h-32'}`}
                                    disabled={isLoading || isSaving}
                                />
                                {hasSupport && (
                                    <button
                                        type="button"
                                        onClick={handleToggleVoiceInput}
                                        disabled={isLoading || isSaving}
                                        title={isListening ? 'Sluta lyssna' : 'Tala in prompt (röstinmatning)'}
                                        aria-label={isListening ? 'Sluta lyssna' : 'Tala in prompt'}
                                        className={`absolute right-3 bottom-3 p-2 rounded-lg transition-all flex items-center justify-center cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                                            isListening
                                                ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse shadow-md shadow-red-500/30'
                                                : 'text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30'
                                        }`}
                                    >
                                        {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                                    </button>
                                )}
                            </div>

                            {isListening && (
                                <div className="flex items-center gap-2 text-xs text-red-500 dark:text-red-400 font-medium px-1 animate-pulse" role="status">
                                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping inline-block" />
                                    <span>Lyssnar... tala in din prompt</span>
                                </div>
                            )}

                            {error && !generatedList && (
                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-200 mt-2 shadow-sm border-l-4 border-l-red-500">
                                    <AlertTriangle className="text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" size={18} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <h4 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-1">Ett fel uppstod</h4>
                                                <p className="text-sm text-red-600 dark:text-red-400 leading-relaxed break-words">{error}</p>
                                            </div>
                                            <button 
                                                onClick={handleGenerate}
                                                className="text-xs font-bold text-red-700 dark:text-red-400 hover:underline uppercase tracking-wider ml-4 mt-0.5 whitespace-nowrap cursor-pointer"
                                            >
                                                Försök igen
                                            </button>
                                        </div>

                                        {errorDetails && (
                                            <div className="mt-3 pt-2.5 border-t border-red-200/60 dark:border-red-800/60">
                                                <button
                                                    type="button"
                                                    onClick={() => setIsErrorDetailsOpen(!isErrorDetailsOpen)}
                                                    className="flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100 transition-colors cursor-pointer"
                                                    aria-expanded={isErrorDetailsOpen}
                                                >
                                                    <ChevronDown
                                                        size={14}
                                                        className={`transition-transform duration-200 ${isErrorDetailsOpen ? 'rotate-180' : ''}`}
                                                    />
                                                    <span>{isErrorDetailsOpen ? 'Dölj felmeddelande från modellen' : 'Visa felmeddelande från modellen'}</span>
                                                </button>
                                                {isErrorDetailsOpen && (
                                                    <div className="mt-2 p-3 bg-red-100/70 dark:bg-black/40 rounded-lg border border-red-200/80 dark:border-red-800/80 text-xs font-mono text-red-950 dark:text-red-200 overflow-x-auto max-h-56 whitespace-pre-wrap break-words select-all">
                                                        {errorDetails}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {!generatedList && (
                                <div className="flex justify-end pt-2">
                                    <button
                                        onClick={handleGenerate}
                                        disabled={isLoading || !prompt.trim()}
                                        className="px-6 py-2.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="animate-spin" size={16} />
                                                Skapar förslag...
                                            </>
                                        ) : (
                                            <>
                                                <Wand2 size={16} />
                                                Generera list-förslag
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                        {generatedList && (
                            <div className="animate-in fade-in zoom-in-95 duration-200 space-y-4">
                                {/* Preview result header with re-generate option */}
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-1.5">
                                        <Sparkles className="text-purple-500" size={12} />
                                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Förslag</span>
                                    </div>
                                    <button
                                        onClick={handleGenerate}
                                        disabled={isLoading || !prompt.trim()}
                                        className="text-xs font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 flex items-center gap-1 transition-colors disabled:opacity-50"
                                    >
                                        {isLoading ? <Loader2 className="animate-spin" size={12} /> : <Wand2 size={12} />}
                                        {isLoading ? 'Uppdaterar...' : 'Generera om'}
                                    </button>
                                </div>
                                {/* Preview result */}
                                <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800/50 rounded-xl p-5 mb-5">
                                    <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-3 pb-3 border-b border-purple-200 dark:border-purple-800">
                                        {generatedList.title}
                                    </h4>

                                    {/* View mode toggle – only when AI returned categories */}
                                    {generatedList.categories && generatedList.categories.length > 0 && (
                                        <div className="flex gap-1 mb-4 p-1 bg-purple-100/60 dark:bg-purple-900/30 rounded-lg w-fit">
                                            <button
                                                onClick={() => setViewMode('categories')}
                                                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                                                    viewMode === 'categories'
                                                        ? 'bg-white dark:bg-gray-800 text-purple-700 dark:text-purple-300 shadow-sm'
                                                        : 'text-purple-500 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-200'
                                                }`}
                                            >
                                                Med kategorier
                                            </button>
                                            <button
                                                onClick={() => setViewMode('flat')}
                                                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                                                    viewMode === 'flat'
                                                        ? 'bg-white dark:bg-gray-800 text-purple-700 dark:text-purple-300 shadow-sm'
                                                        : 'text-purple-500 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-200'
                                                }`}
                                            >
                                                Platt lista
                                            </button>
                                        </div>
                                    )}

                                    {viewMode === 'categories' && generatedList.categories && generatedList.categories.length > 0 ? (
                                        <div className="space-y-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                            {generatedList.categories.map((cat) => (
                                                <div key={cat.name}>
                                                    <h5 className="text-xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-1.5">
                                                        {cat.name}
                                                    </h5>
                                                    <ul className="space-y-1.5">
                                                        {cat.items.map((item, i) => (
                                                            <li key={i} className="flex items-start gap-2">
                                                                <span className="text-purple-400 mt-1 flex-shrink-0">•</span>
                                                                <span className="text-gray-700 dark:text-gray-300 text-sm">{item}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <ul className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                            {generatedList.items.map((item, index) => (
                                                <li key={index} className="flex items-start gap-2">
                                                    <span className="text-purple-500 mt-1 flex-shrink-0">•</span>
                                                    <span className="text-gray-700 dark:text-gray-300 text-sm">{item}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>

                                <div className="space-y-2 mb-6">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Spara listan i kategori
                                    </label>
                                    
                                    {!isCreatingCategory ? (
                                        <div className="flex items-center gap-2">
                                            <div className="relative flex-1">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                                                    <Folder size={16} />
                                                </div>
                                                <select
                                                    value={selectedCategoryId}
                                                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                                                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 outline-none appearance-none"
                                                    disabled={isSaving}
                                                >
                                                    {categories.length === 0 && <option value="">Inga kategorier</option>}
                                                    {categories.map((cat) => (
                                                        <option key={cat.id} value={cat.id}>
                                                            {cat.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            {onAddCategory && (
                                                <button 
                                                    onClick={() => setIsCreatingCategory(true)}
                                                    className="px-3 py-2.5 text-sm font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/40 rounded-lg transition-colors whitespace-nowrap"
                                                    disabled={isSaving}
                                                >
                                                    Ny kategori
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={newCategoryName}
                                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                                    placeholder="Ny kategori..."
                                                    className={`w-full flex-1 px-4 py-2.5 bg-white dark:bg-gray-900 border ${isDuplicateCategory ? 'border-red-500 focus:ring-red-500' : 'border-purple-300 dark:border-purple-700 focus:ring-purple-500'} rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 outline-none`}
                                                    disabled={isSaving}
                                                    autoFocus
                                                />
                                                <button 
                                                    onClick={() => {
                                                        setIsCreatingCategory(false);
                                                        setNewCategoryName('');
                                                    }}
                                                    className="p-2.5 text-gray-500 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                                    disabled={isSaving}
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                            {isDuplicateCategory && (
                                                <p className="text-xs text-red-500 dark:text-red-400 font-medium pl-1 animate-in fade-in duration-200">
                                                    En kategori med detta namn finns redan
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {error && (
                                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-200 shadow-sm border-l-4 border-l-red-500">
                                        <AlertTriangle className="text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" size={18} />
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-1">Kunde inte spara</h4>
                                            <p className="text-sm text-red-600 dark:text-red-400 leading-relaxed break-words">{error}</p>
                                            {errorDetails && (
                                                <div className="mt-3 pt-2.5 border-t border-red-200/60 dark:border-red-800/60">
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsErrorDetailsOpen(!isErrorDetailsOpen)}
                                                        className="flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100 transition-colors cursor-pointer"
                                                        aria-expanded={isErrorDetailsOpen}
                                                    >
                                                        <ChevronDown
                                                            size={14}
                                                            className={`transition-transform duration-200 ${isErrorDetailsOpen ? 'rotate-180' : ''}`}
                                                        />
                                                        <span>{isErrorDetailsOpen ? 'Dölj felmeddelande från modellen' : 'Visa felmeddelande från modellen'}</span>
                                                    </button>
                                                    {isErrorDetailsOpen && (
                                                        <div className="mt-2 p-3 bg-red-100/70 dark:bg-black/40 rounded-lg border border-red-200/80 dark:border-red-800/80 text-xs font-mono text-red-950 dark:text-red-200 overflow-x-auto max-h-56 whitespace-pre-wrap break-words select-all">
                                                            {errorDetails}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                                    <button
                                        onClick={() => setGeneratedList(null)}
                                        disabled={isSaving}
                                        className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        Kasta
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className="px-6 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {isSaving ? (
                                            <>
                                                <Loader2 className="animate-spin" size={16} />
                                                Sparar...
                                            </>
                                        ) : (
                                            'Spara i mina listor'
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
