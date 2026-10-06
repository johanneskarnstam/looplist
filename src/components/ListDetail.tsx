import React, { useState, useEffect, useRef } from 'react';
import { useParams, useBlocker, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import type { Item, ListSettings, List } from '../types';
import { DndContext, closestCenter, pointerWithin, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent, type CollisionDetection, useDroppable } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SortableItem } from './SortableItem';
import { Plus, ChevronLeft, Settings, RotateCcw, ChevronDown, Trash2, Edit2, Pin, EyeOff, FolderInput, MoreVertical, Copy, Check, Download, Archive, ArchiveRestore, Upload, GripVertical } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Modal } from './Modal';
import { ImportFromListModal } from './ImportFromListModal';
import { ExportListModal } from './ExportListModal';
import { ImportJsonToListModal } from './ImportJsonToListModal';
import geminiIconUrl from '../assets/gemini.svg';
import { sortAndFilterItems, groupItemsBySection, type SortMode } from '../utils/itemUtils';
import { toLocalISOString, getNextFullHour, buildGoogleCalendarUrl } from '../utils/calendarUtils';

import { useTranslation } from 'react-i18next';

/**
 * Detailed view for a single list.
 * Supports adding items, toggling states (normal/three-stage), 
 * sorting, and reordering items via drag and drop.
 */
const DroppableSection = ({ sectionId, children, className, isOverClassName }: { sectionId: string; children: React.ReactNode; className?: string; isOverClassName?: string }) => {
    const { setNodeRef, isOver } = useDroppable({ id: sectionId });
    return (
        <div ref={setNodeRef} className={`${className || ''} ${isOver ? (isOverClassName || 'ring-2 ring-blue-500/50 bg-blue-50/40 dark:bg-blue-900/30 rounded-2xl') : ''}`}>
            {children}
        </div>
    );
};

interface SortableSectionItemProps {
    section: { id: string; name: string; order?: number };
    editingSectionId: string | null;
    editedSectionName: string;
    setEditedSectionName: (name: string) => void;
    setEditingSectionId: (id: string | null) => void;
    handleUpdateSection: (id: string) => void;
    setDeleteSectionId: (id: string) => void;
}

