import { Book, ShelfData } from '../types';
import { pdfStorage } from './pdfStorage';

/**
 * MIHRAB / Community Service
 * 
 * Objectives:
 * 1. Absolute Data Portability: Fix KB-sized export bug by ensuring full PDF binary inclusion.
 * 2. Pure Import: Reset reading metrics (stars, time) when importing shared content.
 * 3. Eternal Sync: Use ZIP-based .mbook standard for 100% restore success.
 */

// Lazy load JSZip from CDN to keep initial bundle small
const _loadJSZip = async () => {
  if (!(window as any).JSZip) {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    script.async = true;
    document.head.appendChild(script);
    await new Promise((resolve) => { script.onload = resolve; });
  }
  return (window as any).JSZip;
};

const _buildZipStreaming = async (
  shelf: ShelfData,
  books: Book[],
  userName: string,
): Promise<Uint8Array> => {
  const JSZip = await _loadJSZip();
  const zip = new JSZip();

  // (1) Metadata for archiving integrity
  zip.file("meta.json", JSON.stringify({
    version: "2.0.0",
    exportedBy: userName,
    exportedAt: new Date().toISOString(),
    isShelf: true
  }));

  // (2) Shelf Structure
  zip.file("shelf.json", JSON.stringify(shelf));

  // (3) Books and FULL PDF Binary Data
  const booksFolder = zip.folder("books");
  for (const book of books) {
    // CRITICAL: Fetching the actual binary PDF from IndexedDB
    const pdfData = await pdfStorage.getFile(book.id);
    
    // VALIDATION: Throw error if data is missing to avoid producing corrupt archives
    if (!pdfData || pdfData.byteLength < 100) {
      console.error(`[Community] Export failed for "${book.title}": PDF binary not found in IDB.`);
      throw new Error(`PDF data for "${book.title}" is missing or corrupted. Please ensure the book is fully loaded before exporting.`);
    }

    console.log(`[Community] Exporting "${book.title}" - Binary Size: ${(pdfData.byteLength / 1024).toFixed(2)} KB`);

    // PURE IMPORT LOGIC: Remove personal achievements/triggers before sharing
    const cleanBook: Book = {
      ...book,
      stars: 0,
      timeSpentSeconds: 0,
      dailyTimeSeconds: 0,
      lastReadDate: "",
      lastReadAt: null,
      // Retain intellectual content
      intellectualNote: book.intellectualNote || "",
      annotations: book.annotations || []
    };

    booksFolder.file(`${book.id}.json`, JSON.stringify(cleanBook));
    booksFolder.file(`${book.id}.pdf`, pdfData);
  }

  // Generate binary ZIP blob
  return await zip.generateAsync({ 
    type: "uint8array", 
    compression: "DEFLATE",
    compressionOptions: { level: 6 } 
  });
};

export const communityService = {
  /**
   * Exports an entire shelf with all its books and PDF files into a single .mbook ZIP.
   */
  exportShelf: async (shelf: ShelfData, books: Book[], userName: string): Promise<Uint8Array> => {
    return await _buildZipStreaming(shelf, books, userName);
  },

  /**
   * Decodes an .mbook ZIP and returns the structured data for database insertion.
   */
  importMBook: async (data: ArrayBuffer): Promise<{ shelf: ShelfData; books: Book[]; pdfs: { id: string; data: ArrayBuffer }[] }> => {
    const JSZip = await _loadJSZip();
    const zip = await JSZip.loadAsync(data);
    
    // Auto-detect if it's a shelf (v2.0) or legacy single book (v1.0)
    const isShelf = zip.file("shelf.json") !== null;
    
    if (isShelf) {
      const shelfJson = await zip.file("shelf.json")?.async("string");
      const shelf: ShelfData = JSON.parse(shelfJson!);
      
      const bookFiles = zip.folder("books")?.filter((path) => path.endsWith(".json"));
      const books: Book[] = [];
      const pdfs: { id: string; data: ArrayBuffer }[] = [];

      if (bookFiles) {
        for (const file of bookFiles) {
          const bookId = file.name.split('/').pop()?.replace('.json', '');
          const bookJson = await file.async("string");
          const pdfFile = zip.file(`books/${bookId}.pdf`);
          
          if (pdfFile) {
            const pdfData = await pdfFile.async("arraybuffer");
            books.push(JSON.parse(bookJson));
            pdfs.push({ id: bookId!, data: pdfData });
          }
        }
      }
      return { shelf, books, pdfs };
    } else {
      // Legacy single book support
      const bookJson = await zip.file("book.json")?.async("string");
      const pdfData = await zip.file("book.pdf")?.async("arraybuffer");
      const book: Book = JSON.parse(bookJson!);
      return {
        shelf: { id: 'temp', title: 'Imported', description: '', bookIds: [book.id], color: '#ffffff' },
        books: [book],
        pdfs: [{ id: book.id, data: pdfData! }]
      };
    }
  }
};
