// ==========================================================================
// 1. CONSTANTS
// ==========================================================================

const APP_NAME = "daybook";

const FOOD = 0;
const TRANSPORT = 1;
const HOME = 2;
const OTHER = 3;

const CATEGORIES = [FOOD, TRANSPORT, HOME, OTHER];
const CATEGORY_COLORS = {
    [FOOD]: "--red",
    [TRANSPORT]: "--blue",
    [HOME]: "--yellow",
    [OTHER]: "--green",
};

const DAY = 0;
const WEEK = 1;
const MONTH = 2;

const MAX_AMOUNT = 1000000;

const PHOTO_MAX_WIDTH = 1280;
const PHOTO_QUALITY = 0.82;

const DEFAULT_SETTINGS = {
    birthdate: 0,
    sex: 1,
    activity: 1.375,
    monthlyBudget: 1500,
    categoryBudgets: [400, 150, 450, 200],
};

const STORAGE_KEYS = [
    "entries",
    "presets",
    "settings",
    "tags",
    "favorites",
    "recents",
];

// Russian word endings used by the fuzzy search. They are only a helper for
// matching user input; there is no morphological dictionary in the project.
const RU_ENDINGS = [
    "ами", "ями", "ого", "его", "ому", "ему", "ыми", "ими", "ов", "ев", "ей",
    "ам", "ям", "ах", "ях", "ом", "ем", "ой", "ый", "ий", "ая", "яя", "ое",
    "ее", "ые", "ие", "ых", "их", "ую", "юю", "ть", "ся", "а", "я", "о", "е",
    "ы", "и", "у", "ю", "й", "ь",
];

// ==========================================================================
// 2. EXTERNAL DATA
// ==========================================================================

const PRESETS = Array.isArray(window.PRESETS)
    ? window.PRESETS
    : (console.warn("window.PRESETS is not an array, preset catalog is empty"), []);
const translations = window.TRANSLATIONS || {};

// ==========================================================================
// 3. STATE
// ==========================================================================

let S = {};
let lang = "en";

let settings;
let entries = [];
let presets = [];
let tags = [];

let favorites = [];
let recents = [];

let date = new Date();
let today = new Date(date);

let calendarDate = new Date(date);
let calendarPages = {};
let chosenButton = null;

let page = null;
let link = null;

// ==========================================================================
// 4. UTILS
// ==========================================================================

const $ = (id) => document.getElementById(id);

const pad = (n, d = 2) => String(n).padStart(d, "0");
const getDateKey = (d) => {
    d = new Date(d);
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
};
const getTimeText = (d) => {
    d = new Date(d);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const getDateText = (d) => {
    d = new Date(d);
    return `${d.getDate()} ${S.mons[d.getMonth()]}`;
};

const startOfDay = (d) => {
    d = new Date(d);
    d.setHours(0, 0, 0, 0);
    return d;
};

const addDays = (d, n) => {
    d = new Date(d);
    d.setDate(d.getDate() + n);
    return d;
};

const getMonday = (d) => {
    const x = startOfDay(d);
    const day = x.getDay();
    x.setDate(x.getDate() - (day === 0 ? 6 : day - 1));
    return x;
};

const getWeekday = (d) => (new Date(d).getDay() + 6) % 7;

const daysInMonth = (d) =>
    new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

const round = (x, d = 0) => Math.round(x * 10 ** d) / 10 ** d;

const fmt = (x, d = 0) => {
    const value = x ? String(round(x, d)) : "0";
    return S.locale?.startsWith("ru") ? value.replace(".", ",") : value;
};

const money = (x, d = 2) =>
    `${fmt(x, d)} ${settings?.currency || S.currencySymbol || ""}`;

const clean = (s) =>
    String(s)
        .normalize("NFKC")
        .replace(/[^\p{L}\p{M}\p{N}\s-]/gu, " ")
        .replace(/\s+/gu, " ")
        .trim()
        .slice(0, 100);

const norm = (s) =>
    s.trim().toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ");

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const clamp = (x, min = 0, max = 1) => Math.min(max, Math.max(min, x));

const average = (values) => {
    const list = values.filter((v) => v != null);
    return list.length ? list.reduce((a, v) => a + v, 0) / list.length : null;
};

const debounce = (fn, ms) => {
    let timer = null;
    let lastArgs = [];
    const call = (...args) => {
        lastArgs = args;
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
    call.flush = () => {
        if (timer === null) return;
        clearTimeout(timer);
        timer = null;
        fn(...lastArgs);
    };
    return call;
};

// ==========================================================================
// 5. CALCULATIONS
// ==========================================================================

const sumItems = (items) => {
    if (!items.length) return null;
    return {
        total: items.reduce((sum, item) => sum + (item.amount || 0), 0),
        count: items.length,
    };
};

const sumEntries = (list) => sumItems(list.flatMap((entry) => entry.items));

const getDayEntries = (key) => entries.filter((entry) => entry.key === key);

const sumDay = (key) => sumItems(getDayEntries(key).flatMap((entry) => entry.items));

const categoryTotal = (list, category) =>
    sumItems(
        list
            .filter((entry) => entry.category === category)
            .flatMap((entry) => entry.items),
    )?.total || 0;

const dailyBudget = (d = date) => settings.monthlyBudget / daysInMonth(d);

const categoryDailyBudget = (category, d = date) =>
    settings.categoryBudgets[category] / daysInMonth(d);

const budgetColor = (ratio) =>
    ratio > 1 ? "--red" : ratio > 0.85 ? "--yellow" : "--green";

const inBudget = (d) => {
    const total = sumDay(getDateKey(d))?.total;
    return total != null && total <= dailyBudget(d);
};

const getStreak = () => {
    let days = 0;
    let d = addDays(today, -1);
    while (inBudget(d)) {
        days++;
        d = addDays(d, -1);
    }
    return days;
};

// ==========================================================================
// 6. PRESETS AND SEARCH
// ==========================================================================

const findPreset = (id) =>
    id == null
        ? null
        : presets.find((item) => item.id === id) ||
        PRESETS.find((item) => item.id === id) ||
        null;

const getActivePresets = () => [
    ...presets.filter((item) => !item.archived),
    ...PRESETS,
];

const normalizeWord = (w) => {
    w = w.toLowerCase().replace(/ё/g, "е");

    if (/[а-я]/.test(w)) {
        for (const e of RU_ENDINGS) {
            if (w.length - e.length >= 3 && w.endsWith(e)) return w.slice(0, -e.length);
        }
        return w;
    }
    if (/(o|x|ch|sh|ss)es$/.test(w) && w.length >= 5) return w.slice(0, -2);
    if (/[^aeiou]ies$/.test(w) && w.length >= 6) return w.slice(0, -3) + "y";
    if (w.endsWith("s") && !w.endsWith("ss") && w.length >= 4) return w.slice(0, -1);
    return w;
};

const normalizePhrase = (s) => s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9\s-]/g, " ")
    .trim()
    .split(/[\s-]+/)
    .filter(Boolean)
    .map(normalizeWord)
    .join(" ");

const levenshtein = (a, b) => {
    if (a.length < b.length) [a, b] = [b, a];
    let prev = Array.from({length: b.length + 1}, (_, i) => i);

    for (let i = 1; i <= a.length; i++) {
        const cur = [i];
        for (let j = 1; j <= b.length; j++)
            cur[j] = Math.min(
                prev[j] + 1,
                cur[j - 1] + 1,
                prev[j - 1] + (a[i - 1] !== b[j - 1]),
            );
        prev = cur;
    }
    return prev[b.length];
};

const similarity = (a, b) =>
    a === b ? 1 : 1 - levenshtein(a, b) / Math.max(a.length, b.length, 1);

const phraseSimilarity = (a, b) => {
    if (a === b) return 1;

    const aWords = a.split(" ");
    const bWords = b.split(" ");
    const pairs = [];

    for (let i = 0; i < aWords.length; i++)
        for (let j = 0; j < bWords.length; j++)
            pairs.push([similarity(aWords[i], bWords[j]), i, j]);

    pairs.sort((a, b) => b[0] - a[0]);

    const usedA = new Set();
    const usedB = new Set();
    let total = 0;

    for (const [s, i, j] of pairs) {
        if (usedA.has(i) || usedB.has(j)) continue;
        total += s;
        usedA.add(i);
        usedB.add(j);
    }

    const words = (2 * total) / (aWords.length + bWords.length);
    return 0.9 * words + 0.1 * similarity(a, b);
};

const keysCache = new WeakMap();

const presetKeys = (item) => {
    let keys = keysCache.get(item);
    if (!keys) {
        keys = [
            ...new Set(
                [item.en, item.ru, ...(item.aliases || [])]
                    .filter(Boolean)
                    .map(normalizePhrase)
                    .filter(Boolean),
            ),
        ];
        keysCache.set(item, keys);
    }
    return keys;
};

const matchScore = (item, query) => {
    if (!query) return 0;

    let score = 0;
    for (const key of presetKeys(item))
        score = Math.max(score, phraseSimilarity(key, query));
    return score;
};

let presetsCounter;

const updatePresetsCounter = () => {
    if (presetsCounter) return;
    presetsCounter = new Map();
    entries.forEach((entry) =>
        entry.items.forEach(({presetId}) => {
            if (presetId != null)
                presetsCounter.set(presetId, (presetsCounter.get(presetId) || 0) + 1);
        }),
    );
};

// Candidate comparison: confidence, custom preset, favorites, frequency,
// shorter name.
const comparePresetMatches = (a, b) => {
    updatePresetsCounter();
    return (
        b.confidence - a.confidence ||
        b.preset.custom - a.preset.custom ||
        favorites.includes(b.preset.id) - favorites.includes(a.preset.id) ||
        (presetsCounter.get(b.preset.id) || 0) -
        (presetsCounter.get(a.preset.id) || 0) ||
        a.preset[lang].length - b.preset[lang].length
    );
};

const rankPresets = (query, active = getActivePresets()) => {
    query = normalizePhrase(query);
    if (!query) return [];
    return active
        .map((preset) => ({preset, confidence: matchScore(preset, query)}))
        .filter((match) => match.confidence >= 0.5)
        .sort(comparePresetMatches);
};

const matchPreset = (text, active) => rankPresets(text, active)[0] || null;

// ==========================================================================
// 7. PARSER
// ==========================================================================

const splitFragments = (text) =>
    text
        .split(/[;\n]|(?<!\d),|,(?!\d)/)
        .map(norm)
        .filter(Boolean)
        .flatMap((part) => part.split(/\s*\+\s*/))
        .map(norm)
        .filter(Boolean);

const parseFragment = (fragment) => {
    const text = norm(fragment).replace(/[€$₽]/g, " ").replace(/\s+/g, " ").trim();
    const number = text.match(/(\d+(?:[.,]\d+)?)/);
    const amount = number ? +number[1].replace(",", ".") : null;
    const name = clean(
        number
            ? text.slice(0, number.index) +
            " " +
            text.slice(number.index + number[0].length)
            : text,
    );
    const match = name ? matchPreset(name) : null;

    if (match) {
        return {
            ...makeItem(match.preset, amount ?? match.preset.amount),
            fragment: norm(fragment),
        };
    }
    return {
        presetId: null,
        name: capitalize(name || S.amount),
        amount: amount ?? 0,
        fragment: norm(fragment),
    };
};

const parseEntry = (text) => splitFragments(text).map(parseFragment);

const makeItem = (preset, amount) => ({
    presetId: preset.id,
    name: preset[lang],
    amount: Math.max(0, amount ?? preset.amount),
});

const displayItemName = (item) =>
    findPreset(item.presetId)?.[lang] || item.name;

const isProblem = (item) => item.presetId == null;

// ==========================================================================
// 8. NUMERIC MASKS
// ==========================================================================

const normalizeNumber = (v, max, decimals) => {
    v = v.replace(",", ".").replace(/[^\d.]/g, "");
    const i = v.indexOf(".");
    if (i >= 0) {
        v = decimals
            ? v.slice(0, i + 1) +
            v
                .slice(i + 1)
                .replace(/\./g, "")
                .slice(0, decimals)
            : v.slice(0, i);
    }
    v = v.replace(/^0+(?=\d)/, "");
    while (v && +v > max) v = v.slice(0, -1);
    return S.locale?.startsWith("ru") ? v.replace(".", ",") : v;
};

const parseNumber = (s) => {
    const v = Number(s.replace(",", "."));
    return s.trim() && Number.isFinite(v) ? v : null;
};

const maskNumber = (input, max, decimals) => {
    input.addEventListener("input", () => {
        input.value = normalizeNumber(input.value, max, decimals);
    });
    input.addEventListener("paste", (e) => {
        e.preventDefault();
        input.value = normalizeNumber(
            e.clipboardData.getData("text"),
            max,
            decimals,
        );
        input.dispatchEvent(new Event("input"));
    });
};

// ==========================================================================
// 9. DOM LINKS
// ==========================================================================

/* --- Pages and navigation --- */
const pages = {
    diary: $("diary-page"),
    entry: $("entry-page"),
    preset: $("preset-page"),
    stats: $("stats-page"),
    person: $("person-page"),
    settings: $("settings-page"),
};

