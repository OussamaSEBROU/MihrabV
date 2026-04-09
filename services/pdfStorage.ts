import type { Book, FlashCard, ShelfData, Annotation, HabitData } from '../types';

const STORAGE_KEYS = {
  BOOKS: 'sanctuary_books',
  SHELVES: 'sanctuary_shelves',
  CARDS: 'sanctuary_cards',
  SETTINGS: 'sanctuary_settings',
  HABIT: 'sanctuary_habit'
};

const DEFAULT_SHELF: ShelfData = {
  id: 'default',
  name: 'Main Sanctuary / المحراب الأساسي',
  color: '#ff0000'
};

const STAR_THRESHOLDS = [900, 1800, 3000, 8400, 12000, 15600, 19200];

let _booksCache: Book[] | null = null;
let _shelvesCache: ShelfData[] | null = null;

export const storageService = {
  getShelves: (): ShelfData[] => {
    if (_shelvesCache) return _shelvesCache;
    const data = localStorage.getItem(STORAGE_KEYS.SHELVES);
    _shelvesCache = data ? JSON.parse(data) : [DEFAULT_SHELF];
    return _shelvesCache!;
  },

  saveShelves: (shelves: ShelfData[]) => {
    _shelvesCache = shelves;
    localStorage.setItem(STORAGE_KEYS.SHELVES, JSON.stringify(shelves));
  },

  getBooks: (): Book[] => {
    if (_booksCache) return _booksCache;
    const data = localStorage.getItem(STORAGE_KEYS.BOOKS);
    const raw: Book[] = data ? JSON.parse(data) : [];
    _booksCache = raw.map(b => ({
      ...b,
      shelfId: b.shelfId || 'default',
      annotations: b.annotations || []
    }));
    return _booksCache!;
  },

  saveBooks: (books: Book[]) => {
    _booksCache = books;
    localStorage.setItem(STORAGE_KEYS.BOOKS, JSON.stringify(books));
  },

  deleteBook: (bookId: string) => {
    const books = storageService.getBooks();
    storageService.saveBooks(books.filter(b => b.id !== bookId));
  },

  updateBookAnnotations: (bookId: string, annotations: Annotation[]) => {
    const books = storageService.getBooks();
    const i = books.findIndex(b => b.id === bookId);
    if (i !== -1) { books[i].annotations = annotations; storageService.saveBooks(books); }
  },

  updateBookPage: (bookId: string, page: number) => {
    const books = storageService.getBooks();
    const i = books.findIndex(b => b.id === bookId);
    if (i !== -1) { books[i].lastPage = page; storageService.saveBooks(books); }
  },

  updateBookStats: (bookId: string, seconds: number): { starReached: number | null } => {
    const books = storageService.getBooks();
    const index = books.findIndex(b => b.id === bookId);
    let starReached: number | null = null;
    if (index !== -1) {
      const today = new Date().toISOString().split('T')[0];
      const book = books[index];
      const oldStars = book.stars || 0;
      if (book.lastReadDate !== today) { book.dailyTimeSeconds = 0; book.lastReadDate = today; }
      book.timeSpentSeconds += seconds;
      book.dailyTimeSeconds = (book.dailyTimeSeconds || 0) + seconds;
      let stars = 0;
      for (const threshold of STAR_THRESHOLDS) {
        if (book.timeSpentSeconds >= threshold) stars++; else break;
      }
      if (stars > oldStars) {
        starReached = stars;
        if (stars === 5) {
          const habit = storageService.getHabitData();
          habit.shields = Math.min(habit.shields + 2, 3);
          storageService.saveHabitData(habit);
        }
      }
      book.stars = stars;
      book.lastReadAt = Date.now();
      storageService.saveBooks(books);
      storageService.recordReadingDay();
    }
    return { starReached };
  },

  getCards: (): FlashCard[] => {
    const data = localStorage.getItem(STORAGE_KEYS.CARDS);
    return data ? JSON.parse(data) : [];
  },

  getHabitData: (): HabitData => {
    const data = localStorage.getItem(STORAGE_KEYS.HABIT);
    const def: HabitData = { history: [], missedDays: [], shields: 2, streak: 0, lastUpdated: '', consecutiveFullDays: 0 };
    if (!data) return def;
    try {
      const p = JSON.parse(data);
      return { ...def, ...p, history: Array.isArray(p.history) ? p.history : [], missedDays: Array.isArray(p.missedDays) ? p.missedDays : [] };
    } catch { return def; }
  },

  saveHabitData: (habit: HabitData) => {
    localStorage.setItem(STORAGE_KEYS.HABIT, JSON.stringify(habit));
  },

  recordReadingDay: () => {
    const today = new Date().toISOString().split('T')[0];
    const books = storageService.getBooks();
    const totalTodaySeconds = books.reduce((acc, b) => {
      const bDate = b.lastReadDate || (b.lastReadAt ? new Date(b.lastReadAt).toISOString().split('T')[0] : '');
      return bDate === today ? acc + (b.dailyTimeSeconds || 0) : acc;
    }, 0);
    const habit = storageService.getHabitData();
    const FULL_DAY_THRESHOLD = 900;
    const RESCUE_THRESHOLD = 120;
    if (habit.lastUpdated === today && habit.history.includes(today)) return;
    if (totalTodaySeconds < RESCUE_THRESHOLD) return;
    const isFullDay = totalTodaySeconds >= FULL_DAY_THRESHOLD;
    if (habit.lastUpdated !== today) {
      if (habit.lastUpdated === '') {
        habit.streak = 1; habit.shields = 2; habit.consecutiveFullDays = isFullDay ? 1 : 0;
      } else {
        const diffDays = Math.ceil(Math.abs(new Date(today).getTime() - new Date(habit.lastUpdated).getTime()) / 86400000);
        if (diffDays === 1) {
          habit.streak += 1;
          if (isFullDay) habit.consecutiveFullDays += 1; else habit.consecutiveFullDays = 0;
        } else {
          let broken = false;
          const lastDate = new Date(habit.lastUpdated);
          for (let i = 1; i < diffDays; i++) {
            const gapDay = new Date(lastDate); gapDay.setDate(gapDay.getDate() + i);
            const g = gapDay.toISOString().split('T')[0];
            if (habit.shields > 0) { habit.shields -= 1; habit.history.push(g); }
            else { habit.missedDays.push(g); broken = true; }
          }
          if (broken) { habit.streak = 1; habit.consecutiveFullDays = isFullDay ? 1 : 0; }
          else { habit.streak += 1; if (isFullDay) habit.consecutiveFullDays += 1; else habit.consecutiveFullDays = 0; }
        }
      }
      if (habit.consecutiveFullDays >= 7) { habit.shields = Math.min(habit.shields + 1, 3); habit.consecutiveFullDays = 0; }
      if (isFullDay) habit.history.push(today);
      habit.lastUpdated = today;
    } else {
      if (isFullDay && !habit.history.includes(today)) {
        habit.history.push(today); habit.consecutiveFullDays += 1;
        if (habit.consecutiveFullDays >= 7) { habit.shields = Math.min(habit.shields + 1, 3); habit.consecutiveFullDays = 0; }
      }
    }
    storageService.saveHabitData(habit);
  }
};

