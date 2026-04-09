import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { pdfStorage } from './pdfStorage';
import { CommunityShelfExportSchema } from '../types/schemas';
import type { Book, ShelfData, Annotation } from '../types';
export interface CommunityShelfExport {
  version: string;
  exportedAt: string;
  shelfName: string;
  shelfColor?: string;
  userName: string;
  books: Array<{
    id: string;
    title: string;
    author: string;
    cover: string;
    content: string;
    annotations?: Annotation[];
    stars: number;
    lastPage?: number;
    addedAt: number;
  }>;
}
// ─────────────────────────────────────────────────────────
//  FORMAT IDENTIFIERS — Anti-Conflict Type Safety Protocol
// ─────────────────────────────────────────────────────────
/**
 * Internal format headers used to distinguish file types.
 * Prevents cross-importing (e.g., importing a shelf file as a book).
 */
export const FORMAT_HEADERS = {
  SHELF: 'sanctuary-shelf-archive',
  SINGLE_BOOK: 'sanctuary-single-book',
} as const;
export type FormatType = typeof FORMAT_HEADERS[keyof typeof FORMAT_HEADERS];
/**
 * File extensions for export types.
 * .mbook replaces the deprecated .sbook format.
 */
export const FILE_EXTENSIONS = {
  SHELF: '.zip',
  SINGLE_BOOK: '.zip', // Unification: Books are now also zipped archives
} as const;
// ─────────────────────────────────────────────────────────
//  JSZIP LAZY LOADER
// ─────────────────────────────────────────────────────────
let _jszip: any = null;
const _loadJSZip = async (): Promise<any> => {
  if (_jszip) return _jszip;
  return new Promise((resolve, reject) => {
    if ((window as any).JSZip) { _jszip = (window as any).JSZip; resolve(_jszip); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    s.onload = () => { _jszip = (window as any).JSZip; resolve(_jszip); };
    s.onerror = reject;
    document.head.appendChild(s);
  });
};
// ─────────────────────────────────────────────────────────
//  MEMORY-SAFE BASE64 UTILITIES
// ─────────────────────────────────────────────────────────
const _chunkToB64 = (bytes: Uint8Array): string => {
  const SLICE = 4096;
  let bin = '';
  for (let i = 0; i < bytes.length; i += SLICE) {
    const end = Math.min(i + SLICE, bytes.length);
    for (let j = i; j < end; j++) bin += String.fromCharCode(bytes[j]);
  }
  return btoa(bin);
};
const _u8ToB64 = (bytes: Uint8Array): string => {
  const CHUNK = 4096;
  let b = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const end = Math.min(i + CHUNK, bytes.length);
    for (let j = i; j < end; j++) b += String.fromCharCode(bytes[j]);
  }
  return btoa(b);
};
// Yield control back to the main thread to prevent UI freeze
const _yield = (): Promise<void> => new Promise(r => setTimeout(r, 0));
// ─────────────────────────────────────────────────────────
//  CHUNKED FILESYSTEM WRITER
// ─────────────────────────────────────────────────────────
const WRITE_CHUNK_SIZE = 512 * 1024;
const _writeChunked = async (
  bytes: Uint8Array,
  filename: string,
  directory: typeof Directory.Cache | typeof Directory.Documents = Directory.Cache
): Promise<string> => {
  const firstChunk = bytes.subarray(0, Math.min(WRITE_CHUNK_SIZE, bytes.length));
  const result = await Filesystem.writeFile({
    path: filename,
    data: _chunkToB64(firstChunk),
    directory,
    recursive: true,
  });
  
  for (let offset = WRITE_CHUNK_SIZE; offset < bytes.length; offset += WRITE_CHUNK_SIZE) {
    const end = Math.min(offset + WRITE_CHUNK_SIZE, bytes.length);
    const chunk = bytes.subarray(offset, end);
    await Filesystem.appendFile({
      path: filename,
      data: _chunkToB64(chunk),
      directory,
    });
    if ((offset / WRITE_CHUNK_SIZE) % 4 === 0) {
      await _yield();
    }
  }
  return result.uri;
};
// ─────────────────────────────────────────────────────────
//  ZIP BUILDER — PROGRESSIVE (memory-bounded)
//  Processes books ONE AT A TIME, releasing ArrayBuffer references
//  between each book to allow GC to reclaim memory.
// ─────────────────────────────────────────────────────────
const _buildZipStreaming = async (
  shelf: ShelfData,
  books: Book[],
  userName: string,
  useStore = false,
): Promise<Uint8Array> => {
  const JSZip = await _loadJSZip();
  const zip = new JSZip();
  const shelfBooks = books.filter(b => b.shelfId === shelf.id);
  const manifestBooks: any[] = [];
  let totalPdfBytes = 0;
  for (let i = 0; i < shelfBooks.length; i++) {
    const book = shelfBooks[i];
    // ── FULL COVER RETRIEVAL: Always get from IDB for highest quality ──
    let cover = book.cover;
    try {
      const storedCover = await pdfStorage.getCover(book.id);
      if (storedCover && storedCover.startsWith('data:')) cover = storedCover;
      else if (!cover || !cover.startsWith('data:')) cover = storedCover || cover;
    } catch (e) { /* cover retrieval is non-critical */ }
    // ── FULL PDF BINARY RETRIEVAL: Core of the export — must succeed ──
    try {
      const buf = await pdfStorage.getFile(book.id);
      if (buf && buf.byteLength > 0) {
        const fileSize = buf.byteLength;
        totalPdfBytes += fileSize;
        const forceStore = useStore || fileSize > 10 * 1024 * 1024;
        // Clone buffer to prevent detachment during async zip generation
        const safeBuf = buf.slice(0);
        zip.file(`pdfs/${book.id}.pdf`, safeBuf, {
          compression: forceStore ? 'STORE' : 'DEFLATE',
          compressionOptions: forceStore ? undefined : { level: 1 },
        });
        console.log(`[Export] ✓ PDF "${book.title}" → ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
      } else {
        console.warn(`[Export] ⚠ No PDF data for "${book.title}" (id: ${book.id})`);
      }
    } catch (e) {
      console.error(`[Export] ✗ PDF failed for "${book.title}"`, e);
    }
    manifestBooks.push({
      id: book.id,
      title: book.title,
      author: book.author,
      cover: cover || '',
      annotations: book.annotations || [],
      stars: book.stars || 0,
      lastPage: book.lastPage || 0,
      addedAt: book.addedAt || Date.now(),
      timeSpentSeconds: book.timeSpentSeconds || 0,
      dailyTimeSeconds: book.dailyTimeSeconds || 0,
      lastReadDate: book.lastReadDate || '',
    });
    // Yield every 2 books to prevent UI freeze
    if (i % 2 === 1) {
      await _yield();
    }
  }
  console.log(`[Export] Total PDF payload: ${(totalPdfBytes / 1024 / 1024).toFixed(2)} MB across ${shelfBooks.length} books`);
  zip.file('manifest.json', JSON.stringify({
    version: '2.0.0',
    format: FORMAT_HEADERS.SHELF,
    exportedAt: new Date().toISOString(),
    shelfName: shelf.name,
    shelfColor: shelf.color,
    userName,
    books: manifestBooks,
  }));
  return zip.generateAsync({
    type: 'uint8array',
    compression: useStore ? 'STORE' : 'DEFLATE',
    compressionOptions: useStore ? undefined : { level: 1 },
    streamFiles: true,
  });
};
// ─────────────────────────────────────────────────────────
//  SINGLE BOOK ZIP BUILDER — Unified with Shelf methodology
//  Mirrors shelf structure: PDF in /pdfs/, manifest with format header
// ─────────────────────────────────────────────────────────
const _buildSingleBookZip = async (
  book: Book,
  userName: string = 'User',
): Promise<Uint8Array> => {
  const JSZip = await _loadJSZip();
  const zip = new JSZip();
  // ── FULL PDF BINARY: Retrieve from IDB with validation ──
  const pdfData = await pdfStorage.getFile(book.id);
  if (pdfData && pdfData.byteLength > 0) {
    // Clone buffer to prevent ArrayBuffer detachment during async zip generation
    const safeBuf = pdfData.slice(0);
    zip.file(`pdfs/${book.id}.pdf`, safeBuf, { compression: 'STORE' });
    console.log(`[BookExport] ✓ PDF "${book.title}" → ${(pdfData.byteLength / 1024 / 1024).toFixed(2)} MB`);
  } else {
    console.warn(`[BookExport] ⚠ No PDF data found for "${book.title}" (id: ${book.id})`);
  }
  // ── FULL COVER: Always retrieve from IDB for highest quality ──
  let cover = book.cover;
  try {
    const stored = await pdfStorage.getCover(book.id);
    if (stored && stored.startsWith('data:')) cover = stored;
  } catch {}
  // Unified manifest — 100% compatible with shelf schema
  const manifest = {
    version: '2.0.0',
    format: FORMAT_HEADERS.SINGLE_BOOK,
    exportedAt: new Date().toISOString(),
    shelfName: `📖 ${book.title}`,
    shelfColor: '#ff0000',
    userName,
    books: [{
      id: book.id,
      title: book.title,
      author: book.author,
      cover: cover || '',
      annotations: book.annotations || [],
      stars: book.stars || 0,
      lastPage: book.lastPage || 0,
      timeSpentSeconds: book.timeSpentSeconds || 0,
      dailyTimeSeconds: book.dailyTimeSeconds || 0,
      lastReadAt: book.lastReadAt || Date.now(),
      addedAt: book.addedAt || Date.now(),
    }],
  };
  zip.file('manifest.json', JSON.stringify(manifest));
  return zip.generateAsync({
    type: 'uint8array',
    compression: 'STORE',
    streamFiles: true,
  });
};
// ─────────────────────────────────────────────────────────
//  FORMAT VALIDATION — Anti-Conflict Protocol
//  Reads manifest.json from ZIP and validates format header
// ─────────────────────────────────────────────────────────
export interface FormatValidationResult {
  valid: boolean;
  detectedFormat: FormatType | 'legacy' | 'unknown';
  expectedFormat: FormatType;
  manifest?: any;
}
const _validateZipFormat = async (
  file: File | Blob,
  expectedFormat: FormatType
): Promise<FormatValidationResult> => {
  try {
    const JSZip = await _loadJSZip();
    // Safety: ArrayBuffer is the most stable input for JSZip across devices
    const buffer = await (file as File).arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);
    
    // Check modern manifest first
    let mf = zip.file('manifest.json');
    let manifest: any = null;
    let detectedFormat: FormatType | 'legacy' | 'unknown' = 'unknown';
    if (mf) {
      manifest = JSON.parse(await mf.async('string'));
      detectedFormat = manifest.format || 'legacy';
    } else {
      // Check legacy book structure (book.json)
      const legacyMf = zip.file('book.json');
      if (legacyMf) {
        manifest = JSON.parse(await legacyMf.async('string'));
        // Legacy book.json didn't specify format, but it's clearly a single book
        detectedFormat = manifest.id && manifest.title ? FORMAT_HEADERS.SINGLE_BOOK : 'legacy';
      }
    }
    if (detectedFormat === 'unknown') {
      return { valid: false, detectedFormat: 'unknown', expectedFormat };
    }
    // Pro Detection: Count of books determines type regardless of extension
    const bookCount = (manifest.books && Array.isArray(manifest.books)) ? manifest.books.length : 0;
    const effectivelyABook = bookCount === 1;
    return {
      valid: true, // Zip is a valid zip
      detectedFormat: effectivelyABook ? FORMAT_HEADERS.SINGLE_BOOK : FORMAT_HEADERS.SHELF,
      expectedFormat,
      manifest,
    };
  } catch (e) {
    console.error('[CommunityService] ZIP Validation Error:', e);
    return { valid: false, detectedFormat: 'unknown', expectedFormat };
  }
};
// ─────────────────────────────────────────────────────────
//  ZIP IMPORT — PROGRESSIVE (memory-bounded)
//  Extracts PDFs one at a time and saves to IDB immediately
// ─────────────────────────────────────────────────────────
const _importFromZip = async (file: File): Promise<{ shelf: ShelfData; books: Book[] }> => {
  const JSZip = await _loadJSZip();
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  const mf = zip.file('manifest.json');
  if (!mf) throw new Error('Invalid shelf file: missing manifest.json');
  const manifest = JSON.parse(await mf.async('string'));
  const shelfId = `shelf_${Date.now()}`;
  const shelf: ShelfData = {
    id: shelfId,
    name: manifest.shelfName,
    color: manifest.shelfColor || '#ff0000',
  };
  const books: Book[] = [];
  for (const bd of (manifest.books || [])) {
    const newId = `book_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    try {
      const pdfEntry = zip.file(`pdfs/${bd.id}.pdf`);
      if (pdfEntry) {
        const pdfBuf: ArrayBuffer = await pdfEntry.async('arraybuffer');
        await pdfStorage.saveFile(newId, pdfBuf);
        console.log(`[Import] ✓ PDF "${bd.title}" → ${(pdfBuf.byteLength / 1024 / 1024).toFixed(2)} MB`);
      }
      if (bd.cover?.startsWith('data:image')) {
        await pdfStorage.saveCover(newId, bd.cover);
      }
    } catch (e) {
      console.error(`[Import] ✗ Failed for "${bd.title}"`, e);
    }
    // ── PURE IMPORT: Only content + annotations. Stars & reading time reset to zero ──
    books.push({
      id: newId, shelfId,
      title: bd.title, author: bd.author,
      cover: bd.cover || '', content: '[VISUAL_PDF_MODE]',
      timeSpentSeconds: 0,       // PURE: Fresh start
      dailyTimeSeconds: 0,       // PURE: Fresh start
      lastReadDate: '',           // PURE: No old dates
      stars: 0,                   // PURE: No imported stars
      addedAt: Date.now(),        // PURE: Treated as newly added
      lastPage: bd.lastPage || 0, // KEEP: Resume position is useful
      annotations: bd.annotations || [], // KEEP: Intellectual content
    });
    await _yield();
  }
  return { shelf, books };
};
// ─────────────────────────────────────────────────────────
//  SINGLE BOOK IMPORT — From unified .mbook ZIP
//  Supports both "add to existing shelf" and "create new shelf"
// ─────────────────────────────────────────────────────────
const _importSingleBookFromZip = async (
  file: File,
  targetShelfId: string,
): Promise<Book> => {
  const JSZip = await _loadJSZip();
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  const metaFile = zip.file('manifest.json');
  if (!metaFile) throw new Error('Invalid book file: missing manifest.json');
  const manifest = JSON.parse(await metaFile.async('string'));
  // Extract the single book entry from the unified manifest
  const bookData = manifest.books?.[0];
  if (!bookData) throw new Error('Invalid book file: no book data in manifest');
  const newId = `book_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  // Import PDF from /pdfs/ directory (unified structure)
  let pdfFound = false;
  const pdfEntry = zip.file(`pdfs/${bookData.id}.pdf`);
  if (pdfEntry) {
    const pdfBuf: ArrayBuffer = await pdfEntry.async('arraybuffer');
    await pdfStorage.saveFile(newId, pdfBuf);
    pdfFound = true;
    console.log(`[BookImport] ✓ PDF "${bookData.title}" → ${(pdfBuf.byteLength / 1024 / 1024).toFixed(2)} MB`);
  }
  // Also try legacy location (book.pdf) for backward compatibility with old .sbook
  if (!pdfFound) {
    const legacyPdf = zip.file('book.pdf');
    if (legacyPdf) {
      const pdfBuf: ArrayBuffer = await legacyPdf.async('arraybuffer');
      await pdfStorage.saveFile(newId, pdfBuf);
      console.log(`[BookImport] ✓ Legacy PDF "${bookData.title}" → ${(pdfBuf.byteLength / 1024 / 1024).toFixed(2)} MB`);
    }
  }
  // Import cover
  const cover = bookData.cover || '';
  if (cover.startsWith('data:')) {
    await pdfStorage.saveCover(newId, cover);
  }
  // ── PURE IMPORT: Only content + annotations. Stars & reading time reset to zero ──
  return {
    id: newId,
    shelfId: targetShelfId,
    title: bookData.title,
    author: bookData.author,
    cover,
    content: '[VISUAL_PDF_MODE]',
    timeSpentSeconds: 0,             // PURE: Fresh start
    dailyTimeSeconds: 0,             // PURE: Fresh start
    stars: 0,                         // PURE: No imported stars
    addedAt: Date.now(),              // PURE: Treated as newly added
    lastPage: bookData.lastPage || 0, // KEEP: Resume position
    annotations: bookData.annotations || [], // KEEP: Intellectual content
  };
};
// Legacy .sbook backward-compatible import
const _importLegacySbook = async (
  file: File,
  targetShelfId: string,
): Promise<Book> => {
  const JSZip = await _loadJSZip();
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  // Legacy .sbook uses book.json instead of manifest.json
  const metaFile = zip.file('book.json') || zip.file('manifest.json');
  if (!metaFile) throw new Error('Invalid book file: missing metadata');
  const meta = JSON.parse(await metaFile.async('string'));
  // If manifest.json with books array, redirect to unified import
  if (meta.books && Array.isArray(meta.books)) {
    return _importSingleBookFromZip(file, targetShelfId);
  }
  const newId = `book_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  // Legacy PDF location
  const pdfEntry = zip.file('book.pdf');
  if (pdfEntry) {
    const pdfBuf: ArrayBuffer = await pdfEntry.async('arraybuffer');
    await pdfStorage.saveFile(newId, pdfBuf);
  }
  if (meta.cover?.startsWith('data:')) {
    await pdfStorage.saveCover(newId, meta.cover);
  }
  // ── PURE IMPORT: Stars & reading time reset to zero ──
  return {
    id: newId,
    shelfId: targetShelfId,
    title: meta.title,
    author: meta.author,
    cover: meta.cover || '',
    content: '[VISUAL_PDF_MODE]',
    timeSpentSeconds: 0,              // PURE: Fresh start
    dailyTimeSeconds: 0,              // PURE: Fresh start
    stars: 0,                          // PURE: No imported stars
    addedAt: Date.now(),               // PURE: Treated as newly added
    lastPage: meta.lastPage || 0,      // KEEP: Resume position
    annotations: meta.annotations || [], // KEEP: Intellectual content
  };
};
const _importFromJson = async (
  jsonData: string,
  targetShelfId?: string
): Promise<{ shelf: ShelfData; books: Book[] }> => {
  const data = CommunityShelfExportSchema.parse(JSON.parse(jsonData));
  const shelfId = targetShelfId || `shelf_${Date.now()}`;
  const shelf: ShelfData = { id: shelfId, name: data.shelfName, color: data.shelfColor || '#ff0000' };
  const books: Book[] = [];
  for (const bd of data.books) {
    const newId = `book_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    if (bd.content?.length) {
      try {
        const bin = atob(bd.content);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        await pdfStorage.saveFile(newId, bytes.buffer);
        if (bd.cover?.startsWith('data:image')) await pdfStorage.saveCover(newId, bd.cover);
      } catch (e) { console.error(`[Import JSON] ✗ Failed for "${bd.title}"`, e); }
    }
    // ── PURE IMPORT: Stars & reading time reset to zero ──
    books.push({
      id: newId, shelfId,
      title: bd.title, author: bd.author,
      cover: bd.cover || '', content: '[VISUAL_PDF_MODE]',
      timeSpentSeconds: 0,        // PURE: Fresh start
      dailyTimeSeconds: 0,        // PURE: Fresh start
      lastReadDate: '',            // PURE: No old dates
      stars: 0,                    // PURE: No imported stars
      addedAt: Date.now(),         // PURE: Treated as newly added
      lastPage: bd.lastPage || 0,  // KEEP: Resume position
      annotations: bd.annotations || [], // KEEP: Intellectual content
    });
    await _yield();
  }
  return { shelf, books };
};
// ─────────────────────────────────────────────────────────
//  SHARE HELPER — chunked write + native share
// ─────────────────────────────────────────────────────────
const _writeAndShare = async (
  zipBytes: Uint8Array,
  filename: string,
  title: string,
  text: string,
  dialogTitle: string
): Promise<void> => {
  const uri = await _writeChunked(zipBytes, filename, Directory.Cache);
  await Share.share({ title, text, files: [uri], dialogTitle });
};
// ─────────────────────────────────────────────────────────
//  PUBLIC API
// ─────────────────────────────────────────────────────────
export const communityService = {
  // ---- FORMAT CONSTANTS (exposed for UI) ----
  FORMAT_HEADERS,
  FILE_EXTENSIONS,
  /**
   * Export a shelf as a ZIP file.
   */
  exportShelf: async (
    shelf: ShelfData, books: Book[], userName = 'User'
  ): Promise<{ uri: string; filename: string }> => {
    const zipBytes = await _buildZipStreaming(shelf, books, userName);
    const name = shelf.name.replace(/[\\/\*?:"<>|]/g, '').trim() || 'shelf';
    const filename = `${name}${FILE_EXTENSIONS.SHELF}`;
    const uri = await _writeChunked(zipBytes, filename, Directory.Documents);
    return { uri, filename };
  },
  importShelf: async (
    jsonData: string, targetShelfId?: string
  ): Promise<{ shelf: ShelfData; books: Book[] }> => {
    return _importFromJson(jsonData, targetShelfId);
  },
  /**
   * Import a file — auto-detects format (shelf vs book).
   * For .mbook and .sbook files, throws FORMAT_MISMATCH error
   * so the caller can redirect to importBook instead.
   */
  importFile: async (file: File): Promise<{ shelf: ShelfData; books: Book[] }> => {
    const ext = file.name.toLowerCase();
    
    // Explicit single-book check
    if (ext.endsWith('.mbook') || ext.endsWith('.sbook')) {
      throw new Error('FORMAT_MISMATCH:SINGLE_BOOK');
    }
    // Try robust ZIP probe for files without proper extension or .zip/.bin
    if (ext.endsWith('.zip') || !ext.includes('.') || ext.endsWith('.bin')) {
      const validation = await _validateZipFormat(file, FORMAT_HEADERS.SHELF);
      
      // If we are in shelf import but detected a single book, redirect
      if (validation.detectedFormat === FORMAT_HEADERS.SINGLE_BOOK) {
        throw new Error('FORMAT_MISMATCH:SINGLE_BOOK');
      }
      
      // If valid shelf zip (modern or legacy)
      if (validation.valid || validation.detectedFormat === 'legacy') {
        return _importFromZip(file);
      }
    }
    
    // Fallback to JSON for .json or similar
    try {
      const json = await communityService.readFile(file);
      return _importFromJson(json);
    } catch {
      throw new Error('UNSUPPORTED_FORMAT');
    }
  },
  /**
   * Download/save a file using its native URI.
   */
  downloadFile: async (uri: string, filename: string, lang: 'ar' | 'en' = 'ar'): Promise<void> => {
    try {
      await Share.share({
        title: lang === 'ar' ? `تنزيل رف: ${filename}` : `Download Shelf: ${filename}`,
        text: lang === 'ar' ? 'جاري حفظ نسخة من الرف...' : 'Saving shelf to your device...',
        files: [uri],
      });
    } catch (e) { console.error('Download failed', e); }
  },
  readFile: (file: File): Promise<string> =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = e => res(e.target?.result as string);
      r.onerror = () => rej(new Error('Failed to read file'));
      // Performance: use readAsText for small JSON metadata
      r.readAsText(file);
    }),
  readFileAsArrayBuffer: (file: File): Promise<ArrayBuffer> =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = e => res(e.target?.result as ArrayBuffer);
      r.onerror = () => rej(new Error('Failed to read buffer'));
      r.readAsArrayBuffer(file);
    }),
  shareShelf: async (
    shelf: ShelfData, books: Book[], userName = 'User', lang: 'ar' | 'en' = 'ar'
  ): Promise<{ success: boolean; method: 'share' | 'clipboard' }> => {
    try {
      const shelfBooks = books.filter(b => b.shelfId === shelf.id);
      const totalBooks = shelfBooks.length;
      
      let estimatedSize = 0;
      for (const book of shelfBooks.slice(0, Math.min(5, totalBooks))) {
        const size = await pdfStorage.getFileSize(book.id);
        if (size) estimatedSize += size;
      }
      if (totalBooks > 5) {
        estimatedSize += (estimatedSize / 5) * (totalBooks - 5);
      }
      
      const useLargeMethod = totalBooks > 15 || estimatedSize > 100 * 1024 * 1024;
      
      const zipBytes = await _buildZipStreaming(shelf, books, userName, useLargeMethod);
      
      const name = shelf.name.replace(/[\\/\*?:"<>|]/g, '').trim() || 'shelf';
      await _writeAndShare(
        zipBytes,
        `share_${name}${FILE_EXTENSIONS.SHELF}`,
        lang === 'ar' ? `مشاركة رف: ${shelf.name}` : `Share Shelf: ${shelf.name}`,
        lang === 'ar' ? `إليك كتبي من المحراب - ${userName}` : `Here are my Sanctuary books - ${userName}`,
        lang === 'ar' ? 'اختر تطبيقاً للمشاركة' : 'Choose app to share'
      );
      return { success: true, method: 'share' };
    } catch (e: any) {
      console.error('shareShelf failed', e);
      return { success: false, method: 'clipboard' };
    }
  },
  // ─────────────────────────────────────────────────────────
  //  SINGLE BOOK PORTABILITY v2.0 — Unified .mbook Format
  //  REPLACES deprecated .sbook methodology entirely.
  //  Mirrors shelf ZIP structure: /pdfs/ + manifest.json
  // ─────────────────────────────────────────────────────────
  exportBook: async (book: Book): Promise<{ uri: string; filename: string }> => {
    const userName = localStorage.getItem('sanctuary_user_name') || 'User';
    const zipBytes = await _buildSingleBookZip(book, userName);
    const safeName = book.title.replace(/[\\/\*?:"<>|]/g, '').trim() || 'book';
    const filename = `${safeName}${FILE_EXTENSIONS.SINGLE_BOOK}`;
    const uri = await _writeChunked(zipBytes, filename, Directory.Cache);
    return { uri, filename };
  },
  /**
   * Import a single book from .mbook (or legacy .sbook).
   * Returns the imported Book object assigned to the given shelf.
   */
  importBook: async (file: File, targetShelfId: string): Promise<Book> => {
    const ext = file.name.toLowerCase();
    
    // Use robust probe if extension isn't clear
    const isMbook = ext.endsWith('.mbook');
    const isSbook = ext.endsWith('.sbook');
    const isUnknownZip = ext.endsWith('.zip') || !ext.includes('.') || ext.endsWith('.bin');
    if (isMbook) {
      return _importSingleBookFromZip(file, targetShelfId);
    }
    if (isSbook) {
      return _importLegacySbook(file, targetShelfId);
    }
    if (isUnknownZip) {
      // Probe content
      const validation = await _validateZipFormat(file, FORMAT_HEADERS.SINGLE_BOOK);
      
      // If it's a valid single-book structure (even if renamed)
      if (validation.detectedFormat === FORMAT_HEADERS.SINGLE_BOOK || validation.valid) {
        return _importSingleBookFromZip(file, targetShelfId);
      }
      
      // If it's a shelf instead, notify UI
      if (validation.detectedFormat === FORMAT_HEADERS.SHELF) {
        throw new Error('FORMAT_MISMATCH:SHELF');
      }
    }
    throw new Error('UNSUPPORTED_FORMAT');
  },
  /**
   * Validate a file's format before import.
   * Returns format info for the UI to display appropriate errors.
   */
  validateFileFormat: async (file: File): Promise<{
    isBook: boolean;
    isShelf: boolean;
    isLegacy: boolean;
    formatName: string;
  }> => {
    const ext = file.name.toLowerCase();
    
    // Robust path: Everything now flows through ZIP checking
    if (ext.endsWith('.zip') || ext.endsWith('.mbook') || ext.endsWith('.sbook') || !ext.includes('.') || ext.endsWith('.bin')) {
      try {
        const validation = await _validateZipFormat(file, FORMAT_HEADERS.SINGLE_BOOK);
        const bookCount = (validation.manifest?.books?.length) || 0;
        
        if (bookCount === 1) {
          return { isBook: true, isShelf: false, isLegacy: false, formatName: 'Mihrab Book Archive' };
        } 
        if (bookCount > 1) {
          return { isBook: false, isShelf: true, isLegacy: validation.detectedFormat === 'legacy', formatName: 'Mihrab Shelf Archive' };
        }
      } catch {
        // Fall through to JSON or Unknown
      }
    }
    if (ext.endsWith('.json')) {
      return { isBook: false, isShelf: true, isLegacy: true, formatName: 'Legacy JSON Shelf' };
    }
    return { isBook: false, isShelf: false, isLegacy: false, formatName: 'Unknown' };
  },
  shareBook: async (book: Book, lang: 'ar' | 'en' = 'ar'): Promise<void> => {
    const { uri, filename } = await communityService.exportBook(book);
    await Share.share({
      title: lang === 'ar' ? `كتاب: ${book.title}` : `Book: ${book.title}`,
      text: lang === 'ar' ? `شارك كتاب "${book.title}" من المحراب` : `Sharing "${book.title}" from Sanctuary`,
      files: [uri],
      dialogTitle: lang === 'ar' ? 'مشاركة الكتاب' : 'Share Book',
    });
  },
};