const nav = $("nav");
const navBar = $("nav-bar");
const navLinks = {
    diary: $("nav-diary"),
    entry: $("add-entry"),
    stats: $("nav-stats"),
    person: $("nav-person"),
    settings: $("nav-settings"),
};

/* --- Diary --- */
const calendar = $("calendar");
const calendars = $("calendars");
const chosenDay = $("chosen-day");
const dayEntries = $("day-entries");
const categoryRings = $("category-rings");
const summaryRings = $("summary-rings");
const dayBreakdown = $("day-breakdown");

/* --- Entry --- */
const entryDate = $("entry-date");
const entryTime = $("entry-time");
const entryCategory = $("entry-category");
const entryText = $("entry-text");
const clearText = $("clear-text");
const iconPhoto = $("icon-photo");
const iconVoice = $("icon-voice");
const iconSearch = $("icon-search");
const iconStar = $("icon-star");
const iconPlus = $("icon-plus");
const photoInput = $("photo-input");
const entryPhoto = $("entry-photo");
const entryItems = $("entry-items");
const entryTotal = $("entry-total");
const tagButtons = $("tag-buttons");
const editTagsButton = $("edit-tags");
const noteBlock = $("note-block");
const entryNote = $("entry-note");
const entryDelete = $("entry-delete");
const confirmButton = $("confirm");
const cancelButton = $("cancel");

/* --- Preset --- */
const presetName = $("preset-name");
const presetAmount = $("preset-amount");
const presetCategory = $("preset-category");
const presetTags = $("preset-tags");
const presetArchive = $("preset-archive");
const presetSave = $("preset-save");
const presetCancel = $("preset-cancel");

/* --- Overlay and modal --- */
const overlay = $("overlay");
const modal = $("modal");
const question = $("question");
const modalYes = $("modal-yes");
const modalNo = $("modal-no");

/* --- Search --- */
const searchSheet = $("search-sheet");
const searchInput = $("search-input");
const searchClear = $("search-clear");
const searchTabs = $("search-tabs");
const searchResults = $("search-results");
const searchBack = $("search-back");

/* --- Amount --- */
const portionSheet = $("portion-sheet");
const portionTitle = $("portion-title");
const portionAmount = $("portion-amount");
const portionMinus = $("portion-minus");
const portionPlus = $("portion-plus");
const portionCreate = $("portion-create");
const portionDelete = $("portion-delete");
const portionConfirm = $("portion-confirm");

/* --- Tags --- */
const tagsSheet = $("tags-sheet");
const tagInput = $("tag");
const createTagButton = $("create-tag");
const tagActions = $("tag-actions");
const closeTags = $("close-tags");
const applyTags = $("apply-tags");

/* --- Date/time picker --- */
const whenPicker = $("when-picker");
const whenCalendar = $("when-calendar");
const whenDays = $("when-days");
const clock = $("clock");
const hand = $("hand");
const line = $("line");
const white = $("white");
const black = $("black");
const dayButton = $("day");
const hourButton = $("hour");
const minuteButton = $("minute");
const closeWhen = $("close-when");
const applyWhen = $("apply-when");

/* --- Person and budget --- */
const birthdateInput = $("birthdate");
const sexInput = $("sex");
const activityInput = $("activity");
const activityLevel = $("activity-level");
const currencySegment = $("currency");
const monthlyBudgetInput = $("monthly-budget");
const categoryBudgetInputs = {
    [FOOD]: $("budget-food"),
    [TRANSPORT]: $("budget-transport"),
    [HOME]: $("budget-home"),
    [OTHER]: $("budget-other"),
};
const budgetSummary = $("budget-summary");
const budgetInputs = [monthlyBudgetInput, ...Object.values(categoryBudgetInputs)];

/* --- Settings --- */
const exportButton = $("export");
const importButton = $("import");
const importInput = $("import-input");
const resetButton = $("reset");

/* --- Statistics --- */
const periodArea = $("period");
const rangeArea = $("range");
const rangeLabel = $("range-label");
const chartTip = $("chart-tip");

const presetCurrencies = document.querySelectorAll(".preset-currency");
const budgetCurrencies = document.querySelectorAll(".budget-currency");

// ==========================================================================
// 10. LANGUAGE
// ==========================================================================

const syncCurrencyText = () => {
    const currency = settings?.currency || S.currencySymbol || "";
    presetCurrencies.forEach((el) => (el.textContent = currency));
    budgetCurrencies.forEach((el) => (el.textContent = currency));
};

const setLanguage = () => {
    lang = navigator.language?.toLowerCase().startsWith("ru") ? "ru" : "en";
    document.documentElement.lang = lang;
    S = translations[lang];

    document
        .querySelectorAll("[data-i18n]")
        .forEach((el) => (el.textContent = S[el.dataset.i18n]));
    document
        .querySelectorAll("[data-i18n-placeholder]")
        .forEach((el) => (el.placeholder = S[el.dataset.i18nPlaceholder]));
    document
        .querySelectorAll("[data-i18n-title]")
        .forEach((el) => (el.title = S[el.dataset.i18nTitle]));
    document
        .querySelectorAll("[data-i18n-aria-label]")
        .forEach((el) =>
            el.setAttribute("aria-label", S[el.dataset.i18nAriaLabel]),
        );

    whenCalendar.firstElementChild.innerHTML = S.wds
        .map((w) => `<span>${w}</span>`)
        .join("");

    syncCurrencyText();
};

// ==========================================================================
// 11. STORAGE
// ==========================================================================

const read = (key, fallback) => {
    try {
        const value = localStorage.getItem(key);
        return value == null ? fallback : JSON.parse(value);
    } catch {
        console.warn(`localStorage: cannot read ${key}`);
        return fallback;
    }
};

const write = (key, value) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch {
        showMessage(S.storageError);
        return false;
    }
};

const invalidate = () => {
    calendarPages = {};
};

const sortEntries = () => entries.sort((a, b) => a.spent - b.spent);

const saveEntries = () => {
    invalidate();
    presetsCounter = null;
    write("entries", entries);
    sortEntries();
};

const savePresets = () => write("presets", presets);
const saveTags = () => write("tags", tags);
const saveFavorites = () => write("favorites", favorites);
const saveRecents = () => write("recents", recents);
const saveSettings = () => write("settings", settings);

const loadSettings = () => {
    const stored = read("settings", null);
    settings = {
        currency: stored?.currency || S.currencySymbol,
        birthdate: Number(stored?.birthdate) || 0,
        sex: Number(stored?.sex ?? DEFAULT_SETTINGS.sex),
        activity: Number(stored?.activity) || DEFAULT_SETTINGS.activity,
        monthlyBudget: Number(stored?.monthlyBudget) || DEFAULT_SETTINGS.monthlyBudget,
        categoryBudgets: CATEGORIES.map(
            (i) => Number(stored?.categoryBudgets?.[i]) || 0,
        ),
    };
    if (!stored) {
        settings.categoryBudgets = [...DEFAULT_SETTINGS.categoryBudgets];
    }
};

const loadEntries = () => {
    entries = read("entries", []).filter(Boolean);
    sortEntries();
};

const loadPresets = () => {
    presets = read("presets", []).filter(Boolean);
};

const loadTags = () => {
    tags = read("tags", [...S.defaultTags]).filter(Boolean);
    favorites = read("favorites", []);
    recents = read("recents", []);
};

const loadAll = () => {
    invalidate();
    loadSettings();
    loadEntries();
    loadPresets();
    loadTags();
};

const MAX_RECENT = 50;

const updateRecents = (items) => {
    const now = Date.now();

    const dst = [];
    const presetIds = new Set();

    for (const {presetId, amount} of items) {
        if (presetId == null || presetIds.has(presetId)) continue;
        dst.push({presetId, amount, date: now});
        presetIds.add(presetId);
    }
    for (const q of recents) {
        if (presetIds.has(q.presetId)) continue;
        dst.push(q);
        if (dst.length === MAX_RECENT) break;
    }
    recents = dst;
    saveRecents();
};

/* --- Export and import --- */

const exportData = () => {
    const data = {
        app: APP_NAME,
        exported: Date.now(),
        entries,
        presets,
        settings,
        tags,
        favorites,
        recents,
    };
    const blob = new Blob([JSON.stringify(data)], {type: "application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${APP_NAME}-${getDateKey(new Date())}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

const IMPORT_ARRAYS = [
    "entries",
    "presets",
    "tags",
    "favorites",
    "recents",
];

const validImport = (data) => {
    try {
        return (
            data.app === APP_NAME &&
            data.settings &&
            Number.isFinite(Number(data.settings.monthlyBudget)) &&
            Array.isArray(data.settings.categoryBudgets) &&
            IMPORT_ARRAYS.every((k) => Array.isArray(data[k])) &&
            data.entries.every(
                (entry) =>
                    Number.isFinite(entry.spent) &&
                    Array.isArray(entry.items),
            )
        );
    } catch {
        return false;
    }
};

const importData = (data) => {
    const payload = Object.fromEntries(IMPORT_ARRAYS.map((k) => [k, data[k]]));
    payload.settings = data.settings;
    if (!Object.keys(payload).every((k) => write(k, payload[k]))) return;
    loadAll();
    date = new Date();
    calendarDate = new Date(date);
    renderPage("diary");
    gcPhotos();
};

const resetData = async () => {
    STORAGE_KEYS.forEach((k) => localStorage.removeItem(k));
    loadAll();
    await clearPhotos();
    date = new Date();
    calendarDate = new Date(date);
    renderPage("diary");
};

// ==========================================================================
// 12. PHOTOS (IndexedDB)
// ==========================================================================

let photoDb = null;
let lastPhotoId = 0;
const photoUrls = new Map();
const photoRenderTokens = new WeakMap();

const nextPhotoId = () => (lastPhotoId = Math.max(Date.now(), lastPhotoId + 1));

const openPhotoStore = () =>
    new Promise((resolve) => {
        if (!window.indexedDB) return resolve(null);
        try {
            const request = indexedDB.open("DaybookPhotos", 1);
            request.onupgradeneeded = () =>
                request.result.createObjectStore("photos", {keyPath: "id"});
            request.onsuccess = () => {
                photoDb = request.result;
                document.body.classList.add("photos");
                resolve(photoDb);
            };
            request.onerror = () => resolve(null);
        } catch {
            resolve(null);
        }
    });

const photoStore = (mode, fn) =>
    new Promise((resolve, reject) => {
        const tx = photoDb.transaction("photos", mode);
        const request = fn(tx.objectStore("photos"));
        tx.oncomplete = () => resolve(request?.result);
        tx.onerror = () => reject(tx.error);
    });

const getPhoto = (id) => photoStore("readonly", (s) => s.get(id));
const putPhoto = (record) => photoStore("readwrite", (s) => s.put(record));
const removePhoto = (id) => photoStore("readwrite", (s) => s.delete(id));
const allPhotos = () => photoStore("readonly", (s) => s.getAll());

const loadImage = (file) =>
    new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("loadImage"));
        };
        img.src = url;
    });

const compressImage = async (file, maxWidth = PHOTO_MAX_WIDTH, quality = PHOTO_QUALITY) => {
    const source = await createImageBitmap(file).catch(() => loadImage(file));
    const scale = Math.min(1, maxWidth / Math.max(source.width, source.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(source.width * scale);
    canvas.height = Math.round(source.height * scale);
    canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
    );
    return {blob, width: canvas.width, height: canvas.height};
};

const addPhoto = async (file) => {
    if (!photoDb) return null;
    try {
        const {blob, width, height} = await compressImage(file);
        const id = nextPhotoId();
        await putPhoto({
            id,
            blob,
            mime: "image/jpeg",
            width,
            height,
            size: blob.size,
            createdAt: Date.now(),
        });
        return id;
    } catch (e) {
        console.warn("addPhoto", e);
        return null;
    }
};

const getPhotoUrl = async (id) => {
    if (photoUrls.has(id)) return photoUrls.get(id);
    const record = photoDb ? await getPhoto(id).catch(() => null) : null;
    if (!record?.blob) return null;
    const url = URL.createObjectURL(record.blob);
    photoUrls.set(id, url);
    return url;
};

const deletePhoto = async (id) => {
    if (!photoDb || id == null) return;
    const url = photoUrls.get(id);
    if (url) {
        URL.revokeObjectURL(url);
        photoUrls.delete(id);
    }
    await removePhoto(id);
};

const referencedPhotos = () =>
    new Set(
        [
            ...entries.map((item) => item.photoId),
            entry?.photoId,
        ].filter((id) => id != null),
    );

const gcPhotos = async () => {
    if (!photoDb) return;
    const used = referencedPhotos();
    for (const record of await allPhotos()) {
        if (!used.has(record.id)) await deletePhoto(record.id);
    }
};

const clearPhotos = async () => {
    if (!photoDb) return;
    for (const record of await allPhotos()) await deletePhoto(record.id);
};

const renderPhoto = async (container, id) => {
    const token = Symbol();
    photoRenderTokens.set(container, token);
    container.classList.toggle("hidden", id == null);
    container.innerHTML = "";
    if (id == null) return;
    const url = await getPhotoUrl(id);
    if (photoRenderTokens.get(container) !== token) return;
    container.innerHTML = `
        ${url ? `<img src="${url}" alt="">` : '<div class="photo-stub"><svg><use href="sprite.svg#camera"></use></svg></div>'}
        <button class="photo-remove" aria-label="${S.removePhoto}"><svg><use href="sprite.svg#close"></use></svg></button>`;
};

// ==========================================================================
// 13. NAVIGATION, SHEETS, MODAL WINDOW
// ==========================================================================

const renderPage = (name, withLink = true) => {
    if (page) page.classList.add("hidden");
    if (link) {
        link.classList.remove("active");
        link.removeAttribute("aria-current");
    }

    page = pages[name];
    link = withLink ? navLinks[name] || null : null;

    page.classList.remove("hidden");
    if (link) {
        link.classList.add("active");
        link.setAttribute("aria-current", "page");
    }
    navBar.classList.toggle("hidden", name === "entry" || name === "preset");
    window.scrollTo(0, 0);

    if (name === "diary") renderDiary();
    else if (name === "stats") {
        renderRange();
        renderStats();
    } else if (name === "person") {
        renderPerson();
    }
};

const toDiaryPage = () => renderPage("diary");

nav.onclick = (e) => {
    const button = e.target.closest("button");
    if (!button || button === link) return;
    renderPage(button.dataset.page);
};

navLinks.entry.onclick = () => openEntry(newEntry(), true);

let openedSheet = null;

const openSheet = (sheet) => {
    closeSheet();
    openedSheet = sheet;
    overlay.classList.add("open");
    openedSheet.classList.add("open");
};

const closeSheet = () => {
    if (!openedSheet) return;
    openedSheet.classList.remove("open");
    overlay.classList.remove("open");
    openedSheet = null;
};

overlay.onclick = closeSheet;

let onModalYes = null;

const showModal = (text, onYes) => {
    question.textContent = text;
    onModalYes = onYes;
    modalYes.textContent = onYes ? S.yes : "OK";
    modalNo.classList.toggle("hidden", !onYes);
    modal.hidden = false;
};

const showMessage = (text) => showModal(text, null);

const closeModal = () => {
    modal.hidden = true;
    onModalYes = null;
};

modalYes.onclick = () => {
    const callback = onModalYes;
    closeModal();
    if (callback) callback();
};
modalNo.onclick = closeModal;
modal.onclick = (e) => {
    if (e.target === modal) closeModal();
};

document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!modal.hidden) closeModal();
    else closeSheet();
});

