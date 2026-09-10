# LoopList

A mobile-first Progressive Web App for managing reusable, recurring lists — built with React 19, TypeScript, Tailwind CSS v4, and Vite. Data is securely stored in Google Cloud Firestore with real-time synchronization and full offline support.

---

## Features

### List Management
- **Create & organize lists** grouped into named categories (e.g. Jobb, Privat, Resor)
- **Add, edit, delete, and reorder items** within a list via drag & drop
- **Inline title editing** — click the list name to rename it in place
- **Reset all items** — uncheck everything in one click (with optional confirmation prompt)
- **Hide completed items** — toggle a setting to collapse completed items into a collapsible accordion
- **Auto-reset prompt** — when all items are checked, a modal offers to reset the list automatically
- **Pin a list** — pin a specific list so it always opens on app start; navigation away requires explicit unpin confirmation
- **Archive lists** — move lists out of active view without deleting them; restore or delete from the Archive tab

### Sections
- Organize items within a list using **named sections**
- Create, rename, and delete sections
- **Drag items between sections** — drop an item onto a section header or onto another item in a different section

### Three-Stage Mode
- Enable a workflow mode per list: items cycle through **Unresolved → Ongoing → Completed → Unresolved**
- Useful for tasks that require an intermediate "in progress" state before being fully done

### Sorting
- **Manual** (drag & drop order)
- **Alphabetical** (A–Z)
- **By state** — Prepared → Active → Completed, with alphabetical secondary sort

### Categories
- Create, rename, and delete categories
- **Reorder categories** via drag and drop in the Manage Categories modal
- Deleting a category deletes all lists within it (with special warning for last list)
- **Move lists** between categories via context menu

### Templates (Combinations)
- Save groups of lists as a **reusable template** (called Combinations/Mallar)
- Create, edit, and delete templates from the Templates tab on the home screen
- **Start a session directly** from a template

### Execution Sessions
- Create a **temporary session** by selecting one or more lists (via Session Picker)
- Work through items across all lists in a single focused session view
- Complete or delete a session when done
- Sessions are tracked and contribute to the Statistics view

### Statistics
- Overview metrics: total lists, completed items, total todos, total sessions
- **Activity trend chart** (Area chart, last 30 days of session activity)
- **Top 5 lists** by session usage (Bar chart)
- **Category distribution** (Donut pie chart)
- **Todo priority distribution** (Donut pie chart)
- Powered by Recharts

### Todos (Notes)
- Separate Todo/Note section for single tasks or reminders
- Create, edit, delete, and toggle todos
- **Priority levels**: Low / Medium / High — color coded
- Sorted by: incomplete first, then by priority, then by creation date
- Optional content/description field per todo

### Search
- Global **real-time search** across all list names and item texts
- Results shown inline in the main content area
- Accessible from the header on both mobile and desktop

### Calendar Export
- Export any list as a **calendar event** (ICS file)
- Set custom start and end times via an accordion panel in the list settings
- Times default to the next full hour and adjust automatically to avoid invalid ranges

### Export & Import
- **Export a list** to JSON in two formats:
  - Simple: `{ name, items: string[] }`
  - Detailed: `{ name, items: { text, completed }[] }`
- Copy to clipboard or download as `.json`
- **Import a list** from JSON with real-time validation and error messages
- **Import items from another list** — search your existing lists, select individual items, optionally create a new section for the imported items

### AI List Generation (Gemini)
- Describe a list in natural language and let **Google Gemini** generate the items automatically
- Powered by `@google/generative-ai` with `gemini-3.8-flash`
- Preview and edit the generated items before saving
- Create a new category inline from the AI modal
- Generated lists are tagged with the original prompt for future reference

### Voice Input
- Dictate list items using the **Web Speech API** (browser support required)
- Language set to `sv-SE` by default
- Start/stop button with live transcript display

### Internationalization (i18n)
- Fully translated in **English** and **Swedish**
- Language selector in Settings; persists across sessions
- Uses `i18next` + `react-i18next` + browser language detection

### Theme
- Light / Dark mode toggle
- Respects OS preference on first visit
- Manual override stored in `localStorage`

### Cloud Sync & Authentication
- **Google Sign-In** via Firebase Authentication
- All data stored per user in **Cloud Firestore** at `users/{uid}/...`
- Real-time listeners via `onSnapshot` — changes appear instantly across tabs/devices
- **Offline-first** via Firestore's IndexedDB persistence layer
- Data automatically migrated from legacy `localStorage` format on first sign-in

### PWA
- Installable on Android and iOS (Add to Home Screen)
- Offline-first — full functionality without a network connection
- Service Worker via `vite-plugin-pwa` + Workbox
- Update prompt notifies user when a new version is available

### Toasts & Error Handling
- Non-blocking **toast notifications** for actions (save, delete, error)
- **ErrorBoundary** catches render errors and shows a friendly recovery UI
- **OfflineIndicator** banner shown when the device loses internet connectivity

