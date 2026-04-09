import { Book, ShelfData } from '../types';
import { pdfStorage } from './pdfStorage';

// ─── JSZip Loader: Guaranteed single-load with full error recovery ───────────
let _jsZipPromise: Promise<any> | null = null;

const _loadJSZip = (): Promise<any> => {
  if ((window as any).JSZip) return Promise.resolve((window as any).JSZip);
  if (_jsZipPromise) return _jsZipPromise;

  _jsZipPromise = new Promise<any>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    script.async = true;
    script.onload = () => {
      if ((window as any).JSZip) {
        resolve((window as any).JSZip);
      } else {
        _jsZipPromise = null;
        reject(new Error('[Mihrab] JSZip loaded but not found on window'));
      }
    };
    script.onerror = () => {
      _jsZipPromise = null;
      reject(new Error('[Mihrab] Failed to load JSZip engine'));
    };
    document.head.appendChild(script);
  });

  return _jsZipPromise;
};

// ─── Pure Import sanitiser: strips personal stats, preserves knowledge ───────
const _sanitiseBookForExport = (book: Book): Book => ({
  ...book,
  stars: 0,
  timeSpentSeconds: 0,
  dailyTimeSeconds: 0,
  sessionTimeSeconds: 0,
  lastReadAt: undefined,
  lastReadDate: '',
  annotations: book.annotations ?? [],
});