/* --- Segments --- */

const setSegment = (segment, value, attr) => {
    const buttons = [...segment.querySelectorAll("button")];
    const i = Math.max(
        0,
        buttons.findIndex((b) => b.dataset[attr] === String(value)),
    );
    segment.style.setProperty("--n", String(buttons.length));
    segment.style.setProperty("--i", String(i));
    buttons.forEach((b, j) => b.classList.toggle("active", j === i));
};

const onSegment = (segment, attr, callback) => {
    segment.addEventListener("click", (e) => {
        const button = e.target.closest("button");
        if (!button || button.classList.contains("active")) return;
        setSegment(segment, button.dataset[attr], attr);
        callback(button.dataset[attr]);
    });
};

// ==========================================================================
// 14. DIARY
// ==========================================================================

const RING_LENGTH = 2 * Math.PI * 28;

const ringHtml = ({kind, value, delta, target, label, color, decimals = 0}) => {
    target = Math.max(1, target || 0);
    let ring;
    let tick = "";

    if (Math.abs(delta) > target) {
        const d = delta > 0 ? "M 29 0 L 32 4 L 29 9" : "M 35 0 L 32 4 L 35 9";
        ring = `<circle class="fill" cx="32" cy="32" r="28" stroke="var(${color})" />`;
        tick = `<path d="${d}" stroke="var(--bg)" stroke-width="2" transform="rotate(${360 * delta / target} 32 32)"/>`;
    } else {
        const ratio = Math.abs(delta / target);
        const length = RING_LENGTH * ratio;
        const angle = 90 + (delta < 0) * 360 * ratio;
        ring = `<circle class="fill" cx="32" cy="32" r="28"
            style="stroke:var(${color});stroke-dasharray:${length} ${RING_LENGTH}"
            transform="rotate(-${angle} 32 32)"/>`;
    }

    return `<div class="ring" data-kind="${kind}" aria-label="${label}">
        <svg viewBox="0 0 64 64" aria-hidden="true">
            <circle class="track" cx="32" cy="32" r="28"></circle>
            ${ring}
            ${tick}
        </svg>
        <div class="ring-value mono">${fmt(value, decimals)}</div>
        <div class="small help center">${label}</div>
    </div>`;
};

const renderCategoryRings = () => {
    const list = getDayEntries(getDateKey(date));
    categoryRings.innerHTML = CATEGORIES.map((category) => {
        const spent = categoryTotal(list, category);
        return ringHtml({
            kind: category,
            value: spent,
            delta: spent,
            target: categoryDailyBudget(category, date),
            label: S.categories[category],
            color: CATEGORY_COLORS[category],
        });
    }).join("");
};

const renderSummaryRings = () => {
    const total = sumDay(getDateKey(date))?.total || 0;
    const budget = dailyBudget(date);
    const weekStart = getMonday(date);
    const weekEnd = addDays(weekStart, 7);
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    const weekTotal = sumEntries(
        entries.filter((item) => item.spent >= weekStart && item.spent < weekEnd),
    )?.total || 0;
    const monthTotal = sumEntries(
        entries.filter((item) => item.spent >= monthStart && item.spent < monthEnd),
    )?.total || 0;

    summaryRings.innerHTML = [
        {
            kind: "spent",
            value: total,
            delta: total,
            target: budget,
            label: S.spent,
            color: "--red",
        },
        {
            kind: "left",
            value: Math.max(0, budget - total),
            delta: Math.max(0, budget - total),
            target: budget,
            label: S.left,
            color: "--green",
        },
        {
            kind: "week",
            value: weekTotal,
            delta: weekTotal,
            target: budget * 7,
            label: S.weekSpent,
            color: "--blue",
        },
        {
            kind: "month",
            value: monthTotal,
            delta: monthTotal,
            target: settings.monthlyBudget,
            label: S.monthSpent,
            color: "--yellow",
        },
    ]
        .map(ringHtml)
        .join("");
};

const barsHtml = (rows) =>
    rows
        .map(
            ({label, value, number}) => `
    <div class="h-col">
        <div class="h-label">${clean(label)}</div>
        <div class="h-value" style="--count:${clamp(value, 0, 100)};--total:100">
            <div class="h-bar" style="--color:var(--accent)"></div>
            <span class="h-number">${number ?? fmt(value)}</span>
        </div>
    </div>`,
        )
        .join("");

const renderDayBreakdown = () => {
    const list = getDayEntries(getDateKey(date));
    const total = sumDay(getDateKey(date))?.total || 0;
    if (!total) {
        dayBreakdown.innerHTML = "";
        return;
    }

    const rows = CATEGORIES.map((category) => {
        const spent = categoryTotal(list, category);
        return {
            label: S.categories[category],
            value: (spent / total) * 100,
            number: `${fmt((spent / total) * 100)}%`,
        };
    }).filter((row) => row.value > 0);

    dayBreakdown.innerHTML = barsHtml(rows);
};

/* --- Calendar --- */

const getMarkHtml = (s, budget) => {
    if (!s) return "";
    const ratio = budget ? s.total / budget : 0;
    const size = Math.min(64, 16 + 24 * Math.min(ratio, 2));
    return `<i style="width:${size}px;height:${size}px;background:var(${budgetColor(ratio)})"></i>`;
};

const addPageMonth = (delta) => {
    const month = calendarDate.getMonth() + delta;
    const year = calendarDate.getFullYear();
    const m = (month + 12) % 12;
    const y = year + delta * (month !== m);
    calendarDate.setDate(1);
    calendarDate.setFullYear(y);
    calendarDate.setMonth(m);
};

const getCalendarPage = (delta = 0) => {
    const month = calendarDate.getMonth() + delta;
    const year = calendarDate.getFullYear();
    const m = (month + 12) % 12;
    const y = year + delta * (month !== m);
    const k = 100 * y + m;

    if (calendarPages[k]) return calendarPages[k];

    const first = (new Date(y, m, 1).getDay() + 6) % 7;
    const last = new Date(y, m + 1, 0).getDate();
    const todayKey = getDateKey(today);
    const dateKey = getDateKey(date);

    const dayHtml = (n) => {
        const day = new Date(y, m, n);
        const key = getDateKey(day);
        const s = sumDay(key);
        const color = key > todayKey ? "--help" : "--text";
        return `<button><span style="color:var(${color})" class="${key === dateKey ? "big" : ""}">${n}</span>${getMarkHtml(s, dailyBudget(day))}</button>`;
    };

    let days =
        S.wds.map((w) => `<span>${w}</span>`).join("") +
        '<span class="empty"></span>'.repeat(first);
    for (let i = 1; i <= last; i++) days += dayHtml(i);

    const dst = document.createElement("DIV");
    dst.className = "calendar";
    dst.innerHTML = `
        <div class="small help center top-20">${S.calendarStreak(getStreak())}</div>
        <h2 class="row">
            <button class="prev" aria-label="${S.previous}"><svg><use href="sprite.svg#prev"></use></svg></button>
            <span class="big">${S.months[m]} ${y}</span>
            <button class="next" aria-label="${S.next}"><svg><use href="sprite.svg#next"></use></svg></button>
        </h2>
        <div class="days">${days}</div>`;
    calendarPages[k] = dst;
    return dst;
};

const renderPageCalendar = () => {
    calendar.replaceChildren(getCalendarPage());
    chosenButton = calendar.querySelector(".days .big");
};

calendar.addEventListener("click", (e) => {
    const button = e.target.closest("button");
    if (!button) return;

    if (button.classList.contains("prev") || button.classList.contains("next")) {
        addPageMonth(button.classList.contains("prev") ? -1 : 1);
        return renderPageCalendar();
    }

    if (chosenButton) chosenButton.classList.remove("big");
    chosenButton = button.firstElementChild;
    chosenButton.classList.add("big");

    date = new Date(
        calendarDate.getFullYear(),
        calendarDate.getMonth(),
        +chosenButton.textContent,
        12,
    );
    renderDay();
});

/* --- Swipe between months --- */

let startX = null;
let dragging = false;
let shift = 0;
let delta = 0;
let width = 0;

const MIN_SHIFT = 10;
const MAX_SHIFT = 40;

const renderCalendars = () => {
    width = calendar.clientWidth + 30;
    calendars.style.setProperty("--width", `${calendar.clientWidth}px`);
    calendars.replaceChildren(
        getCalendarPage(-1),
        getCalendarPage(),
        getCalendarPage(1),
    );
    calendar.replaceChildren(calendars);
    calendars.style.transition = "none";
    calendars.style.transform = `translateX(-${width}px)`;
};

calendars.addEventListener("transitionend", () => {
    addPageMonth(delta);
    renderPageCalendar();
});

calendar.addEventListener("pointerdown", (e) => {
    startX = e.clientX;
    delta = 0;
    dragging = false;
});

calendar.addEventListener("pointermove", (e) => {
    if (startX === null) return;

    shift = e.clientX - startX;

    if (!dragging) {
        if (Math.abs(shift) < MIN_SHIFT) return;
        dragging = true;

        delta = shift > 0 ? -1 : 1;
        startX -= delta * MIN_SHIFT;
        shift += delta * MIN_SHIFT;

        renderCalendars();
        calendar.setPointerCapture(e.pointerId);
    }
    calendars.style.transform = `translateX(${shift - width}px)`;
});

const stopDragging = () => {
    if (startX === null) return;
    startX = null;

    if (!dragging) return;
    dragging = false;

    delta = Math.abs(shift) > MAX_SHIFT ? (shift > 0 ? -1 : 1) : 0;

    calendars.style.transition = `transform 0.2s ease`;
    calendars.style.transform = `translateX(-${width + delta * width}px)`;
};

calendar.addEventListener("pointerup", stopDragging);
calendar.addEventListener("pointercancel", stopDragging);

/* --- Summary, entries --- */

const entryHtml = (item) => {
    const s = sumItems(item.items) || {total: 0};
    const names = item.items.map((i) => clean(displayItemName(i))).join(" · ");
    const tagHtml = item.tags
        .map((tag) => `<span class="small help">${clean(tag)}</span>`)
        .join("");
    const photo =
        item.photoId != null
            ? '<svg class="tool"><use href="sprite.svg#camera"></use></svg>'
            : "";
    return `<button class="entry" data-created="${item.created}">
        ${tagHtml ? `<div class="tags">${tagHtml}</div>` : ""}
        <div class="row gap-10">
            <span class="time mono">${getTimeText(item.spent)}</span>
            <span class="type small help">${S.categories[item.category]}</span>
            ${photo}
            <span class="amount mono right">${money(s.total)}</span>
        </div>
        <div class="items small help">${names}</div>
    </button>`;
};

const renderDayEntries = () => {
    const src = getDayEntries(getDateKey(date));
    dayEntries.innerHTML = src.length
        ? src.map(entryHtml).join("")
        : `<div class="small help center pad-20">${S.noRecords}</div>`;
};

const renderDay = () => {
    chosenDay.textContent = getDateText(date);
    renderDayEntries();
    renderCategoryRings();
    renderSummaryRings();
    renderDayBreakdown();
};