### Activity Log
- Shows the **git commit history** of the app (embedded at build time)
- Each entry links directly to the GitHub commit
- The latest commit hash is shown in the footer

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 (TypeScript) |
| Build Tool | Vite 8 |
| Styling | Tailwind CSS v4 |
| Icons | Lucide React |
| Drag & Drop | `@dnd-kit/core` + `@dnd-kit/sortable` |
| Charts | Recharts |
| State | React Context API |
| Backend / DB | Firebase Firestore (real-time) |
| Auth | Firebase Authentication (Google Sign-In) |
| AI | Google Gemini (`@google/generative-ai`) |
| i18n | i18next + react-i18next |
| PWA | vite-plugin-pwa + Workbox |
| Testing | Vitest + React Testing Library |
| Linting | ESLint + typescript-eslint |

---

## Getting Started

### Prerequisites
- Node.js (Latest LTS recommended)
- npm

### Installation

```bash
git clone https://github.com/Jojjeboy/looplist.git
cd looplist
npm install
```

### Environment Variables

Copy `.env.example` to `.env` and fill in your Firebase and Gemini credentials:

```bash
cp .env.example .env
```

Required variables:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_GEMINI_KEY=...          # Gemini API key for AI list generation
VITE_GEMINI_MODEL=gemini-3.8-flash   # optional
```

### Development

```bash
npm run dev
```

Starts the Vite dev server and generates `src/commits.json` from git history.

### Production Build

```bash
npm run build
```

Runs TypeScript compilation + Vite build + post-build tests.

### Preview Built App

```bash
npm run preview
```

---

## Testing

```bash
# Run all tests with coverage report
npm run test

# Run tests in interactive UI mode
npx vitest --ui

# Full validation pipeline (build -> lint -> strict lint -> test)
npm run validate
```

Tests use **Vitest** + **React Testing Library** with **jsdom**. Firebase and i18next are mocked globally in `src/setupTests.ts`.

---

## PWA Icons

Place the following icons in the `public/` directory for full PWA install support:

- `pwa-192x192.png`
- `pwa-512x512.png`

---

## Security & Data

- **Authentication**: Google Sign-In via Firebase Auth — no anonymous access
- **Authorization**: Firestore security rules enforce `users/{uid}` isolation
- **Offline**: Firestore IndexedDB persistence allows reading and writing without network
- **Migration**: Legacy `localStorage` data is automatically migrated to Firestore on first sign-in

---

## Project Structure

```
src/
├── App.tsx                     # Router configuration and provider tree
├── main.tsx                    # App entry point
├── firebase.ts                 # Firebase app initialization
├── i18n.ts                     # i18next configuration
├── types/index.ts              # Shared TypeScript interfaces
├── assets/                     # Static assets (icons, SVGs)
├── locales/                    # Translation files (en.json, sv.json)
├── context/
│   ├── AppContext.tsx           # Global state & business logic
│   ├── AuthContext.tsx          # Firebase Auth state
│   └── ToastContext.tsx         # Toast notification system
├── hooks/
│   ├── useFirestoreSync.ts     # Generic Firestore <-> React state sync hook
│   ├── useLocalStorage.ts      # localStorage helper hook
│   ├── useMigrateLocalStorage.ts # One-time localStorage -> Firestore migration
│   └── useVoiceInput.ts        # Web Speech API hook
├── services/
│   └── aiService.ts            # Google Gemini API integration
└── components/
    ├── Layout.tsx               # App shell (header, sidebar, nav)
    ├── Sidebar.tsx              # Desktop sidebar navigation
    ├── CategoryView.tsx         # Home screen / category overview
    ├── CategorySection.tsx      # Expandable category + list card grid
    ├── SortableListCard.tsx     # Draggable list card (with context menu)
    ├── ListDetail.tsx           # Full list view with all item management
    ├── SortableItem.tsx         # Draggable item row with toggle/edit/delete
    ├── SessionDetail.tsx        # Session execution view
    ├── SessionPicker.tsx        # Multi-list session creation dialog
    ├── TodoView.tsx             # Todo/Notes management view
    ├── StatisticsView.tsx       # Charts and metrics dashboard
    ├── ActivityLog.tsx          # Git commit history log
    ├── AIListGeneratorModal.tsx # AI-powered list generation
    ├── ImportListModal.tsx      # JSON import dialog
    ├── ImportFromListModal.tsx  # Import items from another list
    ├── ExportListModal.tsx      # JSON export dialog
    ├── ManageCategoriesModal.tsx # Category CRUD + reorder
    ├── CombinationEditor.tsx    # Template (combination) editor
    ├── CombinationCard.tsx      # Template card display
    ├── SearchResults.tsx        # Global search results display
    ├── SettingsModal.tsx        # Language, links to log/stats
    ├── Modal.tsx                # Generic confirm/cancel modal
    ├── ToastContainer.tsx       # Toast notification renderer
    ├── OfflineIndicator.tsx     # Offline status banner
    ├── UpdatePrompt.tsx         # PWA update available prompt
    ├── ProtectedRoute.tsx       # Auth guard for routes
    ├── LandingPage.tsx          # Pre-auth landing page
    └── ErrorBoundary.tsx        # Render error fallback
```

---

## Original Vision

> Jag vill bygga en progressive web app som jag ska kunna spara ner till min telefon, den behöver vara mobile first. Lagring kan ske i localstorage. Den har till syfte att skapa listor som jag återanvänder. Det skulle kunna vara en lista för att komma ihåg vad jag ska ta med till jobbet. Det skulle också kunna vara en lista för att komma ihåg vad jag ska packa när jag går till gymmet eller vad jag ska fixa inför en långrunda när jag går ut och springer osv osv.

## License

MIT
