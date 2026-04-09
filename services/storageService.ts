import { syncBridge } from './syncBridge';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
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
    
    // Hard persistence for mobile (Backup)
    if (Capacitor.isNativePlatform()) {
      Filesystem.writeFile({
        path: 'backup_shelves.json',
        data: JSON.stringify(shelves),
        directory: Directory.Data,
        encoding: 'utf8' as any
      }).catch(() => {});
    }
    
    syncBridge.syncFull(storageService.getBooks(), shelves, 'Shelf Update');
  },

  getBooks: (): Book[] => {
    if (!_booksCache) {
      const data = localStorage.getItem(STORAGE_KEYS.BOOKS);
      const raw: Book[] = data ? JSON.parse(data) : [];
      _booksCache = raw.map(b => ({
        ...b,
        shelfId: b.shelfId || 'default',
        annotations: b.annotations || []
      }));
    }
    // Always return a new array reference so React detects state changes
    return [..._booksCache!];
  },
  
  saveBooks: (books: Book[]) => {
    _booksCache = books;
    localStorage.setItem(STORAGE_KEYS.BOOKS, JSON.stringify(books));
    
    // Hard persistence for mobile (Backup)
    if (Capacitor.isNativePlatform()) {
      Filesystem.writeFile({
        path: 'backup_books.json',
        data: JSON.stringify(books),
        directory: Directory.Data,
        encoding: 'utf8' as any
      }).catch(() => {});
    }
  },

  deleteBook: (bookId: string) => {
    const books = storageService.getBooks();
    storageService.saveBooks(books.filter(b => b.id !== bookId));
  },

  updateBookAnnotations: (bookId: string, annotations: Annotation[]) => {
    const books = storageService.getBooks();
    const index = books.findIndex(b => b.id === bookId);
    if (index !== -1) {
      books[index].annotations = annotations;
      storageService.saveBooks(books);
    }
  },

  updateBookPage: (bookId: string, page: number) => {
    const books = storageService.getBooks();
    const index = books.findIndex(b => b.id === bookId);
    if (index !== -1) {
      books[index].lastPage = page;
      storageService.saveBooks(books);
    }
  },

  updateBookStats: (bookId: string, seconds: number): { starReached: number | null } => {
    const books = storageService.getBooks();
    const index = books.findIndex(b => b.id === bookId);
    let starReached: number | null = null;

    if (index !== -1) {
      const today = new Date().toISOString().split('T')[0];
      const book = books[index];
      const oldStars = book.stars || 0;

      if (book.lastReadDate !== today) {
        book.dailyTimeSeconds = 0;
        book.lastReadDate = today;
      }

      book.timeSpentSeconds += seconds;
      book.dailyTimeSeconds = (book.dailyTimeSeconds || 0) + seconds;
      // Accumulate session time across periodic syncs (same session = lastReadAt within 60s)
      const timeSinceLastRead = Date.now() - (book.lastReadAt || 0);
      if (timeSinceLastRead < 60000) {
        book.sessionTimeSeconds = (book.sessionTimeSeconds || 0) + seconds;
      } else {
        book.sessionTimeSeconds = seconds; // New session
      }
      
      let stars = 0;
      for (const threshold of STAR_THRESHOLDS) {
        if (book.timeSpentSeconds >= threshold) stars++;
        else break;
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

      if (seconds > 0) {
        syncBridge.syncFull(books, storageService.getShelves(), `Reading: ${book.title}`);
      }
    }
    return { starReached };
  },

  getCards: (): FlashCard[] => {
    const data = localStorage.getItem(STORAGE_KEYS.CARDS);
    return data ? JSON.parse(data) : [];
  },

  getHabitData: (): HabitData => {
    const data = localStorage.getItem(STORAGE_KEYS.HABIT);
    const defaultHabit: HabitData = { 
      history: [], missedDays: [], shields: 2, streak: 0, lastUpdated: '', consecutiveFullDays: 0
    };
    if (!data) return defaultHabit;
    try {
      const parsed = JSON.parse(data);
      return {
        ...defaultHabit, ...parsed,
        history: Array.isArray(parsed.history) ? parsed.history : [],
        missedDays: Array.isArray(parsed.missedDays) ? parsed.missedDays : []
      };
    } catch (e) { return defaultHabit; }
  },

  saveHabitData: (habit: HabitData) => {
    localStorage.setItem(STORAGE_KEYS.HABIT, JSON.stringify(habit));
  },

  recordReadingDay: () => {
    const today = new Date().toISOString().split('T')[0];
    const books = storageService.getBooks();
    const totalTodaySeconds = books.reduce((acc, b) => {
      const bDate = b.lastReadDate || (b.lastReadAt ? new Date(b.lastReadAt).toISOString().split('T')[0] : '');
      if (bDate === today) return acc + (b.dailyTimeSeconds || 0);
      return acc;
    }, 0);

    const habit = storageService.getHabitData();
    const FULL_DAY_THRESHOLD = 900;
    const RESCUE_THRESHOLD = 120;

    if (habit.lastUpdated === today && habit.history.includes(today)) return;
    if (totalTodaySeconds < RESCUE_THRESHOLD) return;

    const isFullDay = totalTodaySeconds >= FULL_DAY_THRESHOLD;

    if (habit.lastUpdated !== today) {
      if (habit.lastUpdated === '') {
        habit.streak = 1;
        habit.shields = 2;
        habit.consecutiveFullDays = isFullDay ? 1 : 0;
      } else {
        const lastDate = new Date(habit.lastUpdated);
        const todayDate = new Date(today);
        const diffTime = Math.abs(todayDate.getTime() - lastDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          habit.streak += 1;
          if (isFullDay) habit.consecutiveFullDays += 1;
          else habit.consecutiveFullDays = 0;
        } else {
          let streakBroken = false;
          for (let i = 1; i < diffDays; i++) {
            const gapDay = new Date(lastDate);
            gapDay.setDate(gapDay.getDate() + i);
            const gapDayStr = gapDay.toISOString().split('T')[0];
            if (habit.shields > 0) {
              habit.shields -= 1;
              habit.history.push(gapDayStr);
            } else {
              habit.missedDays.push(gapDayStr);
              streakBroken = true;
            }
          }
          if (streakBroken) {
            habit.streak = 1;
            habit.consecutiveFullDays = isFullDay ? 1 : 0;
          } else {
            habit.streak += 1;
            if (isFullDay) habit.consecutiveFullDays += 1;
            else habit.consecutiveFullDays = 0;
          }
        }
      }
      if (habit.consecutiveFullDays >= 7) {
        habit.shields = Math.min(habit.shields + 1, 3);
        habit.consecutiveFullDays = 0;
      }
      if (isFullDay) habit.history.push(today);
      habit.lastUpdated = today;
    } else if (isFullDay && !habit.history.includes(today)) {
      habit.history.push(today);
      habit.consecutiveFullDays += 1;
      if (habit.consecutiveFullDays >= 7) {
        habit.shields = Math.min(habit.shields + 1, 3);
        habit.consecutiveFullDays = 0;
      }
    }
    storageService.saveHabitData(habit);
  }
};
