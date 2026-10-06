import { render, screen, fireEvent } from '@testing-library/react';
import { ListDetail } from './ListDetail';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import * as AppContext from '../context/AppContext';

// Mock i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));



// Mock dnd-kit
vi.mock('@dnd-kit/core', () => ({
    DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    closestCenter: vi.fn(),
    PointerSensor: vi.fn(),
    KeyboardSensor: vi.fn(),
    useSensor: vi.fn(),
    useSensors: vi.fn(),
    useDroppable: () => ({ setNodeRef: vi.fn() }),
}));

vi.mock('@dnd-kit/sortable', () => ({
    SortableContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    sortableKeyboardCoordinates: vi.fn(),
    verticalListSortingStrategy: vi.fn(),
    arrayMove: vi.fn((items, oldIndex, newIndex) => {
        const result = [...items];
        const [removed] = result.splice(oldIndex, 1);
        result.splice(newIndex, 0, removed);
        return result;
    }),
    useSortable: () => ({
        attributes: {},
        listeners: {},
        setNodeRef: vi.fn(),
        transform: null,
        transition: null,
        isDragging: false,
    }),
}));

// Mock child components
vi.mock('./SortableItem', () => ({
    SortableItem: ({ item, onToggle }: { item: { id: string; text: string }; onToggle: (id: string) => void }) => (
        <div data-testid="sortable-item">
            {item.text}
            <button onClick={() => onToggle(item.id)}>Toggle</button>
        </div>
    )
}));

vi.mock('lucide-react', () => ({
    Plus: () => <div />,
    ChevronLeft: () => <div />,
    RotateCcw: () => <div />,
    Settings: () => <div data-testid="settings-icon" />,
    ChevronDown: () => <div />,
    Pin: () => <div />,
    EyeOff: () => <div />,
    Trash2: () => <div />,
    Edit2: () => <div />,
    FolderInput: () => <div />,
    MoreVertical: () => <div />,
    Download: () => <div />,
    FileText: () => <div />,
    X: () => <div />,
    Copy: () => <div />,
    Check: () => <div />,
    Archive: () => <div />,
    ArchiveRestore: () => <div />,
    Upload: () => <div />,
    AlertTriangle: () => <div />,
    RefreshCw: () => <div />,
    GripVertical: () => <div data-testid="grip-vertical" />,
}));

const mockUpdateListItems = vi.fn();
const mockArchiveList = vi.fn();