const renderDiary = () => {
    calendarDate = new Date(date);
    calendarDate.setDate(1);
    renderPageCalendar();
    renderDay();
};

dayEntries.onclick = (e) => {
    const button = e.target.closest("button.entry");
    if (!button) return;
    const created = +button.dataset.created;
    openEntry(structuredClone(entries.find((entry) => entry.created === created)), false);
};

// ==========================================================================
// 15. ENTRY PAGE
// ==========================================================================

let entry = null;
let entryTags = new Set();
let originalPhotoId = null;
let addedPhotos = [];
let categoryTouched = false;

const newEntry = () => {
    const now = new Date();
    const spent = new Date(date);
    spent.setHours(now.getHours(), now.getMinutes(), 0, 0);
    return {
        spent: spent.getTime(),
        key: getDateKey(spent),
        category: OTHER,
        items: [],
        tags: [],
        photoId: null,
        note: "",
    };
};

const openEntry = (item, isNew) => {
    entry = item;
    entryTags = new Set(entry.tags);
    originalPhotoId = entry.photoId;
    addedPhotos = [];
    categoryTouched = !isNew;

    entryText.value = "";
    growEntryText();
    clearText.classList.add("hidden");
    entryNote.value = entry.note;
    noteBlock.open = !!entry.note;
    entryDelete.classList.toggle("hidden", !entry.created);

    renderPage("entry", isNew);
    renderEntry();
};

const renderEntryHeader = () => {
    entryDate.textContent = getDateText(entry.spent);
    entryTime.textContent = getTimeText(entry.spent);
    entryCategory.textContent = S.categories[entry.category];
};

const renderEntry = () => {
    renderEntryHeader();
    renderPhoto(entryPhoto, entry.photoId);
    renderItems();
    renderEntryTags();
};

entryCategory.onclick = () => {
    categoryTouched = true;
    entry.category =
        CATEGORIES[(CATEGORIES.indexOf(entry.category) + 1) % CATEGORIES.length];
    renderEntryHeader();
};

entryDate.onclick = () => openWhenPicker(toDay);
entryTime.onclick = () => openWhenPicker(toHour);

/* --- Text and parsing --- */

const applyParse = () => {
    if (!entry) return;
    const parsed = parseEntry(entryText.value);
    const old = entry.items.filter((item) => item.fragment != null);
    const keep = entry.items.filter((item) => item.fragment == null);
    const used = new Set();

    const next = parsed.map((item) => {
        const same = old.find((o) => !used.has(o) && o.fragment === item.fragment);
        if (!same) return item;
        used.add(same);
        if (same.presetId == null && item.presetId != null) {
            return {...item, amount: same.amount, fragment: same.fragment};
        }
        return same;
    });

    entry.items = [...keep, ...next];
    renderItems();
};

const parseLater = debounce(applyParse, 400);

// Auto-grow fallback for browsers without CSS field-sizing
const growEntryText = () => {
    if (CSS.supports("field-sizing: content")) return;
    entryText.style.height = "auto";
    entryText.style.height = `${entryText.scrollHeight}px`;
};

entryText.addEventListener("input", () => {
    clearText.classList.toggle("hidden", !entryText.value);
    growEntryText();
    parseLater();
});

entryText.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        parseLater.flush();
        entryText.blur();
    }
});

clearText.onclick = () => {
    entryText.value = "";
    clearText.classList.add("hidden");
    growEntryText();
    applyParse();
    entryText.focus();
};

/* --- Voice --- */

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!Recognition) iconVoice.classList.add("hidden");

iconVoice.onclick = () => {
    // Double tap protection: do not start the second recognition
    if (iconVoice.classList.contains("listening")) return;

    const recognition = new Recognition();
    recognition.lang = S.locale;
    recognition.interimResults = false;
    recognition.onresult = (e) => {
        const text = e.results[0][0].transcript;
        const current = entryText.value.trim();
        entryText.value = current ? `${current}, ${text}` : text;
        clearText.classList.remove("hidden");
        growEntryText();
        applyParse();
    };
    recognition.onerror = () => iconVoice.classList.remove("listening");
    recognition.onend = () => iconVoice.classList.remove("listening");
    iconVoice.classList.add("listening");
    recognition.start();
};

/* --- Photo --- */

iconPhoto.onclick = () => photoInput.click();

photoInput.onchange = async () => {
    const file = photoInput.files[0];
    photoInput.value = "";
    if (!file || !entry) return;
    const id = await addPhoto(file);
    if (!entry) return;
    if (id == null) return showMessage(S.photoError);
    if (addedPhotos.includes(entry.photoId)) deletePhoto(entry.photoId);
    addedPhotos.push(id);
    entry.photoId = id;
    renderPhoto(entryPhoto, id);
};

entryPhoto.onclick = (e) => {
    if (!e.target.closest(".photo-remove")) return;
    if (addedPhotos.includes(entry.photoId)) deletePhoto(entry.photoId);
    entry.photoId = null;
    renderPhoto(entryPhoto, null);
};

/* --- Quick search lists --- */

const recentPicks = () =>
    recents
        .map((r) => ({preset: findPreset(r.presetId), amount: r.amount}))
        .filter((p) => p.preset && !p.preset.archived)
        .slice(0, 10);

const frequentPicks = () => {
    updatePresetsCounter();
    return [...presetsCounter.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => findPreset(id))
        .filter((item) => item && !item.archived)
        .slice(0, 10)
        .map((preset) => ({preset, amount: preset.amount}));
};

/* --- Items --- */

const itemHtml = (item, i) => {
    const preset = findPreset(item.presetId);
    const info = preset
        ? `<span class="help right">${S.categories[preset.category]}</span>`
        : `<span class="red">${S.notFound}</span>`;
    return `<div class="card-item ${isProblem(item) ? "bad" : ""}" data-i="${i}" role="button" tabindex="0">
        <div class="row gap-10">
            <div class="name">${clean(displayItemName(item))}</div>
            <div class="amount mono">${money(item.amount)}</div>
        </div>
        <div class="row small mono">${info}</div>
    </div>`;
};

const renderItems = () => {
    const s = sumItems(entry.items);
    entryItems.innerHTML = entry.items.map((item, i) => itemHtml(item, i)).join("");

    entryTotal.innerHTML = s
        ? `<div class="small help">${S.total}</div><div class="mono">${money(s.total)}</div>`
        : "";
    renderCta();
};

const openItemCreation = (i) => {
    const item = entry.items[i];
    openPresetPage({
        name: item.name,
        amount: item.amount,
        action: {type: "replace", index: i},
    });
};

entryItems.onclick = (e) => {
    const card = e.target.closest(".card-item");
    if (!card) return;
    const i = +card.dataset.i;
    if (entry.items[i].presetId == null) openItemCreation(i);
    else openPortion(i);
};

entryItems.onkeydown = (e) => {
    const card = e.target.closest(".card-item");
    if (card && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        const i = +card.dataset.i;
        if (entry.items[i].presetId == null) openItemCreation(i);
        else openPortion(i);
    }
};

/* --- Tags --- */

const renderEntryTags = () => {
    const dst = [...tags, ...[...entryTags].filter((tag) => !tags.includes(tag))];
    tagButtons.innerHTML = dst
        .map(
            (tag) =>
                `<button class="tap ${entryTags.has(tag) ? "selected" : ""}">${clean(tag)}</button>`,
        )
        .join("");
    [...tagButtons.children].forEach((q, i) => (q.dataset.tag = dst[i]));
};

const addPresetTags = (preset) => {
    if (!preset.tags?.length) return;
    preset.tags.forEach((tag) => entryTags.add(tag));
    renderEntryTags();
};

// Shared tag-chip handler for entries and the preset editor
const bindTagChips = (container, getSet) =>
    container.addEventListener("click", (e) => {
        const button = e.target.closest("button");
        if (!button) return;
        const tag = button.dataset.tag;
        const set = getSet();
        set.has(tag) ? set.delete(tag) : set.add(tag);
        button.classList.toggle("selected");
    });

bindTagChips(tagButtons, () => entryTags);

/* --- Note --- */

entryNote.addEventListener(
    "input",
    debounce(() => {
        if (entry) entry.note = entryNote.value;
    }, 300),
);

/* --- CTA --- */

const renderCta = () => {
    const n = entry.items.filter(isProblem).length;
    confirmButton.disabled = !entry.items.length;
    confirmButton.setAttribute("aria-label", n ? S.checkItems(n) : S.confirm);
};

const stripFragment = ({fragment, ...item}) => item;

const saveEntry = () => {
    entry.items = entry.items.map(stripFragment);
    entry.tags = [...entryTags];
    entry.note = entryNote.value.trim();

    if (entry.created) {
        const i = entries.findIndex((item) => item.created === entry.created);
        entries[i] = entry;
    } else {
        entry.created = Date.now();
        entries.push(entry);
    }

    saveEntries();
    updateRecents(entry.items);
    if (originalPhotoId != null && originalPhotoId !== entry.photoId)
        deletePhoto(originalPhotoId);

    date = new Date(entry.spent);
    entry = null;
    entryText.value = "";
    toDiaryPage();
};

confirmButton.onclick = () => {
    const i = entry.items.findIndex(isProblem);
    if (i < 0) return saveEntry();
    const card = entryItems.querySelector(`[data-i="${i}"]`);
    card.scrollIntoView({behavior: "smooth", block: "center"});
    card.classList.add("flash");
    setTimeout(() => card.classList.remove("flash"), 1000);
};

cancelButton.onclick = () => {
    addedPhotos.forEach(deletePhoto);
    entry = null;
    toDiaryPage();
};

entryDelete.onclick = () => showModal(S.deleteEntryQuestion, () => {
    entries = entries.filter((item) => item.created !== entry.created);
    saveEntries();
    addedPhotos.forEach(deletePhoto);
    if (originalPhotoId != null) deletePhoto(originalPhotoId);
    entry = null;
    toDiaryPage();
});

// ==========================================================================
// 16. SEARCH
// ==========================================================================

let searchContext = {type: "entry"};
let searchTab = "all";

const SEARCH_TABS = ["all", ...CATEGORIES.map(String), "favorites"];
const QUICK_TABS = ["recent", "frequent", "favorites", "my"];

const openSearch = (type, options = {}) => {
    searchContext = {type, ...options};
    searchTab = options.tab || "all";
    searchInput.value = options.query || "";
    renderSearchTabs();
    renderSearchResults();
    openSheet(searchSheet);
    setTimeout(() => searchInput.focus(), 250);
};

const openQuickPicks = () => {
    const tab = recentPicks().length
        ? "recent"
        : frequentPicks().length
            ? "frequent"
            : "favorites";
    openSearch("entry", {tab, quick: true});
};

const renderSearchTabs = () => {
    const quick = searchContext.quick;
    const tabs = quick ? QUICK_TABS : SEARCH_TABS;
    searchTabs.innerHTML = tabs
        .map((tab) => {
            const label = quick
                ? S[tab]
                : tab === "all"
                    ? S.searchTabs.all
                    : tab === "favorites"
                        ? S.searchTabs.favorites
                        : S.categories[+tab];
            return `<button class="tap chip ${tab === searchTab ? "selected" : ""}" data-tab="${tab}">${label}</button>`;
        })
        .join("");
};

const searchActivePresets = () => {
    if (searchContext.quick) {
        if (searchTab === "recent") return recentPicks().map((p) => p.preset);
        if (searchTab === "frequent") return frequentPicks().map((p) => p.preset);
        if (searchTab === "my") return presets.filter((item) => !item.archived);
    }

    let dst = getActivePresets();
    if (searchTab === "favorites") {
        dst = dst.filter((item) => favorites.includes(item.id));
    } else if (searchTab !== "all") {
        dst = dst.filter((item) => item.category === +searchTab);
    }
    return dst;
};

const searchPresets = (query) => {
    const dst = searchActivePresets();
    if (!query.trim()) {
        if (
            searchContext.quick &&
            (searchTab === "recent" || searchTab === "frequent")
        ) {
            return dst.slice(0, 50);
        }
        return dst
            .sort((a, b) => a[lang].localeCompare(b[lang], S.locale))
            .slice(0, 50);
    }
    return rankPresets(query, dst)
        .slice(0, 50)
        .map((match) => match.preset);
};

const resultHtml = (preset) => {
    const favorite = favorites.includes(preset.id);
    const edit = preset.custom
        ? `<button class="icon-button" data-act="edit" aria-label="${S.edit}"><svg class="tool"><use href="sprite.svg#edit"></use></svg></button>`
        : "";
    return `<div class="result" data-id="${preset.id}" role="button" tabindex="0">
        <div class="col grow">
            <span>${clean(preset[lang])}</span>
            <span class="small help mono">${money(preset.amount)} · ${S.categories[preset.category]}</span>
        </div>
        <button class="icon-button" data-act="fav" aria-label="${S.favorites}" aria-pressed="${favorite}">
            <svg class="tool ${favorite ? "starred" : ""}"><use href="sprite.svg#star"></use></svg>
        </button>
        ${edit}
    </div>`;
};

const renderSearchResults = () => {
    const query = searchInput.value.trim();
    const dst = searchPresets(query);
    searchResults.innerHTML = dst.length
        ? dst.map(resultHtml).join("")
        : `<div class="empty">${S.nothingFound}</div>`;
};

