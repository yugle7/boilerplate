// UI translations. The ru and en key sets must match.
// Keep user-facing copy here; script.js only reads from `S`.

const ruPlural = (n, one, few, many) => {
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
};

const ruDays = (n) => ruPlural(n, "день", "дня", "дней");

window.TRANSLATIONS = {
    ru: {
        locale: "ru-RU",
        appName: "Дневник расходов",
        currencySymbol: "₽",

        /* --- Navigation --- */
        mainNavigation: "Основная навигация",
        diary: "Дневник",
        addEntry: "Добавить расход",
        stats: "Статистика",
        budget: "Бюджет",
        settings: "Настройки",
        previous: "Ранее",
        next: "Далее",
        previousPeriod: "Предыдущий период",
        nextPeriod: "Следующий период",
        minus: "Уменьшить",
        plus: "Увеличить",

        /* --- Diary --- */
        noRecords: "Нет записей",
        categories: ["Еда", "Транспорт", "Дом", "Другое"],
        categoryFood: "Еда",
        categoryTransport: "Транспорт",
        categoryHome: "Дом",
        categoryOther: "Другое",
        calendarStreak: (days) =>
            `${days} ${ruDays(days)} в рамках бюджета`,
        spent: "Потрачено",
        left: "Осталось",
        weekSpent: "Неделя",
        monthSpent: "Месяц",

        /* --- Entry --- */
        selectDate: "Выбрать дату",
        selectTime: "Выбрать время",
        categoryLabel: "Категория расхода",
        parsePlaceholder: "Кофе 250, автобус 60",
        clear: "Очистить",
        photo: "Чек",
        removePhoto: "Удалить фото",
        voice: "Голосовой ввод",
        search: "Поиск",
        favorites: "Избранное",
        my: "Мои",
        quickPicks: "Быстрый выбор",
        recent: "Недавнее",
        frequent: "Частое",
        total: "Итого",
        notFound: "Не найдено — создайте шаблон",
        tags: "Теги",
        change: "Изменить",
        note: "Заметка",
        notePlaceholder: "За что, где, с кем…",
        confirm: "Сохранить",
        checkItems: (n) =>
            `Проверьте ${n} ${ruPlural(n, "позицию", "позиции", "позиций")}`,
        deleteEntryQuestion: "Удалить этот расход?",
        photoError: "Не удалось сохранить фото",

        /* --- Search and amount --- */
        searchPlaceholder: "Кофе, автобус, продукты…",
        searchTabs: {
            all: "Все",
            favorites: "Избранное",
        },
        nothingFound: "Ничего не найдено",
        create: "Создать",
        edit: "Изменить",
        portion: "Сумма",
        amount: "Сумма",
        defaultAmount: "Сумма по умолчанию",

        /* --- Tags --- */
        newTag: "Новый тег",
        add: "Добавить",
        tagActions: "Нажмите на тег, чтобы изменить или удалить его",
        defaultTags: [
            "работа",
            "дом",
            "подписка",
            "подарок",
            "поездка",
            "необходимое",
        ],

        /* --- Preset --- */
        presetName: "Название",
        category: "Категория",
        save: "Сохранить",
        cancel: "Отменить",
        delete: "Удалить",
        remove: "Убрать",
        close: "Закрыть",
        deletePresetQuestion: "Удалить шаблон? Старые записи не изменятся.",

        /* --- Budget --- */
        monthlyBudget: "Бюджет на месяц",
        categoryBudgets: "Лимиты по категориям",
        dailyBudget: "Бюджет на день",
        currency: "Валюта",
        budgetSummary: "Распределено",

        /* --- Settings --- */
        support: "Сказать спасибо",
        mailTo: "Написать нам",
        privacy: "Политика конфиденциальности",
        exportData: "Экспорт данных",
        importData: "Импорт данных",
        reset: "Сбросить данные",
        resetQuestion: "Удалить все записи, шаблоны и фото?",
        importQuestion: "Заменить все текущие данные данными из файла?",
        importError:
            "Файл не подходит: это не экспорт Дневника расходов или он из более новой версии",
        storageError: "Не удалось сохранить: память браузера заполнена",
        yes: "Да",
        no: "Нет",

        /* --- Statistics --- */
        day: "День",
        week: "Неделя",
        month: "Месяц",
        dayShort: "день",
        average: "Среднее",
        noData: "Нет данных за период",
        norm: "Бюджет",
        spending: "Расходы",
        byCategory: "По категориям",
        budgetDifference: "Отклонение от бюджета",
        byTag: "По тегам",
        byWeekday: "По дням недели",
        when: "Во сколько",
        topPresets: "Куда уходит больше",
        entries: "Записи",
        amountMode: "суммы",
        percentMode: "доли",

        /* --- Calendar --- */
        mons: [
            "янв",
            "фев",
            "мар",
            "апр",
            "мая",
            "июн",
            "июл",
            "авг",
            "сен",
            "окт",
            "ноя",
            "дек",
        ],
        months: [
            "Январь",
            "Февраль",
            "Март",
            "Апрель",
            "Май",
            "Июнь",
            "Июль",
            "Август",
            "Сентябрь",
            "Октябрь",
            "Ноябрь",
            "Декабрь",
        ],
        wds: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
        Ws: "ПВСЧПСВ",
    },

    en: {
        locale: "en-US",
        appName: "Daybook",
        currencySymbol: "$",

        /* --- Navigation --- */
        mainNavigation: "Main navigation",
        diary: "Diary",
        addEntry: "Add expense",
        stats: "Statistics",
        budget: "Budget",
        settings: "Settings",
        previous: "Previous",
        next: "Next",
        previousPeriod: "Previous period",
        nextPeriod: "Next period",
        minus: "Decrease",
        plus: "Increase",

        /* --- Diary --- */
        noRecords: "No records",
        categories: ["Food", "Transport", "Home", "Other"],
        categoryFood: "Food",
        categoryTransport: "Transport",
        categoryHome: "Home",
        categoryOther: "Other",
        calendarStreak: (days) =>
            `${days} ${days === 1 ? "day" : "days"} within budget`,
        spent: "Spent",
        left: "Left",
        weekSpent: "Week",
        monthSpent: "Month",

        /* --- Entry --- */
        selectDate: "Select date",
        selectTime: "Select time",
        categoryLabel: "Expense category",
        parsePlaceholder: "Coffee 4.50, bus 2.00",
        clear: "Clear",
        photo: "Receipt",
        removePhoto: "Remove photo",
        voice: "Voice input",
        search: "Search",
        favorites: "Favorites",
        my: "My",
        quickPicks: "Quick picks",
        recent: "Recent",
        frequent: "Frequent",
        total: "Total",
        notFound: "Not found — create a preset",
        tags: "Tags",
        change: "Change",
        note: "Note",
        notePlaceholder: "What for, where, with whom…",
        confirm: "Save",
        checkItems: (n) => `Check ${n} ${n === 1 ? "item" : "items"}`,
        deleteEntryQuestion: "Delete this expense?",
        photoError: "Could not save the photo",

        /* --- Search and amount --- */
        searchPlaceholder: "Coffee, bus, groceries…",
        searchTabs: {
            all: "All",
            favorites: "Favorites",
        },
        nothingFound: "Nothing found",
        create: "Create",
        edit: "Edit",
        portion: "Amount",
        amount: "Amount",
        defaultAmount: "Default amount",

        /* --- Tags --- */
        newTag: "New tag",
        add: "Add",
        tagActions: "Tap a tag to edit or delete it",
        defaultTags: [
            "work",
            "home",
            "subscription",
            "gift",
            "travel",
            "essential",
        ],

        /* --- Preset --- */
        presetName: "Name",
        category: "Category",
        save: "Save",
        cancel: "Cancel",
        delete: "Delete",
        remove: "Remove",
        close: "Close",
        deletePresetQuestion: "Delete this preset? Past records stay unchanged.",

        /* --- Budget --- */
        monthlyBudget: "Monthly budget",
        categoryBudgets: "Category limits",
        dailyBudget: "Daily budget",
        currency: "Currency",
        budgetSummary: "Allocated",

        /* --- Settings --- */
        support: "Say thanks",
        mailTo: "Contact us",
        privacy: "Privacy Policy",
        exportData: "Export data",
        importData: "Import data",
        reset: "Reset data",
        resetQuestion: "Delete all records, presets and photos?",
        importQuestion: "Replace all current data with the data from the file?",
        importError:
            "This file is not a Daybook export or it comes from a newer version",
        storageError: "Could not save: browser storage is full",
        yes: "Yes",
        no: "No",

        /* --- Statistics --- */
        day: "Day",
        week: "Week",
        month: "Month",
        dayShort: "day",
        average: "Average",
        noData: "No data for the period",
        norm: "Budget",
        spending: "Spending",
        byCategory: "By category",
        budgetDifference: "Difference from budget",
        byTag: "By tag",
        byWeekday: "By weekday",
        when: "When",
        topPresets: "Top expenses",
        entries: "Entries",
        amountMode: "amounts",
        percentMode: "shares",

        /* --- Calendar --- */
        mons: [
            "jan",
            "feb",
            "mar",
            "apr",
            "may",
            "jun",
            "jul",
            "aug",
            "sep",
            "oct",
            "nov",
            "dec",
        ],
        months: [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December",
        ],
        wds: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        Ws: "MTWTFSS",
    },
};
