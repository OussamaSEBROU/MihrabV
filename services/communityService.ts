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
    });
  }
  return (window as any).JSZip;
};

export const communityService = {
  exportShelf: async (shelf: ShelfData, books: Book[], userName: string): Promise<Uint8Array> => {
    try {
      const JSZip = await _loadJSZip();
      const zip = new JSZip();

      // (1) ملف المعلومات الأساسية
      zip.file("meta.json", JSON.stringify({
        version: "2.0.0",
        exportedBy: userName,
        exportedAt: new Date().toISOString()
      }));

      // (2) بيانات الرف
      zip.file("shelf.json", JSON.stringify(shelf));

      // (3) مجلد الكتب والملفات الفعلية
      const booksFolder = zip.folder("books");
      
      for (const book of books) {
        // محاولة جلب ملف الـ PDF 
        const pdfData = await pdfStorage.getFile(book.id);
        
        // التحقق الحاسم: منع تصدير ملفات فارغة (KB)
        if (!pdfData || pdfData.byteLength < 500) {
          throw new Error(`الملف الخاص بكتاب "${book.title}" غير موجود أو تالف. يجب فتح الكتاب مرة واحدة قبل تصديره.`);
        }

        // الاستيراد النقي (Pure Import): تصفير العدادات الشخصية
        const cleanBook: Book = {
          ...book,
          stars: 0,
          timeSpentSeconds: 0,
          dailyTimeSeconds: 0,
          lastReadAt: null,
          lastReadDate: ""
          // الملاحظات والتعليقات (Annotations) تبقى كما هي
        };

        booksFolder.file(`${book.id}.json`, JSON.stringify(cleanBook));
        booksFolder.file(`${book.id}.pdf`, pdfData);
      }

      // توليد ملف الـ ZIP النهائي بجودة ضغط عالية
      return await zip.generateAsync({ 
        type: "uint8array",
        compression: "DEFLATE",
        compressionOptions: { level: 6 }
      });

    } catch (error: any) {
      console.error("[Community] Export Critical Error:", error);
      throw error; // تمرير الخطأ لواجهة المستخدم لإظهار السبب
    }
  },

  importMBook: async (data: ArrayBuffer) => {
    const JSZip = await _loadJSZip();
    const zip = await JSZip.loadAsync(data);
    const shelfJson = await zip.file("shelf.json")?.async("string");
    const shelf: ShelfData = JSON.parse(shelfJson!);
    
    const bookFiles = zip.folder("books")?.filter(p => p.endsWith(".json")) || [];
    const books: Book[] = [];
    const pdfs: { id: string; data: ArrayBuffer }[] = [];

    for (const file of bookFiles) {
      const bookId = file.name.split('/').pop()?.replace('.json', '');
      const bookJson = await file.async("string");
      const pdfData = await zip.file(`books/${bookId}.pdf`)?.async("arraybuffer");

      if (pdfData) {
        books.push(JSON.parse(bookJson));
        pdfs.push({ id: bookId!, data: pdfData });
      }
    }

    return { shelf, books, pdfs };
  }
};
