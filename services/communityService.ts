import { Book, ShelfData } from '../types';
import { pdfStorage } from './pdfStorage';

// دالة ذكية لتحميل مكتبة الضغط وضمان عملها حتى لو انقطع الإنترنت لاحقاً
const _loadJSZip = async () => {
  if (!(window as any).JSZip) {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    script.async = true;
    document.head.appendChild(script);
    await new Promise((resolve, reject) => { 
      script.onload = resolve; 
      script.onerror = () => reject(new Error("Failed to load JSZip engine"));
    // });
  }
  return (window as any).JSZip;
};

export const communityService = {
  exportShelf: async (shelf: ShelfData, books: Book[], userName: string): Promise<{ uri: string; filename: string }> => {
    try {
      const JSZip = await _loadJSZip();
      const zip = new JSZip();

      // (1) ملف المعلومات الأساسية
      zip.file("meta.json", JSON.stringify({
        version: "2.0.0",
        exportedBy: userName,
        exportedAt: new Date().toISOString(),
        type: "SHELF_ARCHIVE"
      }));

      // (2) بيانات الرف
      zip.file("shelf.json", JSON.stringify(shelf));

      // (3) مجلد الكتب والملفات الفعلية
      const booksFolder = zip.folder("books");
      
      for (const book of books) {
        // محاولة جلب ملف الـ PDF من التخزين المحلي (IndexedDB)
        const pdfData = await pdfStorage.getFile(book.id);
        
        // التحقق الحاسم: منع تصدير ملفات فارغة (KB)
        if (!pdfData || pdfData.byteLength < 1000) {
          console.warn(`[Community] Book "${book.title}" has no binary data. Skipping binary export.`);
          continue; 
        }

        // الاستيراد النقي (Pure Import): تصفير العدادات الشخصية عند التصدير لضمان بداية جديدة للمستلم
        const cleanBook: Book = {
          ...book,
          stars: 0,
          timeSpentSeconds: 0,
          dailyTimeSeconds: 0,
          lastReadAt: undefined,
          lastReadDate: "",
          sessionTimeSeconds: 0
          // الملاحظات والتعليقات (Annotations) تبقى كما هي لضمان استدامة المعرفة
        };

        booksFolder.file(`${book.id}.json`, JSON.stringify(cleanBook));
        booksFolder.file(`${book.id}.pdf`, pdfData);
      }

      // توليد ملف الـ ZIP النهائي بجودة ضغط عالية
      const content = await zip.generateAsync({ 
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 }
      });

      const filename = `Mihrab_${shelf.name.replace(/\s+/g, '_')}_${new Date().getTime()}.zip`;
      const uri = URL.createObjectURL(content);
      
      return { uri, filename };

    } catch (error: any) {
      console.error("[Community] Export Critical Error:", error);
      throw error;
    }
  },

  shareBook: async (book: Book, lang: string): Promise<void> => {
    try {
      const JSZip = await _loadJSZip();
      const zip = new JSZip();
      
      const pdfData = await pdfStorage.getFile(book.id);
      if (!pdfData || pdfData.byteLength < 1000) {
        throw new Error(lang === 'ar' ? 'ملف الكتاب غير موجود محلياً' : 'Book binary not found locally');
      }

      const cleanBook: Book = {
        ...book,
        stars: 0,
        timeSpentSeconds: 0,
        dailyTimeSeconds: 0,
        lastReadAt: undefined,
        lastReadDate: "",
        sessionTimeSeconds: 0
      };

      zip.file("meta.json", JSON.stringify({ version: "2.0.0", type: "SINGLE_BOOK" }));
      zip.file("book.json", JSON.stringify(cleanBook));
      zip.file("book.pdf", pdfData);

      const content = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
      const file = new File([content], `${book.title.replace(/\s+/g, '_')}.mbook`, { type: "application/zip" });

      if (navigator.share) {
        await navigator.share({
          files: [file],
          title: book.title,
          text: lang === 'ar' ? `شارك معي هذا الكتاب من المحراب: ${book.title}` : `Check out this book from Mihrab: ${book.title}`
        });
      } else {
        const uri = URL.createObjectURL(content);
        const link = document.createElement('a');
        link.href = uri;
        link.download = `${book.title.replace(/\s+/g, '_')}.mbook`;
        link.click();
      }
    } catch (error) {
      console.error("[Community] Share Book Error:", error);
      throw error;
    }
  },

  importFile: async (file: File): Promise<{ shelf: ShelfData; books: Book[] }> => {
    const JSZip = await _loadJSZip();
    const zip = await JSZip.loadAsync(file);
    
    const metaJson = await zip.file("meta.json")?.async("string");
    const meta = metaJson ? JSON.parse(metaJson) : {};
    
    if (meta.type === "SINGLE_BOOK") {
      throw new Error("BOOK_AS_SHELF");
    }

    const shelfJson = await zip.file("shelf.json")?.async("string");
    if (!shelfJson) throw new Error("INVALID_FORMAT");
    
    const shelf: ShelfData = JSON.parse(shelfJson);
    const books: Book[] = [];
    
    const booksFolder = zip.folder("books");
    const jsonFiles = booksFolder?.filter(path => path.endsWith(".json")) || [];

    for (const jsonFile of jsonFiles) {
      const bookId = jsonFile.name.split('/').pop()?.replace('.json', '');
      const bookData = JSON.parse(await jsonFile.async("string"));
      const pdfData = await zip.file(`books/${bookId}.pdf`)?.async("arraybuffer");

      if (pdfData) {
        await pdfStorage.saveFile(bookId!, pdfData);
        books.push(bookData);
      }
    }

    return { shelf, books };
  },

  importBook: async (file: File, targetShelfId: string): Promise<Book> => {
    const JSZip = await _loadJSZip();
    const zip = await JSZip.loadAsync(file);
    
    const metaJson = await zip.file("meta.json")?.async("string");
    const meta = metaJson ? JSON.parse(metaJson) : {};
    
    if (meta.type === "SHELF_ARCHIVE") {
      throw new Error("SHELF_AS_BOOK");
    }

    const bookJson = await zip.file("book.json")?.async("string");
    const pdfData = await zip.file("book.pdf")?.async("arraybuffer");

    if (!bookJson || !pdfData) throw new Error("INVALID_FORMAT");

    const book: Book = JSON.parse(bookJson);
    book.shelfId = targetShelfId;
    // Ensure unique ID to avoid collisions on import
    book.id = `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await pdfStorage.saveFile(book.id, pdfData);
    return book;
  },

  downloadFile: async (uri: string, filename: string, lang: string) => {
    const link = document.createElement('a');
    link.href = uri;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
