# Daybook — Agent Guide

Daybook is a small, fully working **daily expense journal** used as the demo domain
for this vanilla HTML/CSS/JS PWA boilerplate. The app is intentionally complete:
calendar, quick text entry, a searchable preset catalog, tags, budgets, charts,
receipt photos, import/export, light/dark themes and offline support.

Start new projects from this repository by **replacing the demo domain**, not by
rewriting the shell. The design system, components, interaction patterns and
architecture are meant to be reused.

---

## 1. Hard rules

- Vanilla HTML, CSS and JavaScript only. No dependencies, frameworks, build step,
  package manager, `package.json`, lockfile or `node_modules`.
- All application logic belongs in `script.js`.
- Do not create additional JS files, modules, or use `import` / `export`.
  `presets.js` and `data.js` are plain global data files.
- Preserve the project structure and the existing coding style.
- Prefer the simplest solution with the fewest concepts, files and abstractions.
- Avoid duplicated logic, redundant validation and defensive boilerplate.
- Do not add unrequested features. When a task conflicts with these rules, explain
  the conflict and choose the simplest compliant solution.
- Keep the app runnable without a server-side component. It must work from a static
  file server and offline after the first load.

---

## 2. Files

| File | Responsibility |
| --- | --- |
| `index.html` | App shell: all pages, sheets, modal, nav and page/section markup. |
| `style.css` | Entire design system and component CSS, organized in numbered sections. |
| `script.js` | All state, rendering, events, storage, photo DB and chart logic. |
| `data.js` | UI translations (`window.TRANSLATIONS`), ru and en. |
| `presets.js` | Read-only demo catalog (`window.PRESETS`). Replace with your reference data. |
| `sw.js` | Cache-first static assets + network-first navigation. Versioned cache. |
| `manifest.webmanifest` | PWA metadata. Keep its version in sync with `sw.js`. |
| `privacy.html` | Standalone local-only privacy template, with en/ru toggle. |
| `sprite.svg` | Inline SVG symbol sprite used through `<use href="sprite.svg#id">`. |
| `favicon.svg`, `icons/` | App icons. Replace when branding changes. |
| `todo.md` | Scratchpad; currently empty. |

Ignore local IDE/environment folders (`.idea/`, `.venv/`, `.DS_Store`) when packaging
the boilerplate.

---

## 3. Runtime architecture

Scripts load in this order: `presets.js` → `data.js` → `script.js`.

`script.js` is a single classic script with global state and top-level functions.
There is no framework, router or reactive layer. The flow is deliberately direct:

1. Data files expose `window.PRESETS` and `window.TRANSLATIONS`.
2. `script.js` takes DOM references once (section 9), then defines state, helpers,
   renderers and event handlers.
3. The IIFE at the bottom initializes in order:
   `setLanguage()` → `loadAll()` → `syncCurrencyText()` → `renderDiary()` →
   `openPhotoStore()`.
4. Pages are `<section>` elements. `renderPage(name)` hides the old page, updates
   the active nav item, shows the new page and calls its render function.
5. There is no URL router; navigation is in-memory. Page state such as the selected
   day, stats period and form drafts lives in module-level variables.

Key conventions:

- **State is global and minimal.** `entries`, `presets`, `settings`, `tags`,
  `favorites`, `recents`, current `date`, and the current `entry` / `presetDraft`.
- **DOM references are cached at the top.** Use `$("id")` only for elements that are
  created later or are awkward to cache.
- **Render by replacing HTML strings.** User text is passed through `clean()` before
  it is interpolated. Keep that rule when adding markup.
- **Events are delegated where content is dynamic** (`#day-entries`, `#entry-items`,
  `#search-results`, `#tag-actions`, charts, calendar) and assigned directly for
  fixed controls (`onclick = ...`).
- **No derived data is persisted.** Goals, summaries, ring values and chart series
  are calculated on render from entries/settings.
- **Numeric inputs use masks.** `maskNumber()` attaches input/paste normalization;
  `parseNumber()` converts localized input back to a number.
- **Debounce expensive input work.** `debounce(fn, ms)` supports `.flush()` for
  Enter/blur-like immediate handling.

---

## 4. Data model and storage

```js
entry = {
  created: 1793532852008,  // stable id / timestamp
  spent: 1793532840000,    // entry time
  key: 20261101,           // YYYYMMDD local day key
  category: 0,             // 0 food, 1 transport, 2 home, 3 other
  items: [{ presetId, name, amount }],
  tags: ["work"],
  note: "",
  photoId: null
}

preset = {
  id, en, ru, aliases: [], amount, category, tags: [],
  custom: false, archived: false
}

settings = {
  currency: "$",
  birthdate: 19900101,     // YYYYMMDD, 0 when empty
  sex: 1,                  // 0 female, 1 male
  activity: 1.375,         // 1.2 ... 1.9
  monthlyBudget: 1500,
  categoryBudgets: [400, 150, 450, 200]
}
```