describe('ListDetail', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(AppContext, 'useApp').mockReturnValue({
            lists: [
                {
                    id: 'list1',
                    name: 'My List',
                    categoryId: 'cat1',
                    items: [
                        { id: 'i1', text: 'Apple', completed: false },
                        { id: 'i2', text: 'Banana', completed: true }
                    ]
                }
            ],
            updateListItems: mockUpdateListItems,
            deleteItem: vi.fn(),
            updateListName: vi.fn(),
            updateListSettings: vi.fn(),
            updateListAccess: vi.fn(),
            // defaults
            categories: [],
            addCategory: vi.fn(),
            deleteCategory: vi.fn(),
            reorderCategories: vi.fn(),
            addList: vi.fn(),
            deleteList: vi.fn(),
            copyList: vi.fn(),
            moveList: vi.fn(),
            updateCategoryName: vi.fn(),
            reorderLists: vi.fn(),
            addSession: vi.fn(),
            combinations: [],
            addCombination: vi.fn(),
            updateCombination: vi.fn(),
            deleteCombination: vi.fn(),
            sessions: [],
            completeSession: vi.fn(),
            deleteSession: vi.fn(),
            archiveList: mockArchiveList,
            addSection: vi.fn(),
            updateSection: vi.fn(),
            deleteSection: vi.fn(),
            reorderSections: vi.fn(),
        } as Partial<ReturnType<typeof AppContext.useApp>> as ReturnType<typeof AppContext.useApp>);
    });

    const renderComponent = () => {
        const router = createMemoryRouter(
            [
                {
                    path: '/list/:listId',
                    element: <ListDetail />,
                },
            ],
            {
                initialEntries: ['/list/list1'],
            }
        );

        render(<RouterProvider router={router} />);
    };

    it('renders list items', () => {
        renderComponent();
        expect(screen.getByText('Apple')).toBeDefined();
        expect(screen.getByText('Banana')).toBeDefined();
    });

    it('adds a new item', () => {
        renderComponent();
        // Click the add button to show the input field
        const addButton = screen.getByText('lists.addItemButton');
        fireEvent.click(addButton);
        
        const input = screen.getByPlaceholderText('lists.addItemPlaceholder');
        fireEvent.change(input, { target: { value: 'Cherry' } });

        const form = input.closest('form');
        fireEvent.submit(form!);

        expect(mockUpdateListItems).toHaveBeenCalledWith('list1', expect.arrayContaining([
            expect.objectContaining({ text: 'Apple' }),
            expect.objectContaining({ text: 'Banana' }),
            expect.objectContaining({ text: 'Cherry', completed: false })
        ]));
    });

    it('toggles item completion', () => {
        renderComponent();
        const toggleButtons = screen.getAllByText('Toggle');
        fireEvent.click(toggleButtons[0]); // Apple

        expect(mockUpdateListItems).toHaveBeenCalledWith('list1', expect.arrayContaining([
            expect.objectContaining({ id: 'i1', completed: true }), // Toggled to true
            expect.objectContaining({ id: 'i2', completed: true })
        ]));
    });

    it('toggles item 3-stage unresolved -> prepared -> completed', async () => {
        // Mock list with 3-stage enabled
        vi.spyOn(AppContext, 'useApp').mockReturnValue({
            lists: [
                {
                    id: 'list1',
                    name: 'My List',
                    categoryId: 'cat1',
                    items: [
                        { id: 'i1', text: 'Apple', completed: false, state: 'unresolved' }
                    ],
                    settings: { threeStageMode: true, defaultSort: 'manual' }
                }
            ],
            updateListItems: mockUpdateListItems,
            deleteItem: vi.fn(),
            updateListName: vi.fn(),
            updateListSettings: vi.fn(),
            updateListAccess: vi.fn(),
            categories: [],
            addCategory: vi.fn(),
            deleteCategory: vi.fn(),
            reorderCategories: vi.fn(),
            addList: vi.fn(),
            deleteList: vi.fn(),
            copyList: vi.fn(),
            moveList: vi.fn(),
            updateCategoryName: vi.fn(),
            reorderLists: vi.fn(),
            addSession: vi.fn(),
            combinations: [],
            addCombination: vi.fn(),
            updateCombination: vi.fn(),
            deleteCombination: vi.fn(),
            sessions: [],
            completeSession: vi.fn(),
            deleteSession: vi.fn(),
            archiveList: vi.fn(),
            addSection: vi.fn(),
            updateSection: vi.fn(),
            deleteSection: vi.fn(),
        } as Partial<ReturnType<typeof AppContext.useApp>> as ReturnType<typeof AppContext.useApp>);

        renderComponent();
        const toggleButtons = screen.getAllByText('Toggle');
        fireEvent.click(toggleButtons[0]); // Apple: unresolved -> ongoing

        expect(mockUpdateListItems).toHaveBeenCalledWith('list1', expect.arrayContaining([
            expect.objectContaining({ id: 'i1', completed: false, state: 'ongoing' })
        ]));
    });

    it('filters out completed items when hideCompleted is true', () => {
        vi.spyOn(AppContext, 'useApp').mockReturnValue({
            lists: [
                {
                    id: 'list1',
                    name: 'My List',
                    categoryId: 'cat1',
                    items: [
                        { id: 'i1', text: 'Apple', completed: false },
                        { id: 'i2', text: 'Banana', completed: true }
                    ],
                    settings: { hideCompleted: true, threeStageMode: false, defaultSort: 'manual' }
                }
            ],
            updateListItems: mockUpdateListItems,
            deleteItem: vi.fn(),
            updateListName: vi.fn(),
            updateListSettings: vi.fn(),
            updateListAccess: vi.fn(),
            archiveList: vi.fn(),
            addSection: vi.fn(),
            updateSection: vi.fn(),
            deleteSection: vi.fn(),
            categories: [],
            addCategory: vi.fn(),
            deleteCategory: vi.fn(),
            reorderCategories: vi.fn(),
            addList: vi.fn(),
            deleteList: vi.fn(),
            copyList: vi.fn(),
            moveList: vi.fn(),
            updateCategoryName: vi.fn(),
            reorderLists: vi.fn(),
            addSession: vi.fn(),
            combinations: [],
            addCombination: vi.fn(),
            updateCombination: vi.fn(),
            deleteCombination: vi.fn(),
            sessions: [],
            completeSession: vi.fn(),
            deleteSession: vi.fn(),
        } as Partial<ReturnType<typeof AppContext.useApp>> as ReturnType<typeof AppContext.useApp>);

        renderComponent();
        expect(screen.getByText('Apple')).toBeDefined();
        // Banana is in the accordion, which is closed by default
        expect(screen.queryByText('Banana')).toBeNull();

        // Find and click the accordion button
        const accordionButton = screen.getByText(/lists.completedAccordion/);
        expect(accordionButton).toBeDefined();
        fireEvent.click(accordionButton);

        // Now Banana should be visible
        expect(screen.getByText('Banana')).toBeDefined();
    });

    it('shows all items when hideCompleted is false', () => {
        vi.spyOn(AppContext, 'useApp').mockReturnValue({
            lists: [
                {
                    id: 'list1',
                    name: 'My List',
                    categoryId: 'cat1',
                    items: [
                        { id: 'i1', text: 'Apple', completed: false },
                        { id: 'i2', text: 'Banana', completed: true }
                    ],
                    settings: { hideCompleted: false, threeStageMode: false, defaultSort: 'manual' }
                }
            ],
            updateListItems: mockUpdateListItems,
            deleteItem: vi.fn(),
            updateListName: vi.fn(),
            updateListSettings: vi.fn(),
            updateListAccess: vi.fn(),
            archiveList: vi.fn(),
            addSection: vi.fn(),
            updateSection: vi.fn(),
            deleteSection: vi.fn(),
            categories: [],
            addCategory: vi.fn(),
            deleteCategory: vi.fn(),
            reorderCategories: vi.fn(),
            addList: vi.fn(),
            deleteList: vi.fn(),
            copyList: vi.fn(),
            moveList: vi.fn(),
            updateCategoryName: vi.fn(),
            reorderLists: vi.fn(),
            addSession: vi.fn(),
            combinations: [],
            addCombination: vi.fn(),
            updateCombination: vi.fn(),
            deleteCombination: vi.fn(),
            sessions: [],
            completeSession: vi.fn(),
            deleteSession: vi.fn(),
        } as Partial<ReturnType<typeof AppContext.useApp>> as ReturnType<typeof AppContext.useApp>);

        renderComponent();
        expect(screen.getByText('Apple')).toBeDefined();
        expect(screen.getByText('Banana')).toBeDefined();
        // Accordion should not be present
        expect(screen.queryByText(/lists.completedAccordion/)).toBeNull();
    });

    it('opens export modal from quick settings menu', () => {
        renderComponent();
        const moreButton = screen.getByTitle('common.more');
        fireEvent.click(moreButton);

        const exportButton = screen.getByText('export.buttonTitle');
        expect(exportButton).toBeDefined();
        fireEvent.click(exportButton);

        expect(screen.getByText('export.title')).toBeDefined();
    });

    it('archives list from quick settings menu', () => {
        renderComponent();
        const moreButton = screen.getByTitle('common.more');
        fireEvent.click(moreButton);

        const archiveButton = screen.getByText('lists.archive');
        expect(archiveButton).toBeDefined();
        fireEvent.click(archiveButton);

        expect(mockArchiveList).toHaveBeenCalledWith('list1', true);
    });

    it('opens import JSON modal from quick settings menu', () => {
        renderComponent();
        const moreButton = screen.getByTitle('common.more');
        fireEvent.click(moreButton);

        const importJsonButton = screen.getByText('importJson.buttonTitle');
        expect(importJsonButton).toBeDefined();
        fireEvent.click(importJsonButton);

        expect(screen.getByText('importJson.title')).toBeDefined();
    });

    it('displays banner and unarchives list when list is archived', () => {
        vi.spyOn(AppContext, 'useApp').mockReturnValue({
            lists: [
                {
                    id: 'list1',
                    name: 'Archived List',
                    categoryId: 'cat1',
                    archived: true,
                    items: []
                }
            ],
            updateListItems: mockUpdateListItems,
            deleteItem: vi.fn(),
            updateListName: vi.fn(),
            updateListSettings: vi.fn(),
            updateListAccess: vi.fn(),
            categories: [],
            addCategory: vi.fn(),
            deleteCategory: vi.fn(),
            reorderCategories: vi.fn(),
            addList: vi.fn(),
            deleteList: vi.fn(),
            copyList: vi.fn(),
            moveList: vi.fn(),
            updateCategoryName: vi.fn(),
            reorderLists: vi.fn(),
            addSession: vi.fn(),
            combinations: [],
            addCombination: vi.fn(),
            updateCombination: vi.fn(),
            deleteCombination: vi.fn(),
            sessions: [],
            completeSession: vi.fn(),
            deleteSession: vi.fn(),
            archiveList: mockArchiveList,
            addSection: vi.fn(),
            updateSection: vi.fn(),
            deleteSection: vi.fn(),
            importItemsFromList: vi.fn(),
        } as Partial<ReturnType<typeof AppContext.useApp>> as ReturnType<typeof AppContext.useApp>);

        renderComponent();

        expect(screen.getByText('lists.archivedBadge')).toBeDefined();
        expect(screen.getByText('lists.archivedWarning')).toBeDefined();

        const unarchiveButtons = screen.getAllByText('lists.unarchive');
        expect(unarchiveButtons.length).toBeGreaterThan(0);
        fireEvent.click(unarchiveButtons[0]);

        expect(mockArchiveList).toHaveBeenCalledWith('list1', false);
    });

    it('renders sections with drag handle in list settings', () => {
        const mockReorderSections = vi.fn();
        vi.spyOn(AppContext, 'useApp').mockReturnValue({
            lists: [
                {
                    id: 'list1',
                    name: 'My List',
                    categoryId: 'cat1',
                    items: [],
                    sections: [
                        { id: 'sec1', name: 'Fruits', order: 0 },
                        { id: 'sec2', name: 'Vegetables', order: 1 },
                        { id: 'sec3', name: 'Dairy', order: 2 },
                    ]
                }
            ],
            updateListItems: mockUpdateListItems,
            deleteItem: vi.fn(),
            updateListName: vi.fn(),
            updateListSettings: vi.fn(),
            updateListAccess: vi.fn(),
            archiveList: mockArchiveList,
            addSection: vi.fn(),
            updateSection: vi.fn(),
            deleteSection: vi.fn(),
            reorderSections: mockReorderSections,
            categories: [],
            addCategory: vi.fn(),
            deleteCategory: vi.fn(),
            reorderCategories: vi.fn(),
            addList: vi.fn(),
            deleteList: vi.fn(),
            copyList: vi.fn(),
            moveList: vi.fn(),
            updateCategoryName: vi.fn(),
            reorderLists: vi.fn(),
            addSession: vi.fn(),
            combinations: [],
            addCombination: vi.fn(),
            updateCombination: vi.fn(),
            deleteCombination: vi.fn(),
            sessions: [],
            completeSession: vi.fn(),
            deleteSession: vi.fn(),
        } as Partial<ReturnType<typeof AppContext.useApp>> as ReturnType<typeof AppContext.useApp>);

        renderComponent();

        // Open settings modal
        const moreButton = screen.getByTitle('common.more');
        fireEvent.click(moreButton);
        const settingsButton = screen.getByText('lists.settings.title');
        fireEvent.click(settingsButton);

        // Sections should be visible in settings
        expect(screen.getAllByText('Fruits')).toBeDefined();
        expect(screen.getAllByText('Vegetables')).toBeDefined();
        expect(screen.getAllByText('Dairy')).toBeDefined();

        // Drag handles should be present
        const dragHandles = screen.getAllByLabelText('Drag to reorder section');
        expect(dragHandles).toHaveLength(3);
    });

    it('toggles section collapse and hides/shows section items', () => {
        vi.spyOn(AppContext, 'useApp').mockReturnValue({
            lists: [
                {
                    id: 'list1',
                    name: 'My List',
                    categoryId: 'cat1',
                    items: [
                        { id: 'i1', text: 'Apples', completed: false, sectionId: 'sec1' },
                    ],
                    sections: [
                        { id: 'sec1', name: 'Fruits', order: 0 },
                    ]
                }
            ],
            updateListItems: mockUpdateListItems,
            deleteItem: vi.fn(),
            updateListName: vi.fn(),
            updateListSettings: vi.fn(),
            updateListAccess: vi.fn(),
            archiveList: mockArchiveList,
            addSection: vi.fn(),
            updateSection: vi.fn(),
            deleteSection: vi.fn(),
            reorderSections: vi.fn(),
        } as Partial<ReturnType<typeof AppContext.useApp>> as ReturnType<typeof AppContext.useApp>);

        renderComponent();

        // Item should initially be visible
        expect(screen.getByText('Apples')).toBeDefined();

        // Click section header button to collapse
        const collapseBtn = screen.getByLabelText('lists.sections.collapse');
        fireEvent.click(collapseBtn);

        // Item should now be hidden
        expect(screen.queryByText('Apples')).toBeNull();

        // Click again to expand
        const expandBtn = screen.getByLabelText('lists.sections.expand');
        fireEvent.click(expandBtn);

        // Item should be visible again
        expect(screen.getByText('Apples')).toBeDefined();
    });

    it('allows quick-adding an item directly to a section', async () => {
        vi.spyOn(AppContext, 'useApp').mockReturnValue({
            lists: [
                {
                    id: 'list1',
                    name: 'My List',
                    categoryId: 'cat1',
                    items: [],
                    sections: [
                        { id: 'sec1', name: 'Produce', order: 0 },
                    ]
                }
            ],
            updateListItems: mockUpdateListItems,
            deleteItem: vi.fn(),
            updateListName: vi.fn(),
            updateListSettings: vi.fn(),
            updateListAccess: vi.fn(),
            archiveList: mockArchiveList,
            addSection: vi.fn(),
            updateSection: vi.fn(),
            deleteSection: vi.fn(),
            reorderSections: vi.fn(),
        } as Partial<ReturnType<typeof AppContext.useApp>> as ReturnType<typeof AppContext.useApp>);

        renderComponent();

        // Click quick-add button in section header
        const quickAddBtn = screen.getByLabelText('lists.sections.quickAdd');
        fireEvent.click(quickAddBtn);

        // Form should be shown
        const input = screen.getByPlaceholderText('lists.sections.quickAddPlaceholder');
        expect(input).toBeDefined();

        fireEvent.change(input, { target: { value: 'Carrots' } });
        const submitBtn = screen.getByText('lists.sections.quickAddButton');
        fireEvent.click(submitBtn);

        expect(mockUpdateListItems).toHaveBeenCalledWith(
            'list1',
            expect.arrayContaining([
                expect.objectContaining({
                    text: 'Carrots',
                    sectionId: 'sec1',
                    completed: false
                })
            ])
        );
    });

    it('renders items in a standard list when manual sorting is active', () => {
        renderComponent();
        const items = screen.getAllByTestId('sortable-item');
        expect(items.length).toBeGreaterThan(0);
    });

    it('renders items inside sections when manual sorting is active', () => {
        const mockListWithSections: List = {
            id: 'list1',
            name: 'Groceries',
            items: [
                { id: 'item1', text: 'Apples', completed: false, sectionId: 'sec1' },
                { id: 'item2', text: 'Bananas', completed: false, sectionId: 'sec1' },
                { id: 'item3', text: 'Milk', completed: false, sectionId: 'sec2' },
            ],
            sections: [
                { id: 'sec1', name: 'Fruit', order: 0 },
                { id: 'sec2', name: 'Dairy', order: 1 },
            ],
        };

        vi.spyOn(AppContext, 'useApp').mockReturnValue({
            lists: [mockListWithSections],
            updateListItems: vi.fn(),
            deleteItem: vi.fn(),
            updateListName: vi.fn(),
            updateListSettings: vi.fn(),
            updateListAccess: vi.fn(),
            archiveList: vi.fn(),
            addSection: vi.fn(),
            updateSection: vi.fn(),
            deleteSection: vi.fn(),
            reorderSections: vi.fn(),
        } as Partial<ReturnType<typeof AppContext.useApp>> as ReturnType<typeof AppContext.useApp>);

        renderComponent();
        const items = screen.getAllByTestId('sortable-item');
        expect(items).toHaveLength(3);
    });
});