searchInput.addEventListener(
    "input",
    debounce(() => {
        renderSearchResults();
    }, 150),
);

searchClear.onclick = () => {
    searchInput.value = "";
    renderSearchResults();
    searchInput.focus();
};

searchTabs.onclick = (e) => {
    const button = e.target.closest("button");
    if (!button) return;
    searchTab = button.dataset.tab;
    renderSearchTabs();
    renderSearchResults();
};

const toggleFavorite = (id) => {
    favorites = favorites.includes(id)
        ? favorites.filter((x) => x !== id)
        : [...favorites, id];
    saveFavorites();
};

const pickPreset = (preset) => {
    closeSheet();

    const recent = searchContext.quick && searchTab === "recent"
        ? recentPicks().find((p) => p.preset.id === preset.id)
        : null;
    const amount = recent?.amount ?? preset.amount;
    entry.items.push(makeItem(preset, amount));

    if (!categoryTouched) entry.category = preset.category;
    addPresetTags(preset);
    renderItems();
    renderEntryHeader();
};

searchResults.onclick = (e) => {
    const q = e.target.closest(".result");
    if (!q) return;
    const preset = findPreset(+q.dataset.id);
    const act = e.target.closest("button")?.dataset.act;

    if (act === "fav") {
        toggleFavorite(preset.id);
        return renderSearchResults();
    }
    if (act === "edit") {
        closeSheet();
        return openPresetPage({preset, action: {type: "edit"}});
    }
    pickPreset(preset);
};

searchResults.onkeydown = (e) => {
    const q = e.target.closest(".result");
    if (q && e.target === q && e.key === "Enter")
        pickPreset(findPreset(+q.dataset.id));
};

searchBack.onclick = closeSheet;
iconSearch.onclick = () => openSearch("entry");
iconStar.onclick = openQuickPicks;
iconPlus.onclick = () => openPresetPage({action: {type: "add"}});

// ==========================================================================
// 17. AMOUNT (#portion-sheet)
// ==========================================================================

let portionIndex = null;

const portionItem = () => entry.items[portionIndex];

const openPortion = (i) => {
    portionIndex = i;
    const item = portionItem();
    const preset = findPreset(item.presetId);

    portionTitle.textContent = displayItemName(item);
    portionAmount.value = fmt(item.amount, 2);

    const exists = item.presetId != null;
    portionTitle.dataset.presetId = exists ? item.presetId : "";
    portionTitle.tabIndex = preset?.custom ? 0 : -1;
    portionTitle.style.cursor = preset?.custom ? "pointer" : "default";
    portionCreate.classList.toggle("hidden", exists);

    openSheet(portionSheet);
};

const openPortionDetails = () => {
    const presetId = Number(portionTitle.dataset.presetId);
    if (!presetId) return;
    const preset = findPreset(presetId);
    if (!preset?.custom) return;

    closeSheet();
    openPresetPage({preset, action: {type: "view"}});
};

portionTitle.onclick = openPortionDetails;
portionTitle.onkeydown = (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    openPortionDetails();
};

maskNumber(portionAmount, MAX_AMOUNT, 2);

const shiftPortion = (direction) => {
    const step = findPreset(portionItem().presetId)?.amount || 1;
    const amount = (parseNumber(portionAmount.value) || 0) + direction * step;
    portionAmount.value = fmt(Math.max(0, Math.min(amount, MAX_AMOUNT)), 2);
};

portionMinus.onclick = () => shiftPortion(-1);
portionPlus.onclick = () => shiftPortion(1);

const savePortion = () => {
    const item = portionItem();
    item.amount = Math.max(0, parseNumber(portionAmount.value) ?? item.amount);
    closeSheet();
    renderItems();
};

portionConfirm.onclick = savePortion;

portionDelete.onclick = () => {
    closeSheet();
    entry.items.splice(portionIndex, 1);
    renderItems();
};

portionCreate.onclick = () => {
    const index = portionIndex;
    closeSheet();
    openItemCreation(index);
};

// ==========================================================================
// 18. TAG EDITOR (#tags-sheet)
// ==========================================================================

const openTagEditor = () => {
    tagActions.innerHTML = tags
        .map((tag) => `<button class="tap red">${clean(tag)}</button>`)
        .join("");
    [...tagActions.children].forEach((el, i) => (el.dataset.tag = tags[i]));
    tagInput.value = "";
    openSheet(tagsSheet);
};

const applyTagEditor = () => {
    tags = [...tagActions.children].map((q) => q.dataset.tag);
    saveTags();
    closeSheet();
    renderEntryTags();
};

editTagsButton.onclick = openTagEditor;
closeTags.onclick = closeSheet;
applyTags.onclick = applyTagEditor;

createTagButton.onclick = (e) => {
    e.preventDefault();
    const tag = tagInput.value.trim();
    if (!tag || [...tagActions.children].some((q) => q.dataset.tag === tag))
        return;

    const button = document.createElement("BUTTON");
    button.className = "tap red";
    button.textContent = tag;
    button.dataset.tag = tag;

    tagInput.value = "";
    tagInput.focus();

    tagActions.appendChild(button);
};

tagActions.onclick = (e) => {
    const button = e.target.closest("button");
    if (!button) return;
    tagInput.value = button.dataset.tag;
    button.remove();
};

// ==========================================================================
// 19. DATE PICKER / TIME (#when-picker)
// ==========================================================================

const CX = 125;
const CY = 125;
const R_OUT = 100;
const R_IN = 70;
const HAND_RADIUS = 16;

const MINUTE_LABELS = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];
const HOUR_LABELS_AM = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"];
const HOUR_LABELS_PM = ["12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23"];

let add = null;
let update = null;
let whenDate = new Date();
let whenMonth = new Date();
let hour = 0;
let minute = 0;

const setDay = () => (dayButton.textContent = getDateText(whenDate));
const setHour = () => (hourButton.textContent = pad(hour));
const setMinute = () => (minuteButton.textContent = pad(minute));

const updateHand = (angle, radius) => {
    const x = CX + radius * Math.cos(angle);
    const y = CY + radius * Math.sin(angle);
    hand.style.left = `${x - HAND_RADIUS}px`;
    hand.style.top = `${y - HAND_RADIUS}px`;
    line.style.width = `${radius}px`;
    line.style.transform = `rotate(${angle}rad)`;
    white.style.clipPath = `circle(${HAND_RADIUS}px at ${x}px ${y}px)`;
};

const createTicks = (labels, radius) =>
    labels
        .map((label, i) => {
            const angle = (i / 6 - 0.5) * Math.PI;
            const x = 50 + radius * Math.cos(angle);
            const y = 50 + radius * Math.sin(angle);
            return `<div class="tick" style="left:${x}%;top:${y}%">${label}</div>`;
        })
        .join("");

const getMinute = (angle) => (Math.round((30 * angle) / Math.PI) + 75) % 60;
const getHour = (angle) => (Math.round((6 * angle) / Math.PI) + 15) % 12;

const clockPoint = (e) => {
    const rect = clock.getBoundingClientRect();
    return {x: e.clientX - rect.left - CX, y: e.clientY - rect.top - CY};
};

const updateMinute = (e) => {
    const {x, y} = clockPoint(e);
    const angle = Math.atan2(y, x);
    updateHand(angle, R_OUT);
    minute = getMinute(angle);
    setMinute();
};

const updateHour = (e) => {
    const {x, y} = clockPoint(e);
    const angle = Math.atan2(y, x);
    const pm = 4 * (x * x + y * y) < (R_IN + R_OUT) ** 2;
    updateHand(angle, pm ? R_IN : R_OUT);
    hour = getHour(angle) + 12 * pm;
    setHour();
};

const selectWhen = (button) =>
    [dayButton, hourButton, minuteButton].forEach((b) =>
        b.classList.toggle("selected", b === button),
    );

const toMinute = () => {
    whenCalendar.style.display = "none";
    clock.style.display = "block";
    white.innerHTML = black.innerHTML = createTicks(MINUTE_LABELS, 40);
    updateHand((minute / 30 - 0.5) * Math.PI, R_OUT);
    update = updateMinute;
    add = addMinute;
    selectWhen(minuteButton);
};

const toHour = () => {
    whenCalendar.style.display = "none";
    clock.style.display = "block";
    white.innerHTML = black.innerHTML =
        createTicks(HOUR_LABELS_AM, 40) + createTicks(HOUR_LABELS_PM, 28);
    updateHand((hour / 6 - 0.5) * Math.PI, hour >= 12 ? R_IN : R_OUT);
    update = updateHour;
    add = addHour;
    selectWhen(hourButton);
};

const toDay = () => {
    clock.style.display = "none";
    whenCalendar.style.display = "block";
    selectWhen(dayButton);
    add = addMonth;
    update = null;
    whenMonth = new Date(whenDate);
    whenMonth.setDate(1);
    renderWhenCalendar();
};

const renderWhenCalendar = () => {
    const y = whenMonth.getFullYear();
    const m = whenMonth.getMonth();
    const first = (new Date(y, m, 1).getDay() + 6) % 7;
    const last = new Date(y, m + 1, 0).getDate();
    const todayKey = getDateKey(new Date());
    const dateKey = getDateKey(whenDate);

    const getDayType = (n) => {
        const key = getDateKey(new Date(y, m, n));
        if (key === dateKey) return "selected";
        if (key === todayKey) return "today";
        if (key > todayKey) return "future";
        return "";
    };

    let days = '<span class="empty"></span>'.repeat(first);
    for (let i = 1; i <= last; i++)
        days += `<button class="${getDayType(i)}">${i}</button>`;

    whenDays.innerHTML = days;
};

const openWhenPicker = (to) => {
    whenDate = new Date(entry.spent);
    hour = whenDate.getHours();
    minute = whenDate.getMinutes();

    setDay();
    setHour();
    setMinute();

    to();
    openSheet(whenPicker);
};

const applyWhenPicker = () => {
    const spent = new Date(whenDate);
    spent.setHours(hour, minute, 0, 0);
    entry.spent = spent.getTime();
    entry.key = getDateKey(whenDate);
    renderEntryHeader();
    closeSheet();
};

const addMinute = (d) => {
    minute = (minute + 60 + d) % 60;
    updateHand((minute / 30 - 0.5) * Math.PI, R_OUT);
    setMinute();
};

const addHour = (d) => {
    hour = (hour + 24 + d) % 24;
    updateHand((hour / 6 - 0.5) * Math.PI, hour >= 12 ? R_IN : R_OUT);
    setHour();
};

const addMonth = (d) => {
    whenMonth.setMonth(whenMonth.getMonth() + d);
    renderWhenCalendar();
};

dayButton.onclick = toDay;
hourButton.onclick = toHour;
minuteButton.onclick = toMinute;

$("when-prev").onclick = () => add(-1);
$("when-next").onclick = () => add(1);

whenDays.onclick = (e) => {
    const button = e.target.closest("button");
    if (!button) return;
    whenDate = new Date(
        whenMonth.getFullYear(),
        whenMonth.getMonth(),
        +button.textContent,
    );
    setDay();
    toHour();
};

clock.addEventListener("pointerdown", (e) => {
    hand.setPointerCapture(e.pointerId);
    update(e);
});

clock.addEventListener("pointermove", (e) => {
    if (hand.hasPointerCapture(e.pointerId)) update(e);
});

clock.addEventListener("pointerup", (e) => {
    if (!hand.hasPointerCapture(e.pointerId)) return;
    update(e);
    hand.releasePointerCapture(e.pointerId);
    if (update === updateHour) toMinute();
});

clock.addEventListener("pointercancel", (e) => {
    if (hand.hasPointerCapture(e.pointerId))
        hand.releasePointerCapture(e.pointerId);
});

closeWhen.onclick = closeSheet;
applyWhen.onclick = applyWhenPicker;

// ==========================================================================
// 20. PRESET (#preset-page)
// ==========================================================================

let presetDraft = null;

const CUSTOM_ID_START = 1000000;

const nextPresetId = () =>
    Math.max(CUSTOM_ID_START - 1, ...presets.map((item) => item.id)) + 1;

const openPresetPage = ({preset = null, name = "", amount = null, action}) => {
    presetDraft = {
        editing: preset,
        action,
        category: preset ? preset.category : OTHER,
        tags: new Set(preset?.tags || []),
    };

    presetName.value = preset ? preset[lang] : name;
    presetAmount.value =
        (preset ? preset.amount : amount) != null
            ? fmt(preset ? preset.amount : amount, 2)
            : "";
    setSegment(presetCategory, presetDraft.category, "category");
    presetArchive.classList.toggle("hidden", !preset?.custom);

    renderPresetTags();
    syncCurrencyText();
    renderPage("preset", false);
    updatePreset();
};

const closePresetPage = (savedPreset) => {
    const action = presetDraft.action;
    presetDraft = null;
    renderPage("entry", false);

    if (savedPreset && action.type === "add") {
        entry.items.push(makeItem(savedPreset, savedPreset.amount));
    }
    if (savedPreset && action.type === "replace") {
        const old = entry.items[action.index];
        entry.items[action.index] = {
            ...makeItem(savedPreset, old.amount || savedPreset.amount),
            fragment: old.fragment,
        };
    }
    renderEntry();
};