- Categories are numeric constants (`FOOD`, `TRANSPORT`, `HOME`, `OTHER`) so that
  labels and currency can change without touching stored data.
- `localStorage` keys: `entries`, `presets`, `settings`, `tags`, `favorites`,
  `recents`. `STORAGE_KEYS` is the single list used by reset/import.
- Custom presets live in the `presets` array; built-in presets stay in
  `presets.js`. `findPreset()` checks custom presets first.
- Receipt photos live in IndexedDB (`DaybookPhotos`, store `photos`) as compressed
  blobs. They never leave the device. `gcPhotos()` removes unreferenced records on
  start and after import/reset.
- Export is a JSON snapshot guarded by `APP_NAME`; import validates the shape before
  replacing local storage.

To add persisted data, add a key to `STORAGE_KEYS`, a load/save helper near the
other storage helpers, include it in export/import, and clear it in `resetData()`.

---

## 5. Design conventions

The visual language is a warm, quiet, mobile-first journal. Preserve it unless the
task explicitly asks for a new direction.

- **Theme tokens** live at the top of `style.css` (`--bg`, `--text`, `--head`,
  `--line`, `--fade`, `--help`, `--accent`, `--blue`, `--green`, `--red`, `--yellow`,
  `--radius`). Dark mode only overrides tokens via `prefers-color-scheme`.
- **Typography:** system UI font stack, 18px base, 1.5 line-height. Use `.small`,
  `.big`, `.mono` (tabular numbers), `.help` (muted), `.accent`, `.red`, `.center`,
  `.left`, `.right`, `.grow`.
- **Layout utilities:** `.row`, `.col`, `.between`, `.gap-10/15/20/30`,
  `.pad-10/20`, `.width-500`, `.safe`, `.cta-space`, `.scroll`, `.hidden`.
- **Components:** `.tap` / `.chip` pills, `.segment`, `.input` / `.field` /
  `.unit-field` / `.big-field`, `.sheet` / `.sheet.full` / `.sheet.tall`,
  `.card`, `.card-item`, `.fab-round` / `.fab-close`, `.ring`, `.h-list`, `.legend`,
  `.entry` (entry row), `.result`, `.tags`, `.photo`.
- **Motion:** short CSS transitions only (segments, sheets, overlay, calendar
  swipe); avoid adding animation libraries.
- **Responsiveness:** 500px content column, bottom navigation with safe-area insets,
  sheets max 560px wide, `100dvh` for full-height screens. Charts re-render on width
  changes.
- **Icons:** 24px outline SVG symbols from `sprite.svg`; `.tool` for input/action
  icons, `.icon` for settings rows. Keep `stroke-linecap/linejoin` and the existing
  stroke widths.
- **Accessibility:** interactive non-buttons need `role`, `tabindex` and a key
  handler; icon-only controls need `data-i18n-aria-label`; sheets/modals use
  `role="dialog"` and `aria-modal`; Escape closes; nav uses `aria-current`.

---

## 6. Internationalization

- All UI copy is in `data.js`. `ru` and `en` must have identical key sets.
- Static markup uses `data-i18n`, `data-i18n-placeholder`, `data-i18n-title` or
  `data-i18n-aria-label`; `setLanguage()` fills them from `S`.
- Dynamic copy uses `S.key`, including arrays (`S.categories`, `S.wds`, `S.mons`),
  functions (`S.calendarStreak(days)`, `S.checkItems(n)`) and nested objects
  (`S.searchTabs.all`).
- Do not hardcode user-facing strings in `script.js` or `index.html`; add a key in
  both languages instead.
- The language is chosen from `navigator.language` on load (no in-app toggle).
  Number formatting follows the chosen locale: comma decimals in ru, dot in en.
- When adding a key, add it to **both** languages. `AGENTS.md` changes should not
  break the ru/en key parity.

---

## 7. Reusable features already implemented

Use these as patterns instead of reinventing them:

- **Calendar with month swipe**, selection, activity marks and a streak line.
- **Page navigation** with active state and hidden bottom nav on full-screen editors.
- **Bottom sheets** with overlay, Escape handling and scroll areas.
- **Modal confirmations** (`showModal`, `showMessage`) with optional yes/no.
- **Quick text parser**: comma/semicolon/newline fragments, `+` separator,
  fuzzy preset matching, amount extraction; unmatched lines become editable cards.
- **Fuzzy search** over names and aliases with Russian morphology plus Levenshtein.
- **Search tabs** for categories, favorites and quick picks (recent/frequent/my).
- **Tag editor** (add/remove/reorder by delete-and-add) and tag chips on entries.
- **Numeric masks** for amount fields; localized decimal separators.
- **Amount sheet** with increment/decrement, create-from-unmatched, delete.
- **Preset editor** with custom presets, category segment, default amount and archive.
- **Date/time picker** with calendar + draggable clock hand.
- **Person page** with a masked DD.MM.YYYY birthdate input (cursor-aware editing,
  deletion, paste and validation), a female/male segment, an activity range slider
  with level labels, and the budget form saved on blur with a computed daily budget
  and allocated total.
