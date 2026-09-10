# AI-genererade listor med kategorier

## Bakgrund

När AI genererar en lista idag returneras ett platt format:
```json
{ "title": "string", "items": ["item1", "item2", ...] }
```

Förbättringen innebär att AI även föreslår **logiska kategorier/sektioner** för listans innehåll, och användaren kan sedan välja om listan ska sparas med kategorier (grupperat) eller utan (platt).

---

## Mål

1. **AI returnerar kategoriserat förslag** – modellen grupperar items i logiska sektioner.
2. **Förhandsvisning visar båda vyerna** – användaren kan växla mellan "Med kategorier" och "Platt lista".
3. **Användaren väljer format vid sparning** – valet påverkar vilka `Section`-objekt och `sectionId`-kopplingar som skapas på items.

---

## Datamodell

### Ny AI-respons-struktur (i `aiService.ts`)

```ts
export interface GeneratedCategory {
  name: string;
  items: string[];
}

export interface GeneratedList {
  title: string;
  items: string[];                   // Befintligt – platt lista (alltid inkluderat)
  categories?: GeneratedCategory[];  // Nytt – kategoriserade items (optional)
}
```

AI:ns systeminstruction uppdateras för att **alltid** returnera `categories` om det är logiskt, men falla tillbaka på `items` om ingen gruppering är meningsfull.

### JSON-schema AI ska returnera

```json
{
  "title": "Packlista för fjällresa",
  "items": ["Skidbyxor", "Hjälm", "Solglas"],
  "categories": [
    { "name": "Kläder", "items": ["Skidbyxor", "Fleecejacka"] },
    { "name": "Utrustning", "items": ["Hjälm", "Skidstavar"] },
    { "name": "Övrigt", "items": ["Solglas", "Solkräm"] }
  ]
}
```

> `items` behålls alltid platt för bakåtkompatibilitet. `categories` är optional – om AI bedömer att en lista inte passar kategorisering utelämnas fältet.

---

## Ändringar per fil

### 1. `src/types/index.ts`
**Ingen ändring behövs** – `Section`-typen finns redan och används av `List.sections` och `Item.sectionId`.

### 2. `src/services/aiService.ts`

**Lägg till `GeneratedCategory`-interface och uppdatera `GeneratedList`:**
```ts
export interface GeneratedCategory {
  name: string;
  items: string[];
}

export interface GeneratedList {
  title: string;
  items: string[];
  categories?: GeneratedCategory[];
}
```

**Uppdatera systeminstruction** till att be om kategorisering när det är logiskt:
```
Du är en expert på att skapa strukturerade listor. Svara ALLTID med ett strikt JSON-objekt.
Om listans innehåll logiskt kan grupperas i 2–5 kategorier, inkludera "categories".
Annars, utelämna "categories".

Format med kategorier:
{ "title": string, "items": string[], "categories": [{ "name": string, "items": string[] }] }

Format utan kategorier:
{ "title": string, "items": string[] }

Ge inga förklaringar eller annan text, bara JSON.
```

**Uppdatera validering** för att acceptera det nya `categories`-fältet utan att krascha.

### 3. `src/components/AIListGeneratorModal.tsx`

**Nytt state:**
```ts
const [viewMode, setViewMode] = useState<'flat' | 'categories'>('categories');
```
- Sätts till `'categories'` om `generatedList.categories` finns, annars `'flat'`.
- Låses till `'flat'` om ingen kategorisering returnerades.

**Toggle-UI** (visas bara om `generatedList.categories` finns):
```
[● Med kategorier]  [○ Platt lista]
```

**Kategoriserad förhandsvisning:**
```tsx
{generatedList.categories.map(cat => (
  <div key={cat.name}>
    <h5>{cat.name}</h5>
    <ul>{cat.items.map(item => <li>• {item}</li>)}</ul>
  </div>
))}
```

**`handleSave` – kategoriserat sparande:**
```ts
// Skapa Section-objekt
const sections: Section[] = generatedList.categories.map((cat, i) => ({
  id: crypto.randomUUID(),
  name: cat.name,
  order: i,
}));

// Koppla items till rätt sectionId
const formattedItems: Item[] = generatedList.categories.flatMap((cat, catIdx) =>
  cat.items.map(text => ({
    id: crypto.randomUUID(),
    text,
    completed: false,
    sectionId: sections[catIdx].id,
  }))
);

await onSave(generatedList.title, formattedItems, targetCategoryId, prompt, sections);
```

**Uppdatera `onSave`-signaturen i props:**
```ts
onSave: (
  name: string,
  items: Item[],
  categoryId: string,
  aiPrompt?: string,
  sections?: Section[]
) => Promise<void>;
```

### 4. Konsumenter av `AIListGeneratorModal`

Alla ställen som skickar `onSave`-callback behöver ta emot den optionala `sections`-parametern och skicka med den när listan sparas.

- Identifiera via: `grep -r "onSave" src/`
- Troligen `App.tsx` eller en listhanteringskomponent.

---

## UX-flöde

```
1. Användaren skriver prompt → klickar "Generera list-förslag"
2. AI returnerar { title, items, categories? }
3. Om categories finns:
   a. Visa toggle: [● Med kategorier] [○ Platt lista]
   b. Defaultläge: "Med kategorier"
   c. Förhandsvisning visar grupperingen med sektionsrubriker
4. Om categories saknas:
   a. Ingen toggle visas
   b. Platt lista visas som tidigare
5. Användaren väljer kategori att spara i → klickar "Spara i mina listor"
6. Listan sparas med eller utan sections beroende på valt läge
```

---

## Kantfall & felhantering

| Situation | Hantering |
|---|---|
| AI returnerar `categories` men summan av items ≠ `items` | Använd `categories` som källa, ignorera platta `items` vid kategoriserat sparande |
| AI returnerar bara `items` (ingen `categories`) | Toggle visas ej, platt sparning som idag |
| Kategori-JSON är korrupt/saknar fält | Falla tillbaka till platt vy, logga varning |
| `categories` innehåller bara 1 grupp | Visa ändå som kategoriserat (sektionen ger struktur) |

---

## Verifiering

- [ ] AI returnerar `categories` för lämpliga prompts (t.ex. "packlista för fjällresa")
- [ ] AI utelämnar `categories` för enkla prompts (t.ex. "5 favoritfilmer")
- [ ] Toggle visas/döljs korrekt baserat på AI-svar
- [ ] Sparad lista med kategorier har korrekta `sections` och `sectionId` på items
- [ ] Sparad lista utan kategorier är oförändrad från nuvarande beteende
- [ ] Inga TypeScript-fel
- [ ] Befintliga tester passerar

---

## Framtida förbättringar (ej i scope nu)

- Låt användaren redigera kategorinamnen i modalen innan sparning
- Låt användaren flytta items mellan kategorier
- Spara användarens preferens (platt/kategorier) i localStorage