const renderPresetTags = () => {
    presetTags.innerHTML = tags
        .map(
            (tag) =>
                `<button class="tap ${presetDraft.tags.has(tag) ? "selected" : ""}">${clean(tag)}</button>`,
        )
        .join("");
    [...presetTags.children].forEach((q, i) => (q.dataset.tag = tags[i]));
};

bindTagChips(presetTags, () => presetDraft.tags);

const readPreset = () => {
    const name = presetName.value.trim();
    const amount = parseNumber(presetAmount.value);
    return {
        valid: !!name && amount != null && amount >= 0,
        name,
        amount: amount ?? 0,
    };
};

const updatePreset = () => {
    if (!presetDraft) return;
    presetSave.disabled = !readPreset().valid;
};

presetName.addEventListener("input", updatePreset);
presetAmount.addEventListener("input", updatePreset);

onSegment(presetCategory, "category", (value) => {
    presetDraft.category = +value;
    updatePreset();
});

maskNumber(presetAmount, MAX_AMOUNT, 2);

presetSave.onclick = () => {
    const result = readPreset();
    if (!result.valid) return;

    const editing = presetDraft.editing;
    const item = {
        id: editing?.custom ? editing.id : nextPresetId(),
        en: result.name,
        ru: result.name,
        aliases: editing?.custom ? editing.aliases : [],
        amount: result.amount,
        category: presetDraft.category,
        tags: [...presetDraft.tags],
        custom: true,
        archived: false,
    };

    const i = presets.findIndex(({id}) => id === item.id);
    if (i >= 0) presets[i] = item;
    else presets.push(item);
    savePresets();

    closePresetPage(item);
};

presetCancel.onclick = () => closePresetPage(null);

presetArchive.onclick = () =>
    showModal(S.deletePresetQuestion, () => {
        const i = presets.findIndex(({id}) => id === presetDraft.editing.id);
        presets[i] = {...presets[i], archived: true};
        savePresets();
        favorites = favorites.filter((id) => id !== presets[i].id);
        saveFavorites();
        closePresetPage(null);
    });

// ==========================================================================
// 21. PERSON PAGE
// ==========================================================================

const birthdate = {digits: "", cursor: 0};
const YY = new Date().getFullYear() % 100;

const formatDate = () => {
    if (!birthdate.digits) return "";
    const d =
        birthdate.digits.slice(0, 2) + (birthdate.digits.length >= 2 ? "." : "");
    const m =
        birthdate.digits.slice(2, 4) + (birthdate.digits.length >= 4 ? "." : "");
    const y = birthdate.digits.slice(4);
    return d + m + y;
};

const normalize = () => {
    if (birthdate.cursor < birthdate.digits.length)
        birthdate.digits = birthdate.digits.slice(0, birthdate.cursor);

    if (+birthdate.digits[0] > 3) birthdate.digits = "0" + birthdate.digits;

    if (birthdate.digits.length >= 2) {
        const d = +birthdate.digits.slice(0, 2);
        if (d > 31) birthdate.digits = "0" + birthdate.digits;
        else if (d === 0) birthdate.digits = "01" + birthdate.digits.slice(2);
    }

    if (birthdate.digits.length >= 3 && +birthdate.digits[2] > 1)
        birthdate.digits =
            birthdate.digits.slice(0, 2) + "0" + birthdate.digits.slice(2);

    if (birthdate.digits.length >= 4) {
        const d = birthdate.digits.slice(0, 2);
        const m = +birthdate.digits.slice(2, 4);
        if (m > 12) birthdate.digits = d + "0" + birthdate.digits.slice(2);
        else if (m === 0) birthdate.digits = d + "01" + birthdate.digits.slice(4);
    }

    if (birthdate.digits.length >= 6) {
        const y = birthdate.digits.slice(4, 6);
        if (y !== "19" && y !== "20") {
            birthdate.digits =
                birthdate.digits.slice(0, 4) + (+y <= YY ? "20" : "19") + y;
        }
    }

    birthdate.digits = birthdate.digits.slice(0, 8);
    birthdate.cursor = birthdate.digits.length;
};

const setValue = () => {
    birthdateInput.value = formatDate();
    let p = birthdate.cursor;
    if (birthdate.cursor >= 2) p++;
    if (birthdate.cursor >= 4) p++;
    p = Math.min(p, birthdateInput.value.length);
    birthdateInput.setSelectionRange(p, p);
};

const rawPosition = (p) =>
    birthdateInput.value.slice(0, p).replace(/\D/g, "").length;

birthdateInput.addEventListener("beforeinput", (e) => {
    if (e.inputType === "insertText" && e.data === ".") {
        e.preventDefault();
        if (birthdate.cursor === 1) {
            birthdate.digits = "0" + birthdate.digits;
            birthdate.cursor = 2;
            setValue();
        } else if (birthdate.cursor === 3) {
            birthdate.digits =
                birthdate.digits.slice(0, 2) + "0" + birthdate.digits.slice(2);
            birthdate.cursor = 4;
            setValue();
        }
        return;
    }

    if (e.inputType === "insertText" || e.inputType === "insertFromPaste") {
        e.preventDefault();
        const p = (e.data || "").replace(/\D/g, "");
        if (!p || birthdate.cursor >= 8) return;

        birthdate.digits =
            birthdate.digits.slice(0, birthdate.cursor) +
            p +
            birthdate.digits.slice(birthdate.cursor);
        birthdate.cursor += p.length;
        normalize();
        setValue();
        return;
    }

    if (e.inputType === "deleteContentBackward") {
        e.preventDefault();
        if (!birthdate.cursor) return;

        if (birthdate.cursor === 8 && birthdate.digits.length === 8) {
            const y = birthdate.digits.slice(4);
            if (y.slice(0, 2) !== "19" && y.slice(0, 2) !== "20") {
                birthdate.digits = birthdate.digits.slice(0, 4) + y.slice(2);
                birthdate.cursor = 6;
                setValue();
                return;
            }
        }

        birthdate.digits =
            birthdate.digits.slice(0, birthdate.cursor - 1) +
            birthdate.digits.slice(birthdate.cursor);
        birthdate.cursor--;
        normalize();
        setValue();
    }
});

birthdateInput.addEventListener("click", () => {
    birthdate.cursor = rawPosition(birthdateInput.selectionStart);
});

birthdateInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
        e.preventDefault();
        birthdate.cursor = Math.max(0, birthdate.cursor - 1);
        setValue();
    }
    if (e.key === "ArrowRight") {
        e.preventDefault();
        birthdate.cursor = Math.min(8, birthdate.cursor + 1);
        setValue();
    }
});

birthdateInput.addEventListener("paste", (e) => {
    e.preventDefault();
    const value = e.clipboardData.getData("text").trim();
    const parts = value.split(/[.\-/\s]+/);

    if (parts.length >= 3) {
        let [d, m, y] = parts;
        d = d.replace(/\D/g, "");
        m = m.replace(/\D/g, "");
        y = y.replace(/\D/g, "");

        if (d.length === 1) d = "0" + d;
        if (m.length === 1) m = "0" + m;

        if (y.length === 1) y = "200" + y;
        else if (y.length === 2) y = (+y <= YY ? "20" : "19") + y;
        else y = y.slice(0, 4);

        birthdate.digits = (d + m + y).slice(0, 8);
    } else {
        birthdate.digits = value.replace(/\D/g, "").slice(0, 8);
        normalize();
    }

    birthdate.cursor = birthdate.digits.length;
    setValue();
});

const getBirthdate = () => {
    if (birthdate.digits.length !== 8) return false;

    const d = +birthdate.digits.slice(0, 2);
    const m = +birthdate.digits.slice(2, 4);
    const y = +birthdate.digits.slice(4, 8);
    const dst = new Date(y, m - 1, d);

    if (dst.getFullYear() !== y ||
        dst.getMonth() !== m - 1 ||
        dst.getDate() !== d ||
        dst > new Date()) return null;

    return y * 10000 + m * 100 + d;
};

/* --- Activity slider --- */

const ACTIVITY_LEVELS = [1.2, 1.375, 1.55, 1.725, 1.9];

const renderActivityLevel = () => {
    const i = ACTIVITY_LEVELS.reduce(
        (best, l, j) =>
            Math.abs(settings.activity - l) <
            Math.abs(settings.activity - ACTIVITY_LEVELS[best])
                ? j
                : best,
        0,
    );
    activityLevel.textContent = `${S.activityLevels[i]}`;
    activityInput.style.setProperty("--value", `${settings.activity * 100 - 100}%`);
};

const renderPerson = () => {
    if (settings.birthdate) {
        const s = String(settings.birthdate);
        birthdate.digits = s.slice(6, 8) + s.slice(4, 6) + s.slice(0, 4);
        birthdate.cursor = birthdate.digits.length;
        birthdateInput.value = formatDate();
    } else {
        birthdate.digits = "";
        birthdate.cursor = 0;
        birthdateInput.value = "";
    }

    setSegment(sexInput, settings.sex ? "male" : "female", "sex");
    activityInput.value = settings.activity;
    renderActivityLevel();

    monthlyBudgetInput.value = fmt(settings.monthlyBudget, 0);
    CATEGORIES.forEach((category) => {
        categoryBudgetInputs[category].value = fmt(
            settings.categoryBudgets[category],
            0,
        );
    });
    setSegment(currencySegment, settings.currency, "currency");
    syncCurrencyText();

    const categoriesTotal = settings.categoryBudgets.reduce((a, v) => a + v, 0);
    budgetSummary.innerHTML = `
        <div class="small help">${S.dailyBudget}: <b>${money(dailyBudget(new Date()))}</b></div>
        <div class="small help">${S.budgetSummary}: ${money(categoriesTotal)} / ${money(settings.monthlyBudget)}</div>`;
};

const applyPersonForm = () => {
    settings.birthdate = getBirthdate();
    settings.monthlyBudget =
        parseNumber(monthlyBudgetInput.value) ?? settings.monthlyBudget;
    CATEGORIES.forEach((category) => {
        settings.categoryBudgets[category] =
            parseNumber(categoryBudgetInputs[category].value) ?? 0;
    });

    saveSettings();
    invalidate();
    renderPerson();
    renderDiary();
};

[birthdateInput, ...budgetInputs].forEach((input) =>
    input.addEventListener("blur", applyPersonForm),
);

onSegment(sexInput, "sex", (value) => {
    settings.sex = value === "male" ? 1 : 0;
    saveSettings();
    renderPerson();
});

activityInput.addEventListener("input", () => {
    settings.activity = +activityInput.value;
    renderActivityLevel();
});

// Save the smooth slider on release, like the other fields
activityInput.addEventListener("change", () => {
    saveSettings();
    renderPerson();
});

maskNumber(monthlyBudgetInput, 100000000, 0);
CATEGORIES.forEach((category) =>
    maskNumber(categoryBudgetInputs[category], 100000000, 0),
);

onSegment(currencySegment, "currency", (value) => {
    settings.currency = value;
    saveSettings();
    syncCurrencyText();
    renderPerson();
    renderDiary();
});

// ==========================================================================
// 22. SETTINGS
// ==========================================================================

exportButton.onclick = exportData;
importButton.onclick = () => importInput.click();

importInput.onchange = async () => {
    const file = importInput.files[0];
    importInput.value = "";
    if (!file) return;
    let data = null;
    try {
        data = JSON.parse(await file.text());
    } catch {
        data = null;
    }
    if (!validImport(data)) return showMessage(S.importError);
    showModal(S.importQuestion, () => importData(data));
};

resetButton.onclick = () => showModal(S.resetQuestion, resetData);

// ==========================================================================
// 23. STATISTICS: PERIOD AND BUCKETS
// ==========================================================================

let period = WEEK;
let currentDate = new Date();
let categoryMode = "sum";