// ─── Community Service ────────────────────────────────────────────────────────
export const communityService = {

  exportShelf: async (
    shelf: ShelfData,
    books: Book[],
    userName: string
  ): Promise<{ uri: string; filename: string }> => {
    const JSZip = await _loadJSZip();
    const zip = new JSZip();

    zip.file('meta.json', JSON.stringify({
      version: '2.1.0',
      exportedBy: userName,
      exportedAt: new Date().toISOString(),
      type: 'SHELF_ARCHIVE',
      bookCount: books.length,
    }));

    zip.file('shelf.json', JSON.stringify(shelf));

    const booksFolder = zip.folder('books')!;
    let exportedCount = 0;

    for (const book of books) {
      const pdfData = await pdfStorage.getFile(book.id);

      if (!pdfData || pdfData.byteLength < 512) {
        console.warn(`[Mihrab/Export] Skipping "${book.title}" — binary missing or corrupt`);
        continue;
      }

      const cleanBook = _sanitiseBookForExport(book);
      booksFolder.file(`${book.id}.json`, JSON.stringify(cleanBook));
      booksFolder.file(`${book.id}.pdf`, pdfData);
      exportedCount++;
    }

    if (exportedCount === 0) {
      throw new Error('NO_EXPORTABLE_BOOKS');
    }

    const content = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const safeShelfName = shelf.name.replace(/[^\w\u0600-\u06FF]/g, '_');
    const filename = `Mihrab_${safeShelfName}_${Date.now()}.zip`;
    const uri = URL.createObjectURL(content);

    return { uri, filename };
  },

  shareBook: async (book: Book, lang: string): Promise<void> => {
    const JSZip = await _loadJSZip();
    const zip = new JSZip();

    const pdfData = await pdfStorage.getFile(book.id);
    if (!pdfData || pdfData.byteLength < 512) {
      throw new Error(
        lang === 'ar'
          ? 'ملف الكتاب غير موجود محلياً أو تالف'
          : 'Book binary not found locally or is corrupt'
      );
    }

    const cleanBook = _sanitiseBookForExport(book);

    zip.file('meta.json', JSON.stringify({
      version: '2.1.0',
      type: 'SINGLE_BOOK',
      exportedAt: new Date().toISOString(),
    }));
    zip.file('book.json', JSON.stringify(cleanBook));
    zip.file('book.pdf', pdfData);

    const content = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 5 },
    });

    const safeTitle = book.title.replace(/[^\w\u0600-\u06FF]/g, '_');
    const file = new File([content], `${safeTitle}.mbook`, { type: 'application/zip' });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: book.title,
        text:
          lang === 'ar'
            ? `شارك معي هذا الكتاب من المحراب: ${book.title}`
            : `Check out this book from Mihrab: ${book.title}`,
      });
    } else {
      const uri = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = uri;
      link.download = `${safeTitle}.mbook`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(uri), 10_000);
    }
  },

  importFile: async (file: File): Promise<{ shelf: ShelfData; books: Book[] }> => {
    const JSZip = await _loadJSZip();
    const zip = await JSZip.loadAsync(file);

    const metaJson = await zip.file('meta.json')?.async('string');
    const meta = metaJson ? JSON.parse(metaJson) : {};

    if (meta.type === 'SINGLE_BOOK') {
      throw new Error('BOOK_AS_SHELF');
    }

    const shelfJson = await zip.file('shelf.json')?.async('string');
    if (!shelfJson) throw new Error('INVALID_FORMAT');

    const shelf: ShelfData = JSON.parse(shelfJson);
    const books: Book[] = [];

    const booksFolder = zip.folder('books');
    if (!booksFolder) throw new Error('INVALID_FORMAT');

    const jsonFiles: { relativePath: string; file: any }[] = [];
    booksFolder.forEach((relativePath: string, file: any) => {
      if (relativePath.endsWith('.json')) jsonFiles.push({ relativePath, file });
    });

    for (const { relativePath, file: jsonFile } of jsonFiles) {
      try {
        const bookId = relativePath.replace('.json', '');
        const bookData: Book = JSON.parse(await jsonFile.async('string'));
        const pdfData: ArrayBuffer | undefined = await zip
          .file(`books/${bookId}.pdf`)
          ?.async('arraybuffer');

        if (!pdfData || pdfData.byteLength < 512) {
          console.warn(`[Mihrab/Import] Skipping "${bookData.title}" — PDF missing in archive`);
          continue;
        }

        await pdfStorage.saveFile(bookId, pdfData);

        const cleanBook: Book = {
          ...bookData,
          stars: 0,
          timeSpentSeconds: 0,
          dailyTimeSeconds: 0,
          sessionTimeSeconds: 0,
          lastReadAt: undefined,
          lastReadDate: '',
          annotations: bookData.annotations ?? [],
        };

        books.push(cleanBook);
      } catch (err) {
        console.error('[Mihrab/Import] Failed to process book entry:', relativePath, err);
      }
    }

    return { shelf, books };
  },

  importBook: async (file: File, targetShelfId: string): Promise<Book> => {
    const JSZip = await _loadJSZip();
    const zip = await JSZip.loadAsync(file);

    const metaJson = await zip.file('meta.json')?.async('string');
    const meta = metaJson ? JSON.parse(metaJson) : {};

    if (meta.type === 'SHELF_ARCHIVE') {
      throw new Error('SHELF_AS_BOOK');
    }

    const bookJson = await zip.file('book.json')?.async('string');
    const pdfData = await zip.file('book.pdf')?.async('arraybuffer');

    if (!bookJson || !pdfData || pdfData.byteLength < 512) {
      throw new Error('INVALID_FORMAT');
    }

    const bookData: Book = JSON.parse(bookJson);
    const newId = `imp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    await pdfStorage.saveFile(newId, pdfData);

    const importedBook: Book = {
      ...bookData,
      id: newId,
      shelfId: targetShelfId,
      stars: 0,
      timeSpentSeconds: 0,
      dailyTimeSeconds: 0,
      sessionTimeSeconds: 0,
      lastReadAt: undefined,
      lastReadDate: '',
      annotations: bookData.annotations ?? [],
    };

    return importedBook;
  },

  downloadFile: async (uri: string, filename: string, _lang: string): Promise<void> => {
    const link = document.createElement('a');
    link.href = uri;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(uri), 10_000);
  },
};