- **SVG chart helpers**: line, stacked area, vertical bars, weekday bars, heatmap,
  horizontal bar list, legends and interactive tooltips.
- **Photo pipeline**: file input, compression, IndexedDB, object URLs, cleanup.
- **Import/export/reset** and a service worker for offline use.
- **Light/dark tokens** and a PWA manifest.

---

## 8. How to extend

### Add a page

1. Add a `<section id="...-page" class="width-500 safe hidden">` in `index.html`.
2. Add it to `pages` and, if it belongs in the nav, to `navLinks`/`#nav`.
3. Add a `renderPage()` branch and a render function.
4. Add `data-i18n` labels in both languages.

### Add a sheet

1. Add `<div id="...-sheet" class="sheet" role="dialog" aria-modal="true">` near the
   other sheets.
2. Cache its elements in section 9, call `openSheet(sheet)` / `closeSheet()`.
3. Add a close/cancel button and an apply button; Escape and overlay are automatic.
4. If it contains text input, give it a real label/aria label and let the global
   readonly-on-load behavior work.

### Add a chart

1. Aggregate data into buckets (`getBuckets`, `getRange`, `pastDays` are reusable).
2. Use `renderLine`, `renderAreaStacked`, `renderVBars`, `renderHeatmap` or
   `barsHtml`; they handle axes, legends, tooltips and empty states.
3. Add a `.card` with `<div class="chart" id="...">` and set a `.value` summary with
   `setChartValue` / `setDayAverage`.
4. Call it from `renderStats()`.

### Add a category

Update `CATEGORIES`, `CATEGORY_COLORS`, the budget HTML (`#budget-*` inputs),
`categoryBudgetInputs`, translations, and any category-specific copy. Keep stored
category values stable numeric ids.

### Add a preset / change demo data

Edit `presets.js` rows. Row format:
`[id, en, ru, "alias|alias", amount, category, "tag|tag"]`.
Keep ids stable once users may have saved entries; custom presets start at
`1000000`.

### Add an entry field

Add it to `newEntry()`, `openEntry()` rendering, `saveEntry()`, `validImport()` if
needed, and the preset/entry UI. If it should be searchable or aggregated, wire it
into `parseFragment` / `sumItems` / stats.

### Replace the demo domain

To turn Daybook into another app, change these in order:

1. `APP_NAME`, `manifest.webmanifest`, `sw.js` cache prefix/version, privacy page,
   title/favicon/icons.
2. `data.js` keys and copy; keep ru/en parity.
3. `presets.js` (or replace it with your reference data) and the category constants.
4. `STORAGE_KEYS` and the shape in `load*` / `save*` / export/import.
5. Domain math in `sumItems`, `dailyBudget`, `renderStats`, `parseFragment`.
6. UI labels/fields in `index.html` and the corresponding render functions.
7. This file's data model and feature list.

Do not remove the shared shell, chart helpers, sheets, masks, tags, i18n or PWA
layer just because the demo domain changes.

---

## 9. Verification

There is no build step. Serve the folder over HTTP (the service worker requires it):

```sh
python3 -m http.server 8765
```

Then check:

- `node --check script.js && node --check data.js && node --check presets.js && node --check sw.js`
- No console errors on load, page switch, or after reload.
- Add an entry: type `coffee 4.50, bus 2.00`, verify amounts/partial match, save.
- Create a preset from an unmatched line; edit/archive it; search and favorite it.
- Toggle tags, notes, date/time picker, amount sheet and receipt photo.
- Stats: Day/Week/Month, amounts/shares, tooltips, scroll all cards.
- Person: enter a valid birthdate and check the mask/validation, switch sex, move the activity slider, change currency and budgets; verify diary rings.
- Export, import, reset; confirm data survives reload.
- Light and dark color schemes, 390px and desktop widths.
- Offline reload after the service worker is active.

When changing cached assets, **bump `CODE_VERSION` in `sw.js`** (and the manifest
version). The cache is versioned; otherwise returning users may keep old JS/CSS.

---

## 10. Style rules for code changes

- Match the existing style: 4-space indent in JS/HTML, 2-space in `sw.js`,
  double quotes in JS, semicolons, arrow functions for small helpers, section
  comments (`// ===...`) for major blocks.
- Keep functions small and named by what they render or do (`renderX`,
  `openX`, `applyX`, `saveX`).
- Prefer one clear pass over data; avoid clever abstractions.
- Reuse existing helpers before adding new ones (`fmt`, `money`, `clean`, `norm`,
  `debounce`, `setSegment`, `bindTagChips`, `maskNumber`).
- Do not introduce a component framework, state library, CSS preprocessor, bundler,
  router or icon package.
- Keep comments short, factual and in English. Explain non-obvious behavior only.
- Review the final diff and report which checks were actually run.