declare const pdfjsLib: any;

const _yieldToMain = (): Promise<void> =>
  typeof (scheduler as any)?.yield === 'function'
    ? (scheduler as any).yield()
    : new Promise(r => setTimeout(r, 0));

const _requestPersistence = (): void => {
  if (navigator?.storage?.persist) {
    navigator.storage.persist().catch(() => {});
  }
};

let _db: IDBDatabase | null = null;
let _dbPromise: Promise<IDBDatabase> | null = null;

const getDB = (): Promise<IDBDatabase> => {
  if (_db) return Promise.resolve(_db);
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open('SanctuaryDB', 2);
    req.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('Manuscripts')) db.createObjectStore('Manuscripts');
      if (!db.objectStoreNames.contains('Covers')) db.createObjectStore('Covers');
    };
    req.onsuccess = () => {
      _db = req.result;
      _db!.onclose = () => { _db = null; _dbPromise = null; };
      _db!.onversionchange = () => { _db?.close(); _db = null; _dbPromise = null; };
      resolve(_db!);
    };
    req.onerror = () => { _dbPromise = null; reject(req.error); };
  });
  return _dbPromise;
};

const _coverMemCache = new Map<string, string>();

export const pdfStorage = {
  dbName: 'SanctuaryDB',
  storeName: 'Manuscripts',
  coverStore: 'Covers',

  init: () => {
    _requestPersistence();
    return getDB();
  },

  saveFile: async (id: string, data: ArrayBuffer): Promise<void> => {
    const db = await getDB();
    return new Promise((res, rej) => {
      const tx = db.transaction('Manuscripts', 'readwrite');
      tx.objectStore('Manuscripts').put(data, id);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  },

  getFileSize: async (id: string): Promise<number | null> => {
    const db = await getDB();
    return new Promise((res, rej) => {
      const tx = db.transaction('Manuscripts', 'readonly');
      const req = tx.objectStore('Manuscripts').get(id);
      req.onsuccess = () => {
        const result = req.result;
        res(result ? result.byteLength : null);
      };
      req.onerror = () => rej(req.error);
    });
  },

  getFile: async (id: string): Promise<ArrayBuffer | null> => {
    const db = await getDB();
    return new Promise((res, rej) => {
      const tx = db.transaction('Manuscripts', 'readonly');
      const req = tx.objectStore('Manuscripts').get(id);
      req.onsuccess = () => res(req.result ?? null);
      req.onerror = () => rej(req.error);
    });
  },

  deleteFile: async (id: string): Promise<void> => {
    _coverMemCache.delete(id);
    const db = await getDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(['Manuscripts', 'Covers'], 'readwrite');
      tx.objectStore('Manuscripts').delete(id);
      tx.objectStore('Covers').delete(id);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  },

  saveCover: async (id: string, dataUrl: string): Promise<void> => {
    _coverMemCache.set(id, dataUrl);
    const db = await getDB();
    return new Promise((res, rej) => {
      const tx = db.transaction('Covers', 'readwrite');
      tx.objectStore('Covers').put(dataUrl, id);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  },

  getCover: async (id: string): Promise<string | null> => {
    if (_coverMemCache.has(id)) return _coverMemCache.get(id)!;
    const db = await getDB();
    return new Promise((res, rej) => {
      const tx = db.transaction('Covers', 'readonly');
      const req = tx.objectStore('Covers').get(id);
      req.onsuccess = () => {
        const v = req.result ?? null;
        if (v) _coverMemCache.set(id, v);
        res(v);
      };
      req.onerror = () => rej(req.error);
    });
  },

  generateCoverFromPDF: async (pdfData: ArrayBuffer): Promise<string> => {
    try {
      await _yieldToMain();
      const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
      const page = await pdf.getPage(1);
      const scale = 400 / page.getViewport({ scale: 1 }).width;
      const vp = page.getViewport({ scale });
      const cv = document.createElement('canvas');
      cv.width = vp.width; cv.height = vp.height;
      const ctx = cv.getContext('2d', { alpha: false })!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cv.width, cv.height);
      await _yieldToMain();
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      const url = cv.toDataURL('image/jpeg', 0.82);
      cv.width = 0; cv.height = 0;
      pdf.destroy();
      return url;
    } catch {
      return pdfStorage.generatePlaceholderCover();
    }
  },

  generatePlaceholderCover: (): string => {
    const cv = document.createElement('canvas');
    cv.width = 400; cv.height = 600;
    const ctx = cv.getContext('2d')!;
    const g = ctx.createLinearGradient(0, 0, 0, 600);
    g.addColorStop(0, '#1a0000'); g.addColorStop(0.5, '#0d0d0d'); g.addColorStop(1, '#1a0000');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 400, 600);
    ctx.fillStyle = '#ff0000'; ctx.fillRect(30, 280, 340, 2);
    ctx.fillStyle = 'rgba(255,0,0,0.15)'; ctx.beginPath(); ctx.arc(200, 250, 60, 0, Math.PI * 2); ctx.fill();
    const url = cv.toDataURL('image/jpeg', 0.9);
    cv.width = 0; cv.height = 0;
    return url;
  }
};
