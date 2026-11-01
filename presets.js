// Demo preset catalog (read-only). A preset is a reusable expense line:
// a name, a default amount, a category and optional tags.
//
// Row: [id, en, ru, aliases, amount, category, tags]
//   category: 0 — food, 1 — transport, 2 — home, 3 — other
//   aliases:  synonyms separated by "|" (both languages)
//   tags:     tags separated by "|"
//
// Replace this file with the reference data of your own application.
// User-created presets are stored separately in localStorage.

(() => {
  const rows = [
    /* --- Food --- */
    [1, "Coffee", "Кофе", "espresso|latte|cappuccino|americano|кофе|латте", 4, 0, "work"],
    [2, "Lunch", "Обед", "lunch|business lunch|обед|ланч", 12, 0, "work"],
    [3, "Groceries", "Продукты", "groceries|supermarket|food shopping|продукты|супермаркет", 45, 0, "essential"],
    [4, "Bakery", "Пекарня", "bread|croissant|bakery|хлеб|булочная|пекарня", 6, 0, ""],
    [5, "Restaurant", "Ресторан", "dinner out|restaurant|ресторан|ужин", 30, 0, ""],
    [6, "Delivery", "Доставка", "takeaway|delivery|доставка|на вынос", 18, 0, ""],
    [7, "Farmers market", "Рынок", "market|farmers market|рынок", 22, 0, "essential"],

    /* --- Transport --- */
    [8, "Bus ticket", "Автобус", "bus|autobus|автобус", 2.5, 1, "transport"],
    [9, "Metro", "Метро", "subway|metro|underground|метро", 3, 1, "transport"],
    [10, "Taxi", "Такси", "taxi|cab|ride|такси", 15, 1, "transport"],
    [11, "Fuel", "Бензин", "petrol|gas|fuel|бензин|заправка", 50, 1, "transport"],
    [12, "Train", "Поезд", "train|railway|поезд|электричка", 25, 1, "travel"],

    /* --- Home --- */
    [13, "Rent", "Аренда", "rent|landlord|аренда|квартира", 1200, 2, "essential"],
    [14, "Electricity", "Электричество", "electricity|power bill|электричество|свет", 60, 2, "essential"],
    [15, "Internet", "Интернет", "internet|broadband|интернет", 40, 2, "subscription"],
    [16, "Water bill", "Вода", "water bill|water|вода|коммуналка", 25, 2, "essential"],
    [17, "Cleaning", "Уборка", "cleaning|cleaner|уборка|клининг", 20, 2, ""],
    [18, "Furniture", "Мебель", "furniture|chair|table|мебель|стул|стол", 120, 2, ""],

    /* --- Other --- */
    [19, "Cinema", "Кино", "cinema|movie|кино|фильм", 12, 3, "fun"],
    [20, "Books", "Книги", "books|book shop|книги|книжный", 18, 3, "fun"],
    [21, "Gym", "Спортзал", "gym|fitness|спортзал|фитнес", 35, 3, "health"],
    [22, "Pharmacy", "Аптека", "pharmacy|medicine|аптека|лекарства", 20, 3, "health"],
    [23, "Subscription", "Подписка", "subscription|streaming|подписка|сервис", 10, 3, "subscription"],
    [24, "Gift", "Подарок", "gift|present|подарок", 30, 3, "gift"],
    [25, "Clothes", "Одежда", "clothes|shopping|одежда|шопинг", 60, 3, ""],
    [26, "Haircut", "Стрижка", "haircut|barber|стрижка|парикмахер", 25, 3, ""],
    [27, "Pet supplies", "Питомец", "pet|cat|dog|питомец|корм", 22, 3, ""],
  ];

  window.PRESETS = rows.map(
    ([id, en, ru, aliases, amount, category, tags]) => ({
      id,
      en,
      ru,
      aliases: aliases ? aliases.split("|") : [],
      amount,
      category,
      tags: tags ? tags.split("|") : [],
      custom: false,
      archived: false,
    }),
  );
})();