const getRange = (d, p) => {
    d = startOfDay(d);
    if (p === DAY) return [d, addDays(d, 1)];
    if (p === WEEK) {
        const start = getMonday(d);
        return [start, addDays(start, 7)];
    }
    const start = getMonday(new Date(d.getFullYear(), d.getMonth(), 1));
    const end = addDays(
        getMonday(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
        7,
    );
    return [start, end];
};

const getBuckets = (start, end, p) => {
    const buckets = [];
    if (p === DAY) {
        for (let h = 0; h < 24; h += 6) {
            const s = new Date(start);
            s.setHours(h);
            const e = new Date(start);
            e.setHours(h + 6);
            buckets.push({
                label: String(h),
                title: `${pad(h)}:00–${pad(h + 6)}:00`,
                start: s,
                end: e,
            });
        }
    } else if (p === WEEK) {
        for (let i = 0; i < 7; i++) {
            const d = addDays(start, i);
            buckets.push({
                label: S.wds[i],
                title: `${S.wds[i]}, ${getDateText(d)}`,
                start: d,
                end: addDays(start, i + 1),
            });
        }
    } else {
        for (let s = new Date(start); s < end; s = addDays(s, 7)) {
            buckets.push({
                label: String(s.getDate()),
                title: `${getDateText(s)} — ${getDateText(addDays(s, 6))}`,
                start: new Date(s),
                end: addDays(s, 7),
            });
        }
    }
    return buckets;
};

const renderRange = () => {
    const [start, end] = getRange(currentDate, period);
    if (period === DAY) rangeLabel.textContent = getDateText(start);
    else if (period === WEEK) {
        rangeLabel.innerHTML = `<span>${getDateText(start)}</span><span>—</span><span>${getDateText(addDays(end, -1))}</span>`;
    } else
        rangeLabel.textContent = `${S.months[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
};

const shiftRange = (direction) => {
    if (period === DAY) currentDate = addDays(currentDate, direction);
    else if (period === WEEK) currentDate = addDays(currentDate, direction * 7);
    else {
        currentDate = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth() + direction,
            1,
        );
    }
    renderRange();
};

/* --- Aggregation --- */

// Bucket days that have already passed
const pastDays = (start, end) => {
    const days = [];
    const limit = startOfDay(new Date());
    for (let d = startOfDay(start); d < end && d <= limit; d = addDays(d, 1)) {
        days.push(d);
    }
    return days;
};

const daySummaryOf = (list) => {
    const dst = {total: 0, count: list.length};
    CATEGORIES.forEach((category) => (dst[category] = 0));
    for (const item of list) {
        const s = sumItems(item.items);
        if (!s) continue;
        dst.total += s.total;
        dst[item.category] += s.total;
    }
    return dst;
};

const SUMMARY_KEYS = ["total", "count", ...CATEGORIES];

const averageSummaries = (list) => {
    if (!list.length) return null;
    const dst = {};
    SUMMARY_KEYS.forEach((k) => {
        const values = list.map((x) => x[k]).filter((v) => v != null);
        dst[k] = values.length
            ? values.reduce((a, v) => a + v, 0) / values.length
            : null;
    });
    return dst;
};

// Day/week/month at day level: the average day that has entries
const aggregateDays = (b) =>
    averageSummaries(
        pastDays(b.start, b.end)
            .map((d) => getDayEntries(getDateKey(d)))
            .filter((list) => list.length)
            .map(daySummaryOf),
    );

const aggregate = (b) => {
    if (b.start > new Date()) return null;
    if (period !== DAY) return aggregateDays(b);
    const list = entries.filter(
        (item) => item.spent >= b.start && item.spent < b.end,
    );
    return list.length ? daySummaryOf(list) : null;
};

const rangeEntries = (start, end) =>
    entries.filter(
        (item) => item.spent >= start && item.spent < end && item.spent <= Date.now(),
    );

const sumRange = (start, end) =>
    sumEntries(rangeEntries(start, end))?.total || 0;

const dayTotal = (d) => {
    const list = getDayEntries(getDateKey(d));
    return list.length ? sumEntries(list)?.total : null;
};

const cumulative = (values, buckets) => {
    let acc = 0;
    return values.map((v, i) => {
        if (buckets[i].start > new Date()) return null;
        acc += v || 0;
        return acc;
    });
};

// ==========================================================================
// 24. STATISTICS: UNIVERSAL RENDERERS (SVG)
// ==========================================================================

const CHART_HEIGHT = 200;
const PAD = {l: 40, r: 10, t: 12, b: 24};
const chartTips = new Map();

const empty = (id) => {
    $(id).innerHTML = `<div class="empty">${S.noData}</div>`;
};

const niceStep = (range) => {
    let step = range / 4;
    const p = 10 ** Math.floor(Math.log10(step || 1));
    return [1, 2, 2.5, 5, 10].find((k) => k * p >= step) * p;
};

const scaleY = (min, max) => {
    const step = niceStep(max - min);
    const lo = Math.floor(min / step) * step;
    const hi = Math.max(lo + step, Math.ceil(max / step) * step);
    const ticks = [];
    for (let i = lo; i <= hi + step / 2; i += step) {
        ticks.push(i);
    }
    return {lo, hi, ticks};
};

const tickFormat = (ticks) => {
    const max = Math.max(...ticks.map(Math.abs));
    if (max >= 10000) return (i) => `${fmt(i / 1000)}k`;
    return (i) => fmt(i, max < 10 ? 1 : 0);
};

const frame = (id, height = CHART_HEIGHT) => {
    const q = $(id);
    const w = Math.max(260, q.clientWidth || 320);
    const plot = {x0: PAD.l, x1: w - PAD.r, y0: height - PAD.b, y1: PAD.t};
    return {q, w, h: height, plot};
};

const chartFrame = (id, height, buckets, scale) => {
    const {q, w, h, plot} = frame(id, height);
    const {x0, x1, y0, y1} = plot;
    const slot = (x1 - x0) / buckets.length;
    const {lo, hi} = scale;
    return {
        id, q, w, h, plot, scale, buckets, slot,
        x: (i) => x0 + slot * (i + 0.5),
        y: (j) => y0 - ((j - lo) / (hi - lo)) * (y0 - y1),
    };
};

const gridHtml = ({x0, x1}, {ticks}, y) => {
    const format = tickFormat(ticks);
    return ticks.map(j => `
        <line class="grid" x1="${x0}" x2="${x1}" y1="${y(j)}" y2="${y(j)}"></line>
        <text class="tick" x="${x0 - 6}" y="${y(j) + 4}" text-anchor="end">${format(j)}</text>`)
        .join("");
};

const xLabelsHtml = (buckets, x, {y0}) => buckets.map(
    (b, i) => `<text class="tick" x="${x(i)}" y="${y0 + 16}" text-anchor="middle">${clean(b.label)}</text>`
).join("");

const legendHtml = src => {
    if (!src.length) return "";
    const dst = src.map(({label, color, kind}) =>
        `<span class="legend-item"><i class="key ${kind}" style="--color:var(${color})"></i>${label}</span>`
    ).join("");
    return `<div class="legend">${dst}</div>`;
};

const normalLine = ({x0, x1}, y, value) => value == null
    ? ""
    : `<line class="normal" x1="${x0}" x2="${x1}" y1="${y(value)}" y2="${y(value)}"></line>`;

// Tip: title and lines {label, value, color}
const setTips = (id, tips) => chartTips.set(id, tips);

const hitRects = (id, n, x, {y0, y1}, slot) => {
    let dst = "";
    for (let i = 0; i < n; i++) {
        dst += `<rect class="hit" data-tip="${id}:${i}" x="${x(i) - slot / 2}" y="${y1}" width="${slot}" height="${y0 - y1}"></rect>`;
    }
    return dst;
};

const barPath = (x, y, w, h, up = true) => {
    if (h <= 0) return "";
    const r = Math.min(4, h, w / 2);
    const b = y + h;
    return up
        ? `M${x},${b}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${b}Z`
        : `M${x},${y}V${b - r}Q${x},${b} ${x + r},${b}H${x + w - r}Q${x + w},${b} ${x + w},${b - r}V${y}Z`;
};

const svg = (w, h, body) =>
    `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img">${body}</svg>`;

const chartSvg = ({id, w, h, plot, scale, buckets, x, y, slot}, marks) => svg(w, h,
    gridHtml(plot, scale, y) +
    marks +
    xLabelsHtml(buckets, x, plot) +
    hitRects(id, buckets.length, x, plot, slot)
);

const normalTips = (normal, decimals, unit, label) => normal == null
    ? []
    : [{label, value: `${fmt(normal, decimals)} ${unit}`, color: "--line"}];

const normalLegend = (normal, label) =>
    normal == null ? [] : [{label, color: "--line", kind: "dash"}];

const renderLine = (
    id,
    buckets,
    series,
    normal = {},
    auto = false,
    unit = "",
    decimals = 0
) => {
    const values = series.flatMap((s) => s.values).filter((v) => v != null);
    if (!values.length) return empty(id);

    const lo = auto ? Math.min(...values) : 0;
    const hi = Math.max(...values, normal.value || 0);
    const scale = auto
        ? scaleY(
            lo - Math.max(0.5, (hi - lo) * 0.2),
            hi + Math.max(0.5, (hi - lo) * 0.2),
        )
        : scaleY(0, hi * 1.08 || 1);

    const chart = chartFrame(id, CHART_HEIGHT, buckets, scale);
    const {q, plot, x, y} = chart;

    const paths = series
        .map((s) => {
            let d = "";
            let open = false;
            const dots = [];
            s.values.forEach((v, i) => {
                if (v == null) {
                    open = false;
                    return;
                }
                d += `${open ? "L" : "M"}${x(i)},${y(v)}`;
                const isolated = s.values[i - 1] == null && s.values[i + 1] == null;
                if (!s.thin && (isolated || i === s.values.length - 1 || s.values[i + 1] == null)) {
                    dots.push(i);
                }
                open = true;
            });
            return (
                `<path class="series ${s.dash ? "dash" : ""} ${s.thin ? "thin" : ""}" d="${d}" style="stroke:var(${s.color})"></path>` +
                dots.map(i => `<circle class="dot" cx="${x(i)}" cy="${y(s.values[i])}" r="4" style="fill:var(${s.color})"></circle>`).join("")
            );
        })
        .join("");

    setTips(
        id,
        buckets.map((b, i) => ({
            title: b.title || b.label,
            rows: [
                ...series
                    .filter((s) => s.values[i] != null)
                    .map((s) => ({
                        label: s.label,
                        value: `${fmt(s.values[i], decimals)} ${unit}`,
                        color: s.color,
                    })),
                ...normalTips(normal.value, decimals, unit, normal.label || S.norm),
            ],
        })),
    );

    q.innerHTML =
        chartSvg(chart, normalLine(plot, y, normal.value) + paths) +
        legendHtml([
            ...series.map((s) => ({
                label: s.label,
                color: s.color,
                kind: s.dash ? "dash" : "line",
            })),
            ...normalLegend(normal.value, normal.label || S.norm),
        ]);
};

const stackedTotals = (data, keys) =>
    data.map((row) =>
        row ? keys.reduce((sum, k) => sum + (row[k] || 0), 0) : 0,
    );

const setStackedTips = (id, buckets, keys, data, colors, labels, unit) =>
    setTips(
        id,
        buckets.map((b, i) => ({
            title: b.title || b.label,
            rows: keys.map((k) => ({
                label: labels[k],
                value: data[i] ? `${fmt(data[i][k])} ${unit}` : "—",
                color: colors[k],
            })),
        })),
    );

const stackedLegend = (keys, labels, colors) =>
    legendHtml(
        keys.map((k) => ({label: labels[k], color: colors[k], kind: "rect"})),
    );

const renderAreaStacked = (
    id,
    buckets,
    keys,
    data,
    colors,
    labels,
    unit = ""
) => {
    const totals = stackedTotals(data, keys);
    if (!totals.some((v) => v > 0)) return empty(id);

    const scale = scaleY(0, Math.max(...totals) * 1.08);
    const chart = chartFrame(id, CHART_HEIGHT, buckets, scale);
    const {q, x, y, slot} = chart;

    // One filled band per key, broken at buckets without data
    const stacks = data.map((row) => {
        let total = 0;
        return keys.map((k) => (total += row?.[k] || 0));
    });
    const runs = [];
    let run = [];
    data.forEach((row, i) => {
        if (row) run.push(i);
        else if (run.length) {
            runs.push(run);
            run = [];
        }
    });
    if (run.length) runs.push(run);

    const areas = runs
        .flatMap((indices) =>
            keys.map((key, j) => {
                const first = indices[0];
                const last = indices.at(-1);
                const lower = (i) => y(j ? stacks[i][j - 1] : 0);
                const top = [
                    `${x(first) - slot / 2},${y(stacks[first][j])}`,
                    ...indices.map((i) => `${x(i)},${y(stacks[i][j])}`),
                    `${x(last) + slot / 2},${y(stacks[last][j])}`,
                ];
                const bottom = [
                    `${x(last) + slot / 2},${lower(last)}`,
                    ...indices.map((i) => `${x(i)},${lower(i)}`).reverse(),
                    `${x(first) - slot / 2},${lower(first)}`,
                ];
                return `<path class="area" d="M${top.join("L")}L${bottom.join("L")}Z" style="fill:var(${colors[key]})"></path>`;
            }),
        )
        .join("");

    setStackedTips(id, buckets, keys, data, colors, labels, unit);
    q.innerHTML = chartSvg(chart, areas) + stackedLegend(keys, labels, colors);
};

const renderVBars = (
    id,
    buckets,
    series,
    normal = null,
    unit = "",
    decimals = 0,
    height = CHART_HEIGHT,
    legend = null
) => {
    const values = series.flatMap((s) => s.values).filter((v) => v != null && v !== 0);
    if (!values.length) return empty(id);

    const lo = Math.min(0, ...values);
    const hi = Math.max(0, ...values, normal || 0);
    const scale = scaleY(lo * 1.08, hi * 1.08 || 1);
    const chart = chartFrame(id, height, buckets, scale);
    const {q, plot, x, y, slot} = chart;
    const bw = Math.min(24, (slot * 0.6) / series.length);

    const bars = series
        .map((s, j) =>
            s.values
                .map((v, i) => {
                    if (v == null || v === 0) return "";
                    const color = typeof s.color === "function" ? s.color(v) : s.color;
                    const x0 =
                        x(i) -
                        (bw * series.length) / 2 -
                        (series.length - 1) +
                        j * (bw + 2);
                    const top = Math.min(y(0), y(v));
                    const barHeight = Math.abs(y(v) - y(0));
                    return `<path d="${barPath(x0, top, bw, barHeight, v > 0)}" style="fill:var(${color})"></path>`;
                })
                .join(""),
        )
        .join("");

    const zero = lo < 0
        ? `<line class="axis" x1="${plot.x0}" x2="${plot.x1}" y1="${y(0)}" y2="${y(0)}"></line>`
        : "";

    setTips(
        id,
        buckets.map((b, i) => ({
            title: b.title || b.label,
            rows: [
                ...series
                    .filter((s) => s.values[i] != null)
                    .map((s) => ({
                        label: s.label,
                        value: `${s.values[i] > 0 && lo < 0 ? "+" : ""}${fmt(s.values[i], decimals)} ${unit}`,
                        color: typeof s.color === "function" ? s.color(s.values[i]) : s.color,
                    })),
                ...normalTips(normal, decimals, unit, S.norm),
            ],
        })),
    );

    if (!legend) {
        legend = series.map((s) => ({label: s.label, color: s.color, kind: "rect"}));
        if (normal != null) {
            legend.push({label: S.norm, color: "--line", kind: "dash"});
        }
    }
    q.innerHTML = chartSvg(chart, zero + bars + normalLine(plot, y, normal)) + legendHtml(legend);
};

const renderHeatmap = (id, matrix, max) => {
    if (!max) return empty(id);
    const q = $(id);
    const w = Math.max(260, q.clientWidth || 320);
    const left = 16;
    const cell = (w - left - 4) / 24;
    const ch = cell - 2; // square cell with a 2px gutter on both axes
    const h = 7 * (ch + 2) + 20;

    const cells = matrix.map((row, d) => row.map((v, hr) => {
        const alpha = v ? Math.max(0.12, v / max) : 0;
        return `<rect class="cell ${v ? "" : "zero"}" x="${left + hr * cell}" y="${d * (ch + 2)}" width="${cell - 2}" height="${ch}" rx="2"
                    style="${v ? `fill:var(--accent);fill-opacity:${alpha}` : ""}" data-tip="${id}:${d * 24 + hr}"></rect>`;
    }).join("")).join("");

    const rows = [...S.Ws].map((w, d) =>
        `<text class="tick" x="${left - 6}" y="${d * (ch + 2) + ch / 2}" dominant-baseline="middle" text-anchor="end">${w}</text>`,
    ).join("");
    const cols = [0, 3, 6, 9, 12, 15, 18, 21].map((hr) =>
        `<text class="tick" x="${left + hr * cell}" y="${h - 4}" dominant-baseline="auto" text-anchor="start">${hr}</text>`,
    ).join("");

    setTips(
        id,
        matrix.flatMap((row, d) =>
            row.map((v, hr) => ({
                title: `${S.wds[d]} ${pad(hr)}:00`,
                rows: [
                    {
                        label: S.spent,
                        value: `${fmt(v)} ${settings.currency}`,
                        color: "--accent",
                    },
                ],
            })),
        ),
    );

    q.innerHTML = svg(w, h, cells + rows + cols);
};

/* --- Tip --- */

const showTip = (target, x, y) => {
    const [id, i] = target.dataset.tip.split(":");
    const tip = chartTips.get(id)?.[+i];
    if (!tip) return;
    chartTip.replaceChildren();
    const title = document.createElement("div");
    title.className = "tip-title";
    title.textContent = tip.title;
    chartTip.appendChild(title);
    tip.rows.forEach((r) => {
        const row = document.createElement("div");
        row.className = "tip-row";
        const key = document.createElement("i");
        key.style.setProperty("--color", `var(${r.color})`);
        const value = document.createElement("b");
        value.textContent = r.value;
        const label = document.createElement("span");
        label.textContent = r.label;
        row.append(key, value, label);
        chartTip.appendChild(row);
    });
    chartTip.hidden = false;
    const rect = chartTip.getBoundingClientRect();
    chartTip.style.left = `${Math.min(window.innerWidth - rect.width - 8, Math.max(8, x - rect.width / 2))}px`;
    chartTip.style.top = `${Math.max(8, y - rect.height - 16)}px`;
    document
        .querySelectorAll(".hovered")
        .forEach((el) => el.classList.remove("hovered"));
    target.classList.add("hovered");
};

const hideTip = () => {
    chartTip.hidden = true;
    document
        .querySelectorAll(".hovered")
        .forEach((el) => el.classList.remove("hovered"));
};

pages.stats.addEventListener("pointerover", (e) => {
    const target = e.target.closest("[data-tip]");
    if (target) showTip(target, e.clientX, e.clientY);
});
pages.stats.addEventListener("pointerout", (e) => {
    if (e.target.closest("[data-tip]") && e.pointerType === "mouse") hideTip();
});
pages.stats.addEventListener("pointerdown", (e) => {
    if (!e.target.closest("[data-tip]")) hideTip();
});
window.addEventListener("scroll", hideTip, {passive: true});

// ==========================================================================
// 25. STATISTICS: CHARTS
// ==========================================================================

const setChartValue = (id, text) => {
    const q = $(id).closest(".card").querySelector(".value");
    if (q) q.textContent = text || "";
};

const setDayAverage = (id, value, unit, decimals = 0) => {
    setChartValue(
        id,
        value == null ? "" : `${fmt(value, decimals)} ${unit} / ${S.dayShort}`,
    );
};

const categoryLabels = () =>
    Object.fromEntries(CATEGORIES.map((category) => [category, S.categories[category]]));

const renderStats = () => {
    hideTip();
    const [start, end] = getRange(currentDate, period);
    const buckets = getBuckets(start, end, period);
    const sums = buckets.map(aggregate);
    const days = pastDays(start, end);
    const logged = days.filter((d) => getDayEntries(getDateKey(d)).length);
    const range = rangeEntries(start, end);
    const field = (k) => sums.map((s) => (s?.[k] == null ? null : s[k]));

    /* Spending */
    const spending =
        period === DAY ? cumulative(field("total"), buckets) : field("total");
    const weekAverage = (b) =>
        b.start > new Date()
            ? null
            : average(pastDays(addDays(b.start, -6), b.end).map(dayTotal));
    const series = [
        {values: spending, color: "--red", label: S.spent},
        ...(period === WEEK
            ? [{
                values: buckets.map(weekAverage),
                color: "--green",
                label: S.average,
                thin: true,
            }]
            : []),
    ];
    renderLine(
        "spending-chart",
        buckets,
        series,
        {value: dailyBudget(currentDate), label: S.norm},
        false,
        settings.currency,
    );

    const averageSpending = average(logged.map(dayTotal));
    setDayAverage("spending-chart", averageSpending, settings.currency);

    /* By category */
    const categoryRows = sums.map((s) =>
        s
            ? Object.fromEntries(CATEGORIES.map((category) => [category, s[category]]))
            : null,
    );
    const categoryData =
        categoryMode === "pct"
            ? categoryRows.map((row) => {
                if (!row) return null;
                const total = CATEGORIES.reduce((a, k) => a + row[k], 0);
                return Object.fromEntries(
                    CATEGORIES.map((category) => [
                        category,
                        total ? (row[category] / total) * 100 : 0,
                    ]),
                );
            })
            : categoryRows;
    renderAreaStacked(
        "category-chart",
        buckets,
        CATEGORIES,
        categoryData,
        CATEGORY_COLORS,
        categoryLabels(),
        categoryMode === "pct" ? "%" : settings.currency,
    );
    setChartValue("category-chart", money(sumRange(start, end)));

    /* Difference from budget */
    const targetForBucket = (bucket) =>
        period === DAY
            ? dailyBudget(bucket.start) / buckets.length
            : dailyBudget(bucket.start);
    const balance = sums.map((s, i) =>
        s ? s.total - targetForBucket(buckets[i]) : null,
    );
    renderLine(
        "balance-chart",
        buckets,
        [{values: balance, color: "--yellow", label: S.budgetDifference}],
        {},
        true,
        settings.currency,
    );
    const averageBalance = average(balance);
    setChartValue(
        "balance-chart",
        averageBalance == null ? "" : money(averageBalance),
    );

    /* By tag */
    const tagTotals = {};
    range.forEach((item) => {
        const total = sumItems(item.items)?.total || 0;
        item.tags.forEach((tag) => {
            tagTotals[tag] = (tagTotals[tag] || 0) + total;
        });
    });
    const tagRows = Object.entries(tagTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);
    if (!tagRows.length) {
        setChartValue("tag-chart", "");
        empty("tag-chart");
    } else {
        renderVBars(
            "tag-chart",
            tagRows.map(([tag]) => ({
                label: tag.length > 8 ? tag.slice(0, 8) : tag,
                title: tag,
            })),
            [{
                values: tagRows.map(([, value]) => value),
                color: "--accent",
                label: S.total,
            }],
            null,
            settings.currency,
            0,
            140,
        );
        setChartValue("tag-chart", capitalize(clean(tagRows[0][0])));
    }

    /* By weekday: average day over the last 12 weeks */
    const weekdayFrom = addDays(startOfDay(new Date()), -84);
    const weekdayTotals = Array(7).fill(0);
    const weekdayCounts = Array(7).fill(0);
    entries
        .filter((item) => item.spent >= weekdayFrom && item.spent <= Date.now())
        .forEach((item) => {
            const total = sumItems(item.items)?.total || 0;
            const i = getWeekday(item.spent);
            weekdayTotals[i] += total;
            weekdayCounts[i]++;
        });
    const weekdayValues = weekdayTotals.map((value, i) =>
        weekdayCounts[i] ? value / weekdayCounts[i] : null,
    );
    renderVBars(
        "weekday-chart",
        S.wds.map((label) => ({label, title: label})),
        [{values: weekdayValues, color: "--blue", label: S.average}],
        dailyBudget(currentDate),
        settings.currency,
        0,
        140,
    );
    setDayAverage("weekday-chart", average(weekdayValues), settings.currency);

    /* When: hour × weekday heatmap */
    const matrix = Array.from({length: 7}, () => Array(24).fill(0));
    range.forEach((item) => {
        const d = new Date(item.spent);
        matrix[getWeekday(d)][d.getHours()] += sumItems(item.items)?.total || 0;
    });
    renderHeatmap("hour-heatmap", matrix, Math.max(...matrix.flat()));

    /* Top presets */
    const presetTotals = new Map();
    range.forEach((item) =>
        item.items.forEach((line) => {
            if (line.presetId == null) return;
            presetTotals.set(
                line.presetId,
                (presetTotals.get(line.presetId) || 0) + line.amount,
            );
        }),
    );
    const top = [...presetTotals.entries()]
        .map(([id, value]) => ({preset: findPreset(id), value}))
        .filter((row) => row.preset)
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);
    if (!top.length) {
        setChartValue("top-chart", "");
        empty("top-chart");
    } else {
        const max = top[0].value;
        $("top-chart").innerHTML = `<div class="h-list">${barsHtml(
            top.map(({preset, value}) => ({
                label: preset[lang],
                value: max ? (value / max) * 100 : 0,
                number: money(value),
            })),
        )}</div>`;
        setChartValue("top-chart", top[0].preset[lang]);
    }

    /* Entries */
    const counts = field("count");
    renderVBars(
        "count-chart",
        buckets,
        [{values: counts, color: "--green", label: S.entries}],
        null,
        "",
        0,
        140,
    );
    const averageCount = average(counts);
    setChartValue(
        "count-chart",
        averageCount == null ? "" : `${fmt(averageCount)} / ${S.dayShort}`,
    );
};

/* --- Toggles --- */

rangeArea.addEventListener("click", (e) => {
    const button = e.target.closest("button");
    if (!button) return;
    shiftRange(+button.dataset.add);
    renderStats();
});

let activePeriod = null;

periodArea.onclick = (e) => {
    const button = e.target.closest("button");
    if (!button || button === activePeriod) return;

    activePeriod.classList.remove("active");
    activePeriod = button;
    activePeriod.classList.add("active");
    periodArea.firstElementChild.style.transform = `translateX(${activePeriod.dataset.i * 100}%)`;

    period = +button.dataset.i;
    currentDate = new Date();
    renderRange();
    renderStats();
};

onSegment($("category-mode"), "mode", (value) => {
    categoryMode = value;
    renderStats();
});

let lastWidth = window.innerWidth;
window.addEventListener(
    "resize",
    debounce(() => {
        if (window.innerWidth === lastWidth) return;
        lastWidth = window.innerWidth;
        if (page === pages.stats) renderStats();
    }, 200),
);

// ==========================================================================
// 26. INIT
// ==========================================================================

document.querySelectorAll("input:not([type=file])").forEach((input) => {
    input.setAttribute("readonly", "true");
    input.addEventListener("focus", () => input.removeAttribute("readonly"));
});

(() => {
    setLanguage();
    loadAll();
    syncCurrencyText();

    page = pages.diary;
    link = navLinks.diary;
    activePeriod = periodArea.querySelector(".active");

    renderDiary();

    openPhotoStore().then((db) => {
        if (!db) return;
        gcPhotos();
    });

    // today is frozen at load: refresh it when the tab becomes visible (date change)
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) return;
        const now = new Date();
        if (getDateKey(now) === getDateKey(today)) return;
        today = now;
        calendarPages = {};
        if (page === pages.diary) renderDiary();
    });
})();