const SortableSectionItem: React.FC<SortableSectionItemProps> = ({
    section,
    editingSectionId,
    editedSectionName,
    setEditedSectionName,
    setEditingSectionId,
    handleUpdateSection,
    setDeleteSectionId,
}) => {
    const isEditing = editingSectionId === section.id;
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: section.id, disabled: isEditing });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 ${isDragging ? 'z-50 opacity-50 shadow-md ring-2 ring-blue-500/50' : ''}`}
        >
            {isEditing ? (
                <>
                    <input
                        type="text"
                        value={editedSectionName}
                        onChange={(e) => setEditedSectionName(e.target.value)}
                        className="flex-1 p-1 rounded border border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        autoFocus
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUpdateSection(section.id);
                            if (e.key === 'Escape') {
                                setEditingSectionId(null);
                                setEditedSectionName('');
                            }
                        }}
                    />
                    <button
                        type="button"
                        onClick={() => handleUpdateSection(section.id)}
                        className="p-1 text-green-600 hover:text-green-700"
                        title="Save"
                        aria-label="Save section name"
                    >
                        ✓
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setEditingSectionId(null);
                            setEditedSectionName('');
                        }}
                        className="p-1 text-gray-600 hover:text-gray-700"
                        title="Cancel"
                        aria-label="Cancel editing section"
                    >
                        ✕
                    </button>
                </>
            ) : (
                <>
                    <div
                        {...attributes}
                        {...listeners}
                        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 touch-none flex-shrink-0 p-0.5"
                        aria-label="Drag to reorder section"
                    >
                        <GripVertical size={16} />
                    </div>
                    <span className="flex-1 text-sm text-gray-900 dark:text-gray-100 truncate">
                        {section.name}
                    </span>
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => {
                                setEditingSectionId(section.id);
                                setEditedSectionName(section.name);
                            }}
                            className="p-1 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                            title="Edit"
                            aria-label="Edit section"
                        >
                            <Edit2 size={14} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setDeleteSectionId(section.id)}
                            className="p-1 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                            title="Delete"
                            aria-label="Delete section"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export const ListDetail: React.FC = React.memo(() => {
    const { t } = useTranslation();
    const { listId } = useParams<{ listId: string }>();
    const { lists, updateListItems, deleteItem, updateListName, updateListSettings, updateListAccess, archiveList, addSection, updateSection, deleteSection, reorderSections, deleteList, importItemsFromList, importJsonToList } = useApp();
    const [newItemText, setNewItemText] = useState('');
    const [showAddItemField, setShowAddItemField] = useState(false);
    const [uncheckModalOpen, setUncheckModalOpen] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editedTitle, setEditedTitle] = useState('');
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [calendarAccordionOpen, setCalendarAccordionOpen] = useState(false);
    const [calendarEventTitle, setCalendarEventTitle] = useState('');
    const [newSectionName, setNewSectionName] = useState('');
    const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
    const [editedSectionName, setEditedSectionName] = useState('');
    const [deletingSectionId, setDeleteSectionId] = useState<string | null>(null);
    const [unpinConfirmOpen, setUnpinConfirmOpen] = useState(false);
    const [completedAccordionOpen, setCompletedAccordionOpen] = useState(false);
    const [importFromListOpen, setImportFromListOpen] = useState(false);
    const [exportModalOpen, setExportModalOpen] = useState(false);
    const [importJsonModalOpen, setImportJsonModalOpen] = useState(false);
    const [moreMenuOpen, setMoreMenuOpen] = useState(false);
    const [promptCopied, setPromptCopied] = useState(false);
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
        if (!listId) return {};
        try {
            const saved = localStorage.getItem(`looplist_collapsed_${listId}`);
            return saved ? JSON.parse(saved) : {};
        } catch {
            return {};
        }
    });
    const [quickAddSectionId, setQuickAddSectionId] = useState<string | null>(null);
    const [quickAddText, setQuickAddText] = useState('');
    const moreMenuRef = useRef<HTMLDivElement>(null);
    const addItemRef = useRef<HTMLFormElement>(null);
    const navigate = useNavigate();
    const { hash } = useLocation();

    const list: List | undefined = lists.find((l) => l.id === listId);

    // Sync collapsed state with localStorage on listId change
    useEffect(() => {
        if (!listId) return;
        try {
            const saved = localStorage.getItem(`looplist_collapsed_${listId}`);
            setCollapsedSections(saved ? JSON.parse(saved) : {});
        } catch {
            setCollapsedSections({});
        }
    }, [listId]);

    // Handle click outside and Escape key for add item field
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (addItemRef.current && !addItemRef.current.contains(event.target as Node)) {
                setShowAddItemField(false);
                setNewItemText('');
            }
        };

        const handleEscapeKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && showAddItemField) {
                setShowAddItemField(false);
                setNewItemText('');
            }
        };

        if (showAddItemField) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscapeKey);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscapeKey);
        };
    }, [showAddItemField]);

    const toggleSectionCollapse = (sectionKey: string) => {
        setCollapsedSections(prev => {
            const next = { ...prev, [sectionKey]: !prev[sectionKey] };
            if (listId) {
                try {
                    localStorage.setItem(`looplist_collapsed_${listId}`, JSON.stringify(next));
                } catch (e) {
                    console.error('Failed to save collapsed sections state', e);
                }
            }
            return next;
        });
    };

    const handleQuickAdd = async (sectionId?: string) => {
        if (quickAddText.trim() && list) {
            const newItem: Item = {
                id: uuidv4(),
                text: quickAddText.trim(),
                completed: false,
                sectionId: sectionId
            };
            await updateListItems(list.id, [...list.items, newItem]);
            setQuickAddText('');
        }
    };

    // Close more-menu when clicking outside
    useEffect(() => {
        if (!moreMenuOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
                setMoreMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [moreMenuOpen]);

    // Block navigation if the list is pinned
    const blocker = useBlocker(
        ({ currentLocation, nextLocation }) =>
            !!list?.settings?.pinned &&
            currentLocation.pathname !== nextLocation.pathname
    );

    useEffect(() => {
        if (blocker.state === 'blocked') {
            setUnpinConfirmOpen(true);
        }
    }, [blocker.state]);


    React.useEffect(() => {
        if (list) {
            document.title = `LoopList - ${list.name}`;
            setEditedTitle(list.name);
            updateListAccess(list.id);
        }
    }, [list?.id, list?.name]);

    useEffect(() => {
        if (listId) {
            updateListAccess(listId);
        }
    }, [listId]);

    // Handle direct settings navigation via hash
    useEffect(() => {
        if (hash === '#settings') {
            setSettingsOpen(true);
        }
    }, [hash]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const collisionDetectionStrategy: CollisionDetection = (args) => {
        // First, check pointerWithin
        const pointerCollisions = pointerWithin(args);
        if (pointerCollisions.length > 0) {
            // Prioritize sortable item collisions over section container collisions
            const itemCollision = pointerCollisions.find(
                (c) => c.id !== '__unsectioned__' && !list?.sections?.some(s => s.id === c.id)
            );
            if (itemCollision) {
                return [itemCollision];
            }
            return pointerCollisions;
        }

        // Fallback to closestCenter
        return closestCenter(args);
    };

    const [sortBy, setSortBy] = useState<SortMode>('manual');
    const threeStageMode = list?.settings?.threeStageMode ?? false;

    // Calendar helpers now live in calendarUtils (getNextFullHour, toLocalISOString, buildGoogleCalendarUrl)

    // Calendar time state with defaults
    const [calendarStartTime, setCalendarStartTime] = useState(() =>
        list?.settings?.calendarStartTime || getNextFullHour()
    );
    const [calendarEndTime, setCalendarEndTime] = useState(() => {
        if (list?.settings?.calendarEndTime) return list.settings.calendarEndTime;

        // Default to start time + 1 hour
        const startStr = list?.settings?.calendarStartTime || getNextFullHour();
        const endDate = new Date(startStr);
        endDate.setHours(endDate.getHours() + 1);
        return toLocalISOString(endDate);
    });

    // EFFECT: Refresh start time to next full hour if it's in the past when accordion opens
    useEffect(() => {
        if (calendarAccordionOpen) {
            const now = new Date();
            const currentStart = new Date(calendarStartTime);
            if (currentStart < now) {
                const nextHourStr = getNextFullHour();
                setCalendarStartTime(nextHourStr);

                // Also adjust end time to be 1 hour after the NEW start time
                const nextHourDate = new Date(nextHourStr);
                const endDate = new Date(nextHourDate);
                endDate.setHours(endDate.getHours() + 1);
                setCalendarEndTime(toLocalISOString(endDate));
            }
        }
    }, [calendarAccordionOpen]);

    // EFFECT: Ensure end time is not before start time when start time changes
    useEffect(() => {
        const start = new Date(calendarStartTime);
        const end = new Date(calendarEndTime);
        if (end <= start) {
            const newEnd = new Date(start);
            newEnd.setHours(newEnd.getHours() + 1);
            setCalendarEndTime(toLocalISOString(newEnd));
        }
    }, [calendarStartTime]);

    // Load sort setting from list or default to manual
    useEffect(() => {
        if (list?.settings?.defaultSort) {
            setSortBy(list.settings.defaultSort);
        }
    }, [list?.settings?.defaultSort]);

    // Memoized sort of items based on current settings
    const { activeItems, completedItems } = React.useMemo(() => {
        if (!list) return { activeItems: [], completedItems: [] };
        return sortAndFilterItems(
            list.items,
            sortBy,
            threeStageMode,
            list.settings?.hideCompleted
        );
    }, [list, sortBy, threeStageMode]);

    // Update calendar event title when list name changes
    React.useEffect(() => {
        if (list) {
            setCalendarEventTitle(list.name);
        }
    }, [list?.name]);

    if (!list) return <div className="text-center py-10">{t('lists.notFound')}</div>;

    /**
     * Adds a new item to the current list.
     */
    const handleAddItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newItemText.trim()) {
            const newItem = { id: uuidv4(), text: newItemText.trim(), completed: false };
            await updateListItems(list.id, [...list.items, newItem]);
            setNewItemText('');
            setShowAddItemField(false);
        }
    };

    /**
     * Handles item reordering via drag and drop.
     * Supports moving items within a section and between sections.
     */
    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const activeItem = list.items.find((item) => item.id === active.id);
        if (!activeItem) return;

        // Check if dropped ON a section container directly (empty section or section header)
        const overSectionId = list.sections?.find(s => s.id === over.id)?.id;
        const overUnsectioned = over.id === '__unsectioned__';

        // If dropped on unsectioned directly
        if (overUnsectioned) {
            if (activeItem.sectionId !== undefined) {
                const updatedItems = list.items.map(item =>
                    item.id === active.id ? { ...item, sectionId: undefined } : item
                );
                await updateListItems(list.id, updatedItems);
            }
            return;
        }

        // If dropped on a section directly
        if (overSectionId) {
            if (activeItem.sectionId !== overSectionId) {
                // Move to new section (append to end)
                const updatedItems = list.items.map(item =>
                    item.id === active.id ? { ...item, sectionId: overSectionId } : item
                );
                await updateListItems(list.id, updatedItems);
            }
            return;
        }

        // Dropped on another item
        const overItem = list.items.find((item) => item.id === over.id);
        if (!overItem) return;

        const activeItemSectionId = activeItem.sectionId;
        const overItemSectionId = overItem.sectionId;

        // If moving between different sections (including moving to/from unsectioned)
        if (activeItemSectionId !== overItemSectionId) {
            const updatedItem = { ...activeItem, sectionId: overItemSectionId };
            const remainingItems = list.items.filter(item => item.id !== active.id);
            const overIndexInRemaining = remainingItems.findIndex(item => item.id === over.id);
            const newItems = [...remainingItems];
            newItems.splice(overIndexInRemaining, 0, updatedItem);
            await updateListItems(list.id, newItems);
        } else {
            // Reordering within the same section (or both unsectioned)
            const oldIndex = list.items.findIndex((item) => item.id === active.id);
            const newIndex = list.items.findIndex((item) => item.id === over.id);
            await updateListItems(list.id, arrayMove(list.items, oldIndex, newIndex));
        }
    };

    /**
     * Cycles an item through its possible states.
     * In normal mode: unresolved <-> completed
     * In three-stage mode: unresolved -> prepared -> completed -> unresolved
     */
    const handleToggle = async (itemId: string) => {
        const newItems = list.items.map(item => {
            if (item.id !== itemId) return item;

            // Logic for state cycling
            let newState: 'unresolved' | 'ongoing' | 'completed';
            let newCompleted: boolean;

            if (threeStageMode) {
                // Cycle: unresolved -> ongoing -> completed -> unresolved
                if (item.completed) {
                    // Was completed, go to unresolved
                    newState = 'unresolved';
                    newCompleted = false;
                } else if (item.state === 'ongoing') {
                    // Was ongoing, go to completed
                    newState = 'completed';
                    newCompleted = true;
                } else {
                    // Was unresolved, go to ongoing
                    newState = 'ongoing';
                    newCompleted = false;
                }
            } else {
                // Normal toggle
                newCompleted = !item.completed;
                newState = newCompleted ? 'completed' : 'unresolved';
            }

            return { ...item, completed: newCompleted, state: newState };
        });
        await updateListItems(list.id, newItems);

        // Check if all items are now completed
        const allCompleted = newItems.every(item => item.completed);
        const isResettable = list.settings?.isResettable ?? true;
        if (allCompleted && newItems.length > 0 && isResettable) {
            setUncheckModalOpen(true);
        }
    };

    const handleDelete = async (itemId: string) => {
        await deleteItem(list.id, itemId);
    };

    const handleEdit = async (itemId: string, text: string) => {
        const newItems = list.items.map(item =>
            item.id === itemId ? { ...item, text } : item
        );
        await updateListItems(list.id, newItems);
    };

    const confirmUncheckAll = async () => {
        const newItems = list.items.map(item => ({ ...item, completed: false, state: 'unresolved' as const }));
        await updateListItems(list.id, newItems);
        setUncheckModalOpen(false);
    };

    const handleSaveTitle = async () => {
        if (editedTitle.trim()) {
            await updateListName(list.id, editedTitle.trim());
            setIsEditingTitle(false);
        }
    };

    const updateSettings = async (newSettings: Partial<typeof list.settings>) => {
        if (!list) return;
        const currentSettings = list.settings || { threeStageMode: false, defaultSort: 'manual' };
        const updated: ListSettings = { ...currentSettings, ...newSettings } as ListSettings;
        await updateListSettings(list.id, updated);
    };

    // Section management handlers
    const handleAddSection = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newSectionName.trim() && list) {
            await addSection(list.id, newSectionName.trim());
            setNewSectionName('');
        }
    };

    const handleUpdateSection = async (sectionId: string) => {
        if (editedSectionName.trim() && list) {
            await updateSection(list.id, sectionId, editedSectionName.trim());
            setEditingSectionId(null);
            setEditedSectionName('');
        }
    };

    const handleDeleteSection = async (sectionId: string) => {
        if (list) {
            await deleteSection(list.id, sectionId);
            setDeleteSectionId(null);
        }
    };

    const handleSectionDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id || !list?.sections) return;

        const sorted = [...list.sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        const oldIndex = sorted.findIndex((s) => s.id === active.id);
        const newIndex = sorted.findIndex((s) => s.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
            const reordered = arrayMove(sorted, oldIndex, newIndex);
            await reorderSections(list.id, reordered);
        }
    };

    // Helper function to group items by section (delegated to itemUtils)
    const groupedItemsBySection = (items: Item[]) => groupItemsBySection(items, list?.sections);

    /**
     * Ensures start time is in the future and returns valid times
     */
    const validateAndGetTimes = () => {
        if (!list) return;

        // Ensure start time is in the future
        const now = new Date();
        const start = new Date(calendarStartTime);
        if (start < now) {
            // If in the past, adjust to next full hour before proceeding
            const nextHourStr = getNextFullHour();
            setCalendarStartTime(nextHourStr);

            const nextHourDate = new Date(nextHourStr);
            const endDate = new Date(nextHourDate);
            endDate.setHours(endDate.getHours() + 1);
            const actualEnd = toLocalISOString(endDate);
            setCalendarEndTime(actualEnd);

            return { actualStart: nextHourStr, actualEnd: actualEnd };
        }
        return { actualStart: calendarStartTime, actualEnd: calendarEndTime };
    };

    /**
     * Generates a Google Calendar event URL with list details (via calendarUtils)
     */
    const generateGoogleCalendarLink = () => {
        if (!list) return;

        const times = validateAndGetTimes();
        if (!times) return;
        const { actualStart, actualEnd } = times;

        // Save the selected times to list settings
        updateSettings({ calendarStartTime: actualStart, calendarEndTime: actualEnd });

        const linkText = t('lists.settings.calendar.linkText');
        const url = buildGoogleCalendarUrl({
            title: calendarEventTitle || list.name,
            items: list.items,
            listId: list.id,
            startTime: actualStart,
            endTime: actualEnd,
            linkText,
        });

        window.open(url, '_blank');
    };

    // --- Validation Logic for UI ---
    const now = new Date();
    // We ignore seconds for the comparison to prevent minor mismatches (e.g. current seconds vs 00 seconds)
    const currentNowTime = now.getTime();
    const startDate = new Date(calendarStartTime);
    const endDate = new Date(calendarEndTime);

    // Is the start time in the past? (Allowing a buffer of 1 minute roughly)
    const isPast = startDate.getTime() < (currentNowTime - 60000);

    // Is the range invalid? (Start time is after or same as end time)
    const isRangeInvalid = startDate >= endDate;

    // Should the button be disabled?
    const isCalendarButtonDisabled = isPast || isRangeInvalid;

    return (
        <div className="space-y-6">
            {/* ... (header code) ... */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            if (list?.settings?.pinned) {
                                setUnpinConfirmOpen(true);
                            } else {
                                navigate('/');
                            }
                        }}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors flex-shrink-0"
                        title={t('common.back', 'Back')}
                    >
                        <ChevronLeft />
                    </button>
                    {isEditingTitle ? (
                        <div className="flex items-center gap-2 flex-1 mr-4 min-w-0">
                            <input
                                type="text"
                                value={editedTitle}
                                onChange={(e) => setEditedTitle(e.target.value)}
                                className="text-xl font-semibold bg-transparent border-b-2 border-blue-500 focus:outline-none w-full min-w-0"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveTitle();
                                    if (e.key === 'Escape') {
                                        setEditedTitle(list.name);
                                        setIsEditingTitle(false);
                                    }
                                }}
                                onBlur={handleSaveTitle}
                            />
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 group min-w-0 flex-1">
                            {(() => {
                                const truncatedName = list.name.length > 30 ? list.name.substring(0, 30) + "... " : list.name;
                                return <h2 className="text-xl font-semibold truncate" title={list.name}>{truncatedName}</h2>;
                            })()}
                            <button
                                onClick={() => setIsEditingTitle(true)}
                                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-blue-500 transition-all flex-shrink-0"
                                title={t('lists.editTitle')}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                                    <path d="m15 5 4 4" />
                                </svg>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {list?.archived && (
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 dark:bg-orange-800 rounded-full text-orange-600 dark:text-orange-400 flex-shrink-0">
                            <Archive size={18} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-orange-800 dark:text-orange-200">{t('lists.archivedBadge')}</p>
                            <p className="text-xs text-orange-600 dark:text-orange-400">{t('lists.archivedWarning')}</p>
                        </div>
                    </div>
                    <button
                        onClick={async () => {
                            await archiveList(list.id, false);
                        }}
                        className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex-shrink-0 cursor-pointer"
                    >
                        <ArchiveRestore size={15} />
                        <span>{t('lists.unarchive', 'Återaktivera lista')}</span>
                    </button>
                </div>
            )}

            {!list?.archived && (
                <>
                    {showAddItemField ? (
                        <form onSubmit={handleAddItem} ref={addItemRef} className="flex gap-2 animate-in fade-in slide-in-from-top-2 duration-150">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    value={newItemText}
                                    onChange={(e) => setNewItemText(e.target.value)}
                                    placeholder={t('lists.addItemPlaceholder')}
                                    className="w-full p-3 pr-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    autoFocus
                                />
                            </div>
                            <button
                                type="submit"
                                className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-md transition-colors"
                            >
                                <Plus />
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowAddItemField(false);
                                    setNewItemText('');
                                }}
                                className="p-3 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-300"
                                title={t('common.cancel', 'Avbryt')}
                            >
                                ✕
                            </button>
                        </form>
                    ) : (
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setShowAddItemField(true)}
                                className="p-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-700 transition-colors text-gray-600 dark:text-gray-300"
                                title={t('lists.addItemButton', 'Lägg till ny punkt')}
                            >
                                <Plus size={20} />
                            </button>
                            <button
                                type="button"
                                onClick={() => setUncheckModalOpen(true)}
                                disabled={!list.items.some(item => item.completed)}
                                className="p-3 bg-orange-50 dark:bg-orange-900/10 hover:bg-orange-100 dark:hover:bg-orange-900/20 rounded-xl transition-colors text-orange-600 dark:text-orange-400 disabled:opacity-40 disabled:cursor-not-allowed"
                                title={t('lists.reset', 'Återställ')}
                            >
                                <RotateCcw size={20} />
                            </button>
                        </div>
                    )}
                    
                    {/* Kebab / overflow menu */}
                    <div className="relative" ref={moreMenuRef}>
                        <button
                            type="button"
                            onClick={() => setMoreMenuOpen((prev) => !prev)}
                            title={t('common.more', 'Mer')}
                            className="p-3 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-300"
                        >
                            <MoreVertical size={20} />
                        </button>

                        {moreMenuOpen && (
                            <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">

                                {/* Import from list */}
                                <button
                                    type="button"
                                    onClick={() => { setMoreMenuOpen(false); setImportFromListOpen(true); }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                >
                                    <FolderInput size={16} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
                                    <span>{t('lists.importFromList.buttonTitle')}</span>
                                </button>

                                {/* Import JSON to list */}
                                <button
                                    type="button"
                                    onClick={() => { setMoreMenuOpen(false); setImportJsonModalOpen(true); }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                >
                                    <Upload size={16} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
                                    <span>{t('importJson.buttonTitle', 'Importera lista (JSON)')}</span>
                                </button>

                                {/* Export list */}
                                <button
                                    type="button"
                                    onClick={() => { setMoreMenuOpen(false); setExportModalOpen(true); }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                >
                                    <Download size={16} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
                                    <span>{t('export.buttonTitle', 'Exportera lista (JSON)')}</span>
                                </button>

                                {/* Archive */}
                                <button
                                    type="button"
                                    onClick={async () => {
                                        setMoreMenuOpen(false);
                                        await archiveList(list.id, true);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-orange-50 dark:hover:bg-orange-900/30 transition-colors"
                                >
                                    <Archive size={16} className="text-orange-500 dark:text-orange-400 flex-shrink-0" />
                                    <span>{t('lists.archive', 'Arkivera lista')}</span>
                                </button>

                                <div className="border-t border-gray-100 dark:border-gray-700" />

                                {/* Settings */}
                                <button
                                    type="button"
                                    onClick={() => { setMoreMenuOpen(false); setSettingsOpen(true); }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                >
                                    <Settings size={16} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
                                    <span>{t('lists.settings.title')}</span>
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}

            {list?.archived && (
                <div className="flex justify-end gap-2">
                    <button
                        onClick={async () => {
                            await archiveList(list.id, false);
                        }}
                        className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 transition-colors flex items-center gap-2 text-sm font-medium"
                    >
                        <ArchiveRestore size={18} />
                        {t('lists.unarchive', 'Återaktivera')}
                    </button>
                    <button
                        onClick={() => setSettingsOpen(true)}
                        className="p-3 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-300 flex items-center gap-2 text-sm font-medium"
                    >
                        <Settings size={20} />
                        {t('lists.settings.title')}
                    </button>
                </div>
            )}

            {(() => {
                const renderSectionCard = (
                    section: { id: string; name: string; order?: number } | undefined,
                    sectionItems: Item[],
                    isManualSort: boolean
                ) => {
                    const sectionKey = section ? section.id : '__unsectioned__';
                    const isCollapsed = !!collapsedSections[sectionKey];

                    const allItemsInSection = list.items.filter(item => (section ? item.sectionId === section.id : !item.sectionId));
                    const totalCount = allItemsInSection.length;
                    const completedCount = allItemsInSection.filter(item => item.completed).length;
                    const allDone = totalCount > 0 && completedCount === totalCount;
                    const isQuickAdding = quickAddSectionId === sectionKey;

                    const cardContent = (
                        <div className={`rounded-2xl border transition-all duration-200 ${
                            allDone
                                ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/50 dark:border-emerald-800/40'
                                : 'bg-gray-50/70 dark:bg-gray-800/40 border-gray-200/70 dark:border-gray-700/60'
                        } p-2.5 sm:p-3 shadow-sm`}>
                            {/* Header */}
                            <div className="flex items-center justify-between gap-2">
                                <button
                                    type="button"
                                    onClick={() => toggleSectionCollapse(sectionKey)}
                                    className="flex items-center gap-2 text-left flex-1 min-w-0 group/header focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg py-1 px-1 -mx-1 cursor-pointer"
                                    aria-label={isCollapsed ? t('lists.sections.expand') : t('lists.sections.collapse')}
                                    aria-expanded={!isCollapsed}
                                >
                                    <div className="p-1 rounded-md text-gray-400 group-hover/header:text-gray-600 dark:text-gray-500 dark:group-hover/header:text-gray-300 transition-colors">
                                        <ChevronDown
                                            size={18}
                                            className={`transform transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
                                        />
                                    </div>
                                    <h3 className="text-sm sm:text-base font-semibold text-gray-800 dark:text-gray-100 truncate">
                                        {section ? section.name : t('lists.sections.unsectioned')}
                                    </h3>

                                    {/* Counter badge */}
                                    {totalCount > 0 && (
                                        <span
                                            className={`text-xs px-2.5 py-0.5 rounded-full font-medium transition-colors border flex-shrink-0 ${
                                                allDone
                                                    ? 'bg-emerald-100/80 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 border-emerald-300/60 dark:border-emerald-700/60'
                                                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 shadow-2xs'
                                            }`}
                                        >
                                            {allDone
                                                ? `✓ ${t('lists.sections.itemsCountAllDone')}`
                                                : completedCount > 0
                                                ? t('lists.sections.itemsCount', { completed: completedCount, total: totalCount })
                                                : t('lists.sections.itemsCountTotal', { count: totalCount })}
                                        </span>
                                    )}
                                </button>

                                {/* Right side buttons */}
                                {!list?.archived && (
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (isCollapsed) {
                                                    toggleSectionCollapse(sectionKey);
                                                }
                                                setQuickAddSectionId(isQuickAdding ? null : sectionKey);
                                                setQuickAddText('');
                                            }}
                                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                                isQuickAdding
                                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                                                    : 'text-gray-400 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-gray-200/60 dark:hover:bg-gray-700/60'
                                            }`}
                                            title={t('lists.sections.quickAdd')}
                                            aria-label={t('lists.sections.quickAdd')}
                                        >
                                            <Plus size={18} />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Collapsible Content */}
                            {!isCollapsed && (
                                <div className="mt-2.5 space-y-2">
                                    {/* Quick Add Form */}
                                    {isQuickAdding && (
                                        <form
                                            onSubmit={(e) => {
                                                e.preventDefault();
                                                handleQuickAdd(section?.id);
                                            }}
                                            className="flex gap-2 p-2 bg-white dark:bg-gray-800 rounded-xl border border-blue-400/80 dark:border-blue-500/80 shadow-sm animate-in fade-in duration-150"
                                        >
                                            <input
                                                type="text"
                                                value={quickAddText}
                                                onChange={(e) => setQuickAddText(e.target.value)}
                                                placeholder={t('lists.sections.quickAddPlaceholder', { section: section ? section.name : t('lists.sections.unsectioned') })}
                                                className="flex-1 bg-transparent text-sm text-gray-900 dark:text-gray-100 outline-none px-1"
                                                autoFocus
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Escape') {
                                                        setQuickAddSectionId(null);
                                                        setQuickAddText('');
                                                    }
                                                }}
                                            />
                                            <button
                                                type="submit"
                                                disabled={!quickAddText.trim()}
                                                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:cursor-not-allowed"
                                            >
                                                {t('lists.sections.quickAddButton')}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setQuickAddSectionId(null);
                                                    setQuickAddText('');
                                                }}
                                                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs cursor-pointer"
                                                aria-label="Cancel"
                                            >
                                                ✕
                                            </button>
                                        </form>
                                    )}

                                    {/* Items */}
                                    {isManualSort ? (
                                        <SortableContext items={sectionItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                                            <div className="space-y-2">
                                                {sectionItems.map((item) => (
                                                    <SortableItem
                                                        key={item.id}
                                                        item={item}
                                                        onToggle={list?.archived ? undefined : handleToggle}
                                                        onDelete={list?.archived ? undefined : handleDelete}
                                                        onEdit={list?.archived ? undefined : handleEdit}
                                                        disabled={!isManualSort}
                                                        threeStageMode={threeStageMode}
                                                    />
                                                ))}
                                            </div>
                                        </SortableContext>
                                    ) : (
                                        <div className="space-y-2">
                                            {sectionItems.map((item) => (
                                                <SortableItem
                                                    key={item.id}
                                                    item={item}
                                                    onToggle={list?.archived ? undefined : handleToggle}
                                                    onDelete={list?.archived ? undefined : handleDelete}
                                                    onEdit={list?.archived ? undefined : handleEdit}
                                                    disabled={!isManualSort}
                                                    threeStageMode={threeStageMode}
                                                />
                                            ))}
                                        </div>
                                    )}

                                    {/* Empty State */}
                                    {sectionItems.length === 0 && !isQuickAdding && (
                                        <div className="text-center py-4 px-2 text-gray-400 dark:text-gray-500 text-xs sm:text-sm">
                                            <p>{t('lists.sections.emptySection')}</p>
                                            {!list?.archived && (
                                                <p className="text-[11px] sm:text-xs text-gray-400/80 dark:text-gray-500/80 mt-0.5">
                                                    {t('lists.sections.emptySectionHint')}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );

                    if (isManualSort) {
                        return (
                            <DroppableSection sectionId={sectionKey} key={sectionKey} className="min-h-[2.5rem]">
                                {cardContent}
                            </DroppableSection>
                        );
                    }

                    return (
                        <div key={sectionKey}>
                            {cardContent}
                        </div>
                    );
                };

                const groupedItems = groupedItemsBySection(activeItems);
                const sections = [...(list?.sections || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                const hasAnySections = sections.length > 0;

                if (!hasAnySections) {
                    if (sortBy === 'manual') {
                        return (
                            <DndContext sensors={sensors} collisionDetection={collisionDetectionStrategy} onDragEnd={handleDragEnd}>
                                <SortableContext items={activeItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                                    <div className="space-y-2">
                                        {activeItems.map((item) => (
                                            <SortableItem
                                                key={item.id}
                                                item={item}
                                                onToggle={list?.archived ? undefined : handleToggle}
                                                onDelete={list?.archived ? undefined : handleDelete}
                                                onEdit={list?.archived ? undefined : handleEdit}
                                                threeStageMode={threeStageMode}
                                            />
                                        ))}
                                        {activeItems.length === 0 && (
                                            <p className="text-center text-gray-500 mt-8">{t('lists.emptyList')}</p>
                                        )}
                                    </div>
                                </SortableContext>
                            </DndContext>
                        );
                    }

                    return (
                        <div className="space-y-2">
                            {activeItems.map((item) => (
                                <SortableItem
                                    key={item.id}
                                    item={item}
                                    onToggle={list?.archived ? undefined : handleToggle}
                                    onDelete={list?.archived ? undefined : handleDelete}
                                    onEdit={list?.archived ? undefined : handleEdit}
                                    disabled={true}
                                    threeStageMode={threeStageMode}
                                />
                            ))}
                            {activeItems.length === 0 && (
                                <p className="text-center text-gray-500 mt-8">{t('lists.emptyList')}</p>
                            )}
                        </div>
                    );
                }

                const unsectionedActiveItems = groupedItems.get(undefined) || [];
                const unsectionedAllItems = list.items.filter(item => !item.sectionId);
                const showUnsectioned = unsectionedAllItems.length > 0;

                const sectionsList = (
                    <div className="space-y-4">
                        {showUnsectioned && renderSectionCard(undefined, unsectionedActiveItems, sortBy === 'manual')}
                        {sections.map((section) => {
                            const sectionItems = groupedItems.get(section.id) || [];
                            return renderSectionCard(section, sectionItems, sortBy === 'manual');
                        })}
                        {activeItems.length === 0 && (
                            <p className="text-center text-gray-500 mt-8">{t('lists.emptyList')}</p>
                        )}
                    </div>
                );

                if (sortBy === 'manual') {
                    return (
                        <DndContext sensors={sensors} collisionDetection={collisionDetectionStrategy} onDragEnd={handleDragEnd}>
                            {sectionsList}
                        </DndContext>
                    );
                }

                return sectionsList;
            })()}

            {/* Completed Items Accordion (when hideCompleted is active) */}
            {list.settings?.hideCompleted && completedItems.length > 0 && (
                <div className="mt-8 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <button
                        onClick={() => setCompletedAccordionOpen(!completedAccordionOpen)}
                        className="flex items-center gap-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors w-full text-left p-2 group"
                    >
                        <ChevronDown
                            size={18}
                            className={`transform transition-transform duration-200 ${completedAccordionOpen ? '' : '-rotate-90'}`}
                        />
                        <span className="text-sm font-medium">
                            {t('lists.completedAccordion', { count: completedItems.length })}
                        </span>
                    </button>

                    {completedAccordionOpen && (
                        <div className="mt-2 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                            {completedItems.map((item) => (
                                <SortableItem
                                    key={item.id}
                                    item={item}
                                    onToggle={list?.archived ? undefined : handleToggle}
                                    onDelete={list?.archived ? undefined : handleDelete}
                                    onEdit={list?.archived ? undefined : handleEdit}
                                    threeStageMode={threeStageMode}
                                    disabled={true}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            <Modal
                isOpen={uncheckModalOpen}
                onClose={() => setUncheckModalOpen(false)}
                onConfirm={confirmUncheckAll}
                title={t('lists.resetTitle')}
                message={t('lists.resetMessage')}
                confirmText={t('lists.reset')}
            />
            <Modal
                isOpen={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                title={t('lists.settings.title')}
                message="" // Custom content
                confirmText={t('common.done')} // Or just close
                onConfirm={() => setSettingsOpen(false)}
            >
                <div className="space-y-1 pt-2">
                    {/* AI Generation Info */}
                    {list?.settings?.isAIGenerated && (
                        <div className="mb-4 p-4 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/10 border border-purple-200/60 dark:border-purple-700/40 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center gap-2">
                                <img src={geminiIconUrl} alt="Gemini" className="w-5 h-5 drop-shadow-sm" />
                                <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                                    {t('lists.settings.ai.generatedBy', 'Skapad med Gemini AI')}
                                </span>
                            </div>
                            {list.settings.aiPrompt && (
                                <div className="space-y-1.5">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 dark:text-purple-500/70">
                                        {t('lists.settings.ai.promptUsed', 'Prompt som användes')}
                                    </span>
                                    <div className="relative">
                                        <p className="text-sm text-gray-600 dark:text-gray-300 italic bg-white/70 dark:bg-gray-900/50 p-3 pr-10 rounded-xl border border-purple-100 dark:border-purple-800/30 leading-relaxed">
                                            &quot;{list.settings.aiPrompt}&quot;
                                        </p>
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(list.settings!.aiPrompt!);
                                                setPromptCopied(true);
                                                setTimeout(() => setPromptCopied(false), 2000);
                                            }}
                                            className="absolute top-2 right-2 p-1.5 rounded-lg text-purple-400 hover:text-purple-600 dark:hover:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-800/40 transition-all"
                                            title={promptCopied ? 'Kopierat!' : 'Kopiera prompt'}
                                        >
                                            {promptCopied
                                                ? <Check size={14} className="text-green-500" />
                                                : <Copy size={14} />}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Toggle rows */}
                    <div className="rounded-2xl border border-gray-100 dark:border-gray-700/60 overflow-hidden divide-y divide-gray-100 dark:divide-gray-700/60">
                        {/* Three Stage Mode */}
                        <div className="flex items-center justify-between px-4 py-3.5 bg-white dark:bg-gray-800/60">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('lists.settings.threeStage.title')}</span>
                                <span className="text-xs text-gray-400 dark:text-gray-500">{t('lists.settings.threeStage.description')}</span>
                            </div>
                            <button
                                onClick={() => updateSettings({ threeStageMode: !threeStageMode })}
                                className={`flex-shrink-0 w-11 h-6 rounded-full transition-colors relative ${threeStageMode ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-600'}`}
                            >
                                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${threeStageMode ? 'translate-x-5' : ''}`} />
                            </button>
                        </div>

                        {/* Resettable */}
                        <div className="flex items-center justify-between px-4 py-3.5 bg-white dark:bg-gray-800/60">
                            <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5">
                                    <RotateCcw size={13} className={(list?.settings?.isResettable ?? true) ? 'text-blue-500' : 'text-gray-400'} />
                                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('lists.settings.resettable.title', 'Reset Suggestion')}</span>
                                </div>
                                <span className="text-xs text-gray-400 dark:text-gray-500">{t('lists.settings.resettable.description', 'Ask to reset when all items are done')}</span>
                            </div>
                            <button
                                onClick={() => updateSettings({ isResettable: !(list?.settings?.isResettable ?? true) })}
                                className={`flex-shrink-0 w-11 h-6 rounded-full transition-colors relative ${(list?.settings?.isResettable ?? true) ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-600'}`}
                            >
                                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${(list?.settings?.isResettable ?? true) ? 'translate-x-5' : ''}`} />
                            </button>
                        </div>

                        {/* Pinned */}
                        <div className="flex items-center justify-between px-4 py-3.5 bg-white dark:bg-gray-800/60">
                            <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5">
                                    <Pin size={13} className={list?.settings?.pinned ? 'text-blue-500' : 'text-gray-400'} />
                                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('lists.settings.pinned.title', 'Fäst lista')}</span>
                                </div>
                                <span className="text-xs text-gray-400 dark:text-gray-500">{t('lists.settings.pinned.description', 'Öppna denna lista automatiskt när appen startar')}</span>
                            </div>
                            <button
                                onClick={() => updateSettings({ pinned: !list?.settings?.pinned })}
                                className={`flex-shrink-0 w-11 h-6 rounded-full transition-colors relative ${list?.settings?.pinned ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-600'}`}
                            >
                                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${list?.settings?.pinned ? 'translate-x-5' : ''}`} />
                            </button>
                        </div>

                        {/* Hide Completed */}
                        <div className="flex items-center justify-between px-4 py-3.5 bg-white dark:bg-gray-800/60">
                            <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5">
                                    <EyeOff size={13} className={list?.settings?.hideCompleted ? 'text-blue-500' : 'text-gray-400'} />
                                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('lists.settings.hideCompleted.title')}</span>
                                </div>
                                <span className="text-xs text-gray-400 dark:text-gray-500">{t('lists.settings.hideCompleted.description')}</span>
                            </div>
                            <button
                                onClick={() => updateSettings({ hideCompleted: !list?.settings?.hideCompleted })}
                                className={`flex-shrink-0 w-11 h-6 rounded-full transition-colors relative ${list?.settings?.hideCompleted ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-600'}`}
                            >
                                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${list?.settings?.hideCompleted ? 'translate-x-5' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* Sorting Options */}
                    <div className="space-y-2 pt-4">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-1">
                            {t('lists.settings.sort')}
                        </label>
                        <div className="rounded-2xl border border-gray-100 dark:border-gray-700/60 overflow-hidden divide-y divide-gray-100 dark:divide-gray-700/60">
                            {(['manual', 'alphabetical', 'completed'] as const).map((mode) => (
                                <button
                                    key={mode}
                                    onClick={() => {
                                        setSortBy(mode);
                                        updateSettings({ defaultSort: mode });
                                    }}
                                    className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${
                                        sortBy === mode
                                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                                            : 'bg-white dark:bg-gray-800/60 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60'
                                    }`}
                                >
                                    <span className="text-sm font-medium capitalize">{t(`lists.sort.${mode}`)}</span>
                                    {sortBy === mode && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Section Management */}
                    {!list?.archived && (
                        <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                {t('lists.sections.title')}
                            </label>

                            {/* Add Section Form */}
                            <form onSubmit={handleAddSection} className="flex gap-2">
                                <input
                                    type="text"
                                    value={newSectionName}
                                    onChange={(e) => setNewSectionName(e.target.value)}
                                    placeholder={t('lists.sections.addPlaceholder')}
                                    className="flex-1 p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                />
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                                >
                                    {t('lists.sections.add')}
                                </button>
                            </form>

                            {/* Sections List */}
                            <div className="space-y-2">
                                {(() => {
                                    const sortedSections = [...(list?.sections || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                                    if (sortedSections.length === 0) {
                                        return (
                                            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                                                {t('lists.sections.empty')}
                                            </p>
                                        );
                                    }
                                    return (
                                        <DndContext
                                            sensors={sensors}
                                            collisionDetection={closestCenter}
                                            onDragEnd={handleSectionDragEnd}
                                        >
                                            <SortableContext
                                                items={sortedSections.map((s) => s.id)}
                                                strategy={verticalListSortingStrategy}
                                            >
                                                <div className="space-y-2">
                                                    {sortedSections.map((section) => (
                                                        <SortableSectionItem
                                                            key={section.id}
                                                            section={section}
                                                            editingSectionId={editingSectionId}
                                                            editedSectionName={editedSectionName}
                                                            setEditedSectionName={setEditedSectionName}
                                                            setEditingSectionId={setEditingSectionId}
                                                            handleUpdateSection={handleUpdateSection}
                                                            setDeleteSectionId={setDeleteSectionId}
                                                        />
                                                    ))}
                                                </div>
                                            </SortableContext>
                                        </DndContext>
                                    );
                                })()}
                            </div>
                        </div>
                    )}

                    {/* Archive Toggle */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800">
                        <div className="flex flex-col">
                            <span className="font-medium text-gray-900 dark:text-gray-100">{t('lists.settings.archive.title')}</span>
                            <span className="text-sm text-gray-500">{t('lists.settings.archive.description')}</span>
                        </div>
                        <button
                            onClick={() => archiveList(list!.id, !list?.archived)}
                            className={`w-12 h-6 rounded-full transition-colors relative ${list?.archived ? 'bg-orange-500' : 'bg-gray-200 dark:bg-gray-700'}`}
                        >
                            <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${list?.archived ? 'translate-x-6' : ''}`} />
                        </button>
                    </div>

                    {/* Calendar Accordion - Hidden if archived */}
                    {!list?.archived && (
                        <div className="space-y-2">
                            <button
                                onClick={() => setCalendarAccordionOpen(!calendarAccordionOpen)}
                                className="w-full flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                                <div className="flex flex-col items-start">
                                    <span className="font-medium text-gray-900 dark:text-gray-100">{t('lists.settings.calendar.title')}</span>
                                    <span className="text-sm text-gray-500">{t('lists.settings.calendar.description')}</span>
                                </div>
                                <ChevronDown
                                    size={20}
                                    className={`transition-transform ${calendarAccordionOpen ? 'rotate-180' : ''}`}
                                />
                            </button>

                            {calendarAccordionOpen && (
                                <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                            {t('lists.settings.calendar.eventTitle')}
                                        </label>
                                        <input
                                            type="text"
                                            value={calendarEventTitle}
                                            onChange={(e) => setCalendarEventTitle(e.target.value)}
                                            placeholder={list.name}
                                            className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                {t('lists.settings.calendar.startTime')}
                                            </label>
                                            {isPast && (
                                                <span className="text-xs text-red-500 font-medium self-center">
                                                    {/* You might want to translate this string */}
                                                    Time has passed
                                                </span>
                                            )}
                                        </div>
                                        <input
                                            type="datetime-local"
                                            value={calendarStartTime}
                                            onChange={(e) => setCalendarStartTime(e.target.value)}
                                            min={toLocalISOString(new Date())}
                                            className={`w-full p-2 rounded-lg border ${isPast ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 dark:border-gray-600 focus:ring-blue-500'} bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 outline-none`}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                            {t('lists.settings.calendar.endTime')}
                                        </label>
                                        <input
                                            type="datetime-local"
                                            value={calendarEndTime}
                                            onChange={(e) => setCalendarEndTime(e.target.value)}
                                            min={calendarStartTime}
                                            className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>

                                    <button
                                        onClick={generateGoogleCalendarLink}
                                        disabled={isCalendarButtonDisabled}
                                        className={`w-full flex items-center justify-center gap-2 p-3 rounded-lg font-medium transition-colors ${isCalendarButtonDisabled
                                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-600 dark:text-gray-400'
                                            : 'bg-blue-600 text-white hover:bg-blue-700'
                                            }`}
                                    >
                                        {t('lists.settings.calendar.generateLink')}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Export List Action */}
                    <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                        <button
                            onClick={() => {
                                setSettingsOpen(false);
                                setExportModalOpen(true);
                            }}
                            className="w-full flex items-center justify-center gap-2 p-3 text-blue-600 bg-blue-50 dark:bg-blue-900/10 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded-lg transition-colors font-medium border border-blue-100 dark:border-blue-900/30"
                        >
                            <Download size={18} />
                            {t('export.buttonTitle', 'Exportera lista (JSON)')}
                        </button>
                    </div>


                    {/* Delete List Action */}
                    <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                        <button
                            onClick={() => {
                                setDeleteConfirmOpen(true);
                            }}
                            className="w-full flex items-center justify-center gap-2 p-3 text-red-600 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-red-100 dark:border-red-900/30"
                        >
                            <Trash2 size={18} />
                            {t('lists.deleteTitle')}
                        </button>
                    </div>
                </div>
            </Modal>
            <Modal
                isOpen={deleteConfirmOpen}
                onClose={() => setDeleteConfirmOpen(false)}
                onConfirm={async () => {
                    if (list) {
                        await deleteList(list.id);
                        navigate('/');
                    }
                }}
                title={t('lists.deleteTitle')}
                message={list && lists.filter((l) => l.categoryId === list.categoryId).length <= 1 ? t('lists.deleteLastListMessage') : t('lists.deleteMessage')}
                confirmText={t('lists.deleteConfirm')}
                isDestructive
            />
            <Modal
                isOpen={deletingSectionId !== null}
                onClose={() => setDeleteSectionId(null)}
                onConfirm={() => deletingSectionId && handleDeleteSection(deletingSectionId)}
                title={t('lists.sections.deleteTitle')}
                message={t('lists.sections.deleteMessage')}
                confirmText={t('lists.sections.deleteConfirm')}
            />
            <Modal
                isOpen={unpinConfirmOpen}
                onClose={() => setUnpinConfirmOpen(false)}
                title={t('lists.unpinConfirm.title', 'Lämna fäst lista?')}
                message={t('lists.unpinConfirm.message', 'Denna lista är fäst och öppnas automatiskt när appen startar. Vill du sluta fästa den nu?')}
                confirmText={t('lists.unpinConfirm.unpinAndLeave', 'Sluta fäst och lämna')}
                cancelText={t('common.cancel', 'Avbryt')}
                onConfirm={async () => {
                    if (list) {
                        await updateSettings({ pinned: false });
                        navigate('/');
                    }
                }}
            >
                <div className="pt-2 border-t border-gray-100 dark:border-gray-700 mt-2">
                    <button
                        onClick={() => {
                            setUnpinConfirmOpen(false);
                            navigate('/');
                        }}
                        className="w-full p-3 text-center text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors font-medium border border-gray-200 dark:border-gray-600"
                    >
                        {t('lists.unpinConfirm.keepPinned', 'Behåll fäst och lämna')}
                    </button>
                    <p className="text-center text-xs text-gray-500 mt-2">
                        {t('lists.unpinConfirm.explanation', 'Du kan alltid ändra detta i listinställningarna senare.')}
                    </p>
                </div>
            </Modal>
            <ImportFromListModal
                isOpen={importFromListOpen}
                onClose={() => setImportFromListOpen(false)}
                onImport={(sourceList, selectedItems, sectionName) =>
                    importItemsFromList(list.id, selectedItems, sourceList.name, sectionName)
                }
                currentListId={list.id}
                lists={lists}
            />
            <ExportListModal
                isOpen={exportModalOpen}
                onClose={() => setExportModalOpen(false)}
                list={list}
            />
            <ImportJsonToListModal
                isOpen={importJsonModalOpen}
                onClose={() => setImportJsonModalOpen(false)}
                currentList={list}
                onReplace={(newItems, newSections) =>
                    importJsonToList(list.id, newItems, newSections, 'replace')
                }
                onAppend={(appendItems, appendSections) =>
                    importJsonToList(list.id, appendItems, appendSections, 'append')
                }
            />
        </div >
    );
});

ListDetail.displayName = 'ListDetail';