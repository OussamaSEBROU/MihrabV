import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useMotionValue, motion, AnimatePresence } from 'framer-motion';
import { ViewState } from './types';
import type { Language, Insight, Book, ShelfData } from './types';
import { Layout } from './components/Layout';
import { SystemNotificationManager } from './components/SystemNotificationManager';
import { Shelf } from './components/Shelf';
import Reader from './components/Reader';
import { Dashboard } from './components/Dashboard';
import { CelebrationOverlay } from './components/CelebrationOverlay';
import { Onboarding } from './components/Onboarding';
import { translations } from './i18n/translations';
import { storageService } from './services/storageService';
import { pdfStorage } from './services/pdfStorage';
import { setupMobile, triggerHaptic } from './services/mobileService';
import { communityService } from './services/communityService';
import {
  Menu, X, Plus, Clock, Star, BookOpen, Trash2, Globe, LayoutDashboard, Library,
  Check, Upload, Loader2, BookMarked, AlertTriangle,
  ShieldCheck, BrainCircuit, Send, Zap, Sparkles, Download, Share2, FileJson
} from 'lucide-react';
declare const pdfjsLib: any;
// pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
// const MotionDiv = motion.div as any;
const MotionAside = motion.aside as any;
// ===== CURATED ATMOSPHERIC COVER THEMES =====
// Gradient-based deterministic covers as ultimate fallback for books without PDF covers
const COVER_THEMES = [
  { bg: ['#1a0000', '#2d0a0a', '#0d0d0d'], accent: '#ff3333' },
  { bg: ['#0a0a1a', '#1a0a2d', '#0d0d0d'], accent: '#6644ff' },
  { bg: ['#0a1a0a', '#0a2d1a', '#0d0d0d'], accent: '#33ff66' },
  { bg: ['#1a1a0a', '#2d2d0a', '#0d0d0d'], accent: '#ffaa33' },
  { bg: ['#0a1a1a', '#0a2d2d', '#0d0d0d'], accent: '#33ccff' },
  { bg: ['#1a0a1a', '#2d0a2d', '#0d0d0d'], accent: '#ff33cc' },
  { bg: ['#1a100a', '#2d1a0a', '#0d0d0d'], accent: '#ff6633' },
  { bg: ['#0a0a0a', '#1a1a1a', '#050505'], accent: '#ff0000' },
];
// Generate a beautiful styled placeholder cover with book title
const generateStyledCover = (bookId: string, title: string): string => {
  let hash = 0;
  for (let i = 0; i < bookId.length; i++) {
    hash = ((hash << 5) - hash) + bookId.charCodeAt(i);
    hash |= 0;
  }
  const seed = Math.abs(hash);
  const theme = COVER_THEMES[seed % COVER_THEMES.length];
  
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 900;
  const ctx = canvas.getContext('2d')!;
  
  // Rich gradient background
  const gradient = ctx.createLinearGradient(0, 0, 600, 900);
  gradient.addColorStop(0, theme.bg[0]);
  gradient.addColorStop(0.5, theme.bg[1]);
  gradient.addColorStop(1, theme.bg[2]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 600, 900);
  
  // Decorative geometric elements
  ctx.globalAlpha = 0.08;
  for (let i = 0; i < 6; i++) {
    const x = (seed * (i + 1) * 97) % 600;
    const y = (seed * (i + 1) * 53) % 900;
    const r = 40 + (seed * (i + 1)) % 100;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = theme.accent;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  
  // Accent line
  ctx.fillStyle = theme.accent;
  ctx.globalAlpha = 0.6;
  ctx.fillRect(60, 400, 480, 2);
  ctx.globalAlpha = 1;
  
  // Sanctuary logo circle
  ctx.globalAlpha = 0.12;
  ctx.beginPath();
  ctx.arc(300, 350, 80, 0, Math.PI * 2);
  ctx.fillStyle = theme.accent;
  ctx.fill();
  ctx.globalAlpha = 1;
  
  // Title text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px Alexandria, Tajawal, sans-serif';
  ctx.textAlign = 'center';
  const words = title.split(' ');
  let line = '';
  let y = 480;
  for (const word of words) {
    const testLine = line ? line + ' ' + word : word;
    if (ctx.measureText(testLine).width > 480) {
      ctx.fillText(line, 300, y);
      line = word;
      y += 45;
    } else {
      line = testLine;
    }
  }
  if (line) ctx.fillText(line, 300, y);
  
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  canvas.width = 0;
  canvas.height = 0;
  return dataUrl;
};
const App: React.FC = () => {
  const [view, setView] = useState<ViewState>(ViewState.SHELF);
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('sanctuary_lang') as Language;
    if (!saved) {
      // Very first time setup
      localStorage.setItem('sanctuary_lang', 'ar');
      localStorage.setItem('sanctuary_notif_lang', 'ar');
      return 'ar';
    }
    return saved;
  });
  
  // Ensure notification language is set if it's missing (legacy support)
  useEffect(() => {
    if (!localStorage.getItem('sanctuary_notif_lang')) {
      localStorage.setItem('sanctuary_notif_lang', lang);
    }
  }, [lang]);
  const [sessionStartTime] = useState<number>(Date.now());
  const [books, setBooks] = useState<Book[]>([]);
  const [shelves, setShelves] = useState<ShelfData[]>([]);
  const [activeShelfId, setActiveShelfId] = useState<string>('default');
  const [activeBookIndex, setActiveBookIndex] = useState(0);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [isAddingBook, setIsAddingBook] = useState(false);
  const [isAddingShelf, setIsAddingShelf] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newBookTitle, setNewBookTitle] = useState('');
  const [newBookAuthor, setNewBookAuthor] = useState('');
  const [newShelfName, setNewShelfName] = useState('');
  const [pendingFileData, setPendingFileData] = useState<ArrayBuffer | null>(null);
  const [pendingCoverUrl, setPendingCoverUrl] = useState<string | null>(null);
  const [celebrationStar, setCelebrationStar] = useState<number | null>(null);
  const [activeInsightIndex, setActiveInsightIndex] = useState(0);
  const [showInsights, setShowInsights] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [bookToDelete, setBookToDelete] = useState<Book | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [isUiVisible, setIsUiVisible] = useState(true);
  const uiTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isNavVisible, setIsNavVisible] = useState(false);
  const navTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const introAudioRef = useRef<HTMLAudioElement | null>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const importBookFileInputRef = useRef<HTMLInputElement>(null);
  const [isExportingShelf, setIsExportingShelf] = useState(false);
  const [isImportingShelf, setIsImportingShelf] = useState(false);
  const [isSharingShelf, setIsSharingShelf] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [exportUserName, setExportUserName] = useState('');
  const [exportShelfName, setExportShelfName] = useState('');
  const [shelfToExport, setShelfToExport] = useState<ShelfData | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; detail?: string; type: 'success' | 'error' } | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // ── PREMIUM LOADING OVERLAY STATE ──
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
  const [loadingOverlayTitle, setLoadingOverlayTitle] = useState('');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const loadingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [loadingOverlayMode, setLoadingOverlayMode] = useState<'book' | 'shelf'>('book');
  // ── BOOK IMPORT SHELF SELECTION STATE ──
  const [showBookImportShelfSelect, setShowBookImportShelfSelect] = useState(false);
  const [pendingBookImportFile, setPendingBookImportFile] = useState<File | null>(null);
  const [bookImportTargetShelfId, setBookImportTargetShelfId] = useState<string>('');
  const [bookImportNewShelfName, setBookImportNewShelfName] = useState('');
  const [bookImportMode, setBookImportMode] = useState<'existing' | 'new'>('existing');
  // ── FORMAT MISMATCH ALERT STATE ──
  const [showFormatMismatch, setShowFormatMismatch] = useState(false);
  const [formatMismatchMessage, setFormatMismatchMessage] = useState('');
  const shelfDragY = useMotionValue(0);
  // Auto-hide UI for Zen Aesthetics (Shelf View)
  useEffect(() => {
    if (view !== ViewState.SHELF) {
      setIsUiVisible(true);
      return;
    }
    const hideUi = () => setIsUiVisible(false);
    const resetTimer = () => {
      setIsUiVisible(true);
      if (uiTimeoutRef.current) clearTimeout(uiTimeoutRef.current);
      uiTimeoutRef.current = setTimeout(hideUi, 8000);
    };
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('touchstart', resetTimer);
    resetTimer();
    return () => {
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
      if (uiTimeoutRef.current) clearTimeout(uiTimeoutRef.current);
    };
  }, [view]);
  // Shelf Swiping Logic
  const handleShelfSwipe = useCallback((direction: 'next' | 'prev') => {
    if (shelves.length <= 1) return;
    const currentIndex = shelves.findIndex(s => s.id === activeShelfId);
    let nextIndex;
    if (direction === 'next') {
      nextIndex = (currentIndex + 1) % shelves.length;
    } else {
      nextIndex = (currentIndex - 1 + shelves.length) % shelves.length;
    }
    setActiveShelfId(shelves[nextIndex].id);
    setActiveBookIndex(0);
    triggerHaptic();
    shelfDragY.set(0);
  }, [shelves, activeShelfId, shelfDragY]);
  useEffect(() => {
    setupMobile(view, setView);
  }, [view]);
  useEffect(() => {
    const onboardingSeen = localStorage.getItem('sanctuary_onboarding_seen');
    const actualBooks = storageService.getBooks();
    if (!onboardingSeen && actualBooks.length === 0) {
      setShowOnboarding(true);
    }
  }, []);
  const handleOnboardingComplete = useCallback(() => {
    localStorage.setItem('sanctuary_onboarding_seen', 'true');
    setShowOnboarding(false);
  }, []);
  const confirmDeleteBook = useCallback(async () => {
    const confirmPhrase = lang === 'ar' ? 'امسح من المحراب' : 'DELETE';
    if (!bookToDelete || deleteConfirmInput.trim() !== confirmPhrase) return;
    await pdfStorage.deleteFile(bookToDelete.id);
    storageService.deleteBook(bookToDelete.id);
    const updatedBooks = storageService.getBooks();
    setBooks(updatedBooks);
    setBookToDelete(null);
    setDeleteConfirmInput('');
    if (activeBookIndex >= updatedBooks.filter(b => b.shelfId === activeShelfId).length) {
      setActiveBookIndex(Math.max(0, updatedBooks.filter(b => b.shelfId === activeShelfId).length - 1));
    }
  }, [bookToDelete, deleteConfirmInput, activeBookIndex, activeShelfId, lang]);
  useEffect(() => {
    if (view === ViewState.SHELF) {
      setShowInsights(true);
      const timer = setTimeout(() => {
        setShowInsights(false);
      }, 45000);
      return () => clearTimeout(timer);
    } else {
      setShowInsights(false);
    }
    // High-level mobile immersive setup on each view change
    setupMobile(view, setView);
  }, [view]);
  useEffect(() => {
    const loadedBooks = storageService.getBooks();
    const loadedShelves = storageService.getShelves();
    setBooks(loadedBooks);
    setShelves(loadedShelves);
  }, []);
  const t = (translations as any)[lang];
  const filteredBooks = useMemo(() => books.filter(b => b.shelfId === activeShelfId), [books, activeShelfId]);
  const fontClass = lang === 'ar' ? 'font-ar' : 'font-en';
  const habitData = useMemo(() => storageService.getHabitData(), [books]);
  const habitStreak = habitData.streak;
  const totalTodayMinutes = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return Math.floor(books.reduce((acc, b) => {
      if (b.lastReadDate === today) return acc + (b.dailyTimeSeconds || 0);
      return acc;
    }, 0) / 60);
  }, [books]);
  const activeBookStats = useMemo(() => {
    if (filteredBooks.length > 0 && filteredBooks[activeBookIndex]) {
      const book = filteredBooks[activeBookIndex];
      return {
        minutes: Math.floor(book.timeSpentSeconds / 60),
        stars: book.stars || 0
      };
    }
    return { minutes: 0, stars: 0 };
  }, [filteredBooks, activeBookIndex]);
  const booksCount = books.length;
  const insights = useMemo<Insight[]>(() => {
    const list: Insight[] = [];
    const isRTL = lang === 'ar';
    const streak = habitData.streak;
    if (booksCount === 0) {
      list.push({
        text: isRTL ? 'مرحباً بك .. في منصة المحراب تؤسس وعيك وتمركز ثقافتك كل يوم' : 'Welcome to the elite.. Here we craft awareness and reshape thought.',
        icon: <Sparkles size={16} className="text-[#ff0000] drop-shadow-[0_0_8px_rgba(255,0,0,0.6)]" />,
        color: 'border-[#ff0000]/40 bg-[#ff0000]/10 backdrop-blur-md shadow-[0_10px_30px_rgba(255,0,0,0.1)]',
        isShining: true
      });
      list.push({
        text: isRTL ? 'تابع تطور زادك الفكري والثقافي بإحصائيات دقيقة وراقب تطورك كل لحظة' : 'The 3% Rule: Slight daily improvement puts you at the top within a year.',
        icon: <Zap size={16} className="text-emerald-400" />,
        color: 'border-emerald-500/30 bg-emerald-500/5',
        isShining: false
      });
      list.push({
        text: isRTL ? 'اقتلع نفسك من دوامات التشتت والتفاهة، وزاحم كوكبة القُراء وطلاب العلم' : '"Reading is a ticket to elevate from the common to the elite." — Start now.',
        icon: <BrainCircuit size={16} className="text-purple-400" />,
        color: 'border-purple-500/20 bg-purple-500/5',
        isShining: true
      });
      list.push({
        text: isRTL ? 'قاعدة الـ 3%: كرر وردك الفكري كل يوم والتزم به في صروح العلم ' : 'The act of reading is not just information, it is a daily exercise for the wisdom muscle.',
        icon: <BookOpen size={16} className="text-blue-400" />,
        color: 'border-blue-500/20 bg-blue-500/5',
        isShining: false
      });
      list.push({
        text: isRTL ? 'اضغط على (+) لتضع أول لبنة في صرح ثقافتك السامقة.' : 'Click (+) to lay the first brick in the monument of your great culture.',
        icon: <Plus size={18} className="text-white animate-pulse" />,
        color: 'border-white/20 bg-white/5 shadow-xl',
        isShining: true
      });
      return list;
    }
    if (totalTodayMinutes < 2) {
      list.push({
        text: isRTL ? 'تنبيه: السلسلة في خطر! تحتاج جلسة إنقاذ (دقيقتان) الآن.' : 'Streak at risk! You need a 2-min Rescue Session now.',
        icon: <Zap size={14} className="text-orange-500 animate-pulse" />,
        color: 'border-orange-500/30 bg-orange-500/5'
      });
    } else if (totalTodayMinutes < 15) {
      list.push({
        text: isRTL ? `تم الإنقاذ! اقرأ ${15 - totalTodayMinutes} دقائق إضافية للتقدم في مسار الـ 40 يوماً.` : `Rescue complete! Read ${15 - totalTodayMinutes} more mins to advance the 40-day path.`,
        icon: <Check size={14} className="text-emerald-500" />,
        color: 'border-emerald-500/30 bg-emerald-500/5'
      });
    }
    let phaseName = '';
    let phaseColor = '';
    if (streak <= 10) {
      phaseName = isRTL ? 'مرحلة المقاومة' : 'Resistance Phase';
      phaseColor = 'text-red-500';
    } else if (streak <= 21) {
      phaseName = isRTL ? 'مرحلة التثبيت' : 'Installation Phase';
      phaseColor = 'text-orange-500';
    } else {
      phaseName = isRTL ? 'مرحلة الانصهار' : 'Integration Phase';
      phaseColor = 'text-emerald-500';
    }
    list.push({
      text: isRTL ? `أنت في ${phaseName} (اليوم ${streak}/40)` : `You are in ${phaseName} (Day ${streak}/40)`,
      icon: <BrainCircuit size={14} className={phaseColor} />,
      color: 'border-white/10 bg-white/5'
    });
    if (habitData.shields < 3) {
      const daysLeft = 7 - habitData.consecutiveFullDays;
      list.push({
        text: isRTL ? `اقرأ 15 دقيقة لمدة ${daysLeft} أيام إضافية للحصول على درع جديد.` : `Read 15 mins for ${daysLeft} more days to earn a new shield.`,
        icon: <ShieldCheck size={14} className="text-emerald-400" />,
        color: 'border-emerald-400/20 bg-emerald-400/5'
      });
    }
    if (habitData.shields > 0) {
      list.push({
        text: isRTL ? `لديك ${habitData.shields} دروع. سيتم استخدامها تلقائياً إذا فاتك يوم.` : `You have ${habitData.shields} shields. They're used automatically if you miss a day.`,
        icon: <ShieldCheck size={14} className="text-blue-500" />,
        color: 'border-blue-500/30 bg-blue-500/5'
      });
    }
    if (booksCount > 0) {
      list.push({
        text: isRTL ? `محرابك يحتوي الآن على ${booksCount} كتاباً.` : `Your sanctuary now holds ${booksCount} volumes.`,
        icon: <Library size={14} className="text-purple-400" />,
        color: 'border-purple-400/20 bg-purple-400/5'
      });
    }
    const totalSeconds = books.reduce((acc, b) => acc + b.timeSpentSeconds, 0);
    const totalHours = (totalSeconds / 3600).toFixed(1);
    if (parseFloat(totalHours) > 0) {
      list.push({
        text: isRTL ? `إجمالي وقت الحكمة المتراكم: ${totalHours} ساعة.` : `Total wisdom accumulated: ${totalHours} hours.`,
        icon: <Clock size={14} className="text-yellow-400" />,
        color: 'border-yellow-400/20 bg-yellow-400/5'
      });
    }
    list.push({
      text: isRTL ? 'الاستمرارية هي مفتاح المعرفة العميقة.' : 'Consistency is the key to deep knowledge.',
      icon: <Sparkles size={14} className="text-white/40" />,
      color: 'border-white/5 bg-white/[0.02]'
    });
    return list;
  }, [habitData, totalTodayMinutes, lang, booksCount, books]);
  useEffect(() => {
    if (insights.length <= 1) return;
    const timer = setInterval(() => {
      setActiveInsightIndex(prev => (prev + 1) % insights.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [insights]);
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setIsExtracting(true);
      setPendingCoverUrl(null);
      setNewBookTitle(file.name.replace(/\.[^/.]+$/, ""));
      try {
        const arrayBuffer = await file.arrayBuffer();
        setPendingFileData(arrayBuffer);
        setIsExtracting(false);
        // توليد الغلاف في الخلفية بينما المستخدم يكتب العنوان والمؤلف
        const bufferForCover = arrayBuffer.slice(0);
        (async () => {
          try {
            const coverUrl = await pdfStorage.generateCoverFromPDF(bufferForCover);
            setPendingCoverUrl(coverUrl);
          } catch {
            // سيُستخدم placeholder عند الإضافة — لا شيء يتعطل
          }
        })();
      } catch (err) {
        alert("Error loading PDF");
        setIsExtracting(false);
      }
    }
  };
  const handleAddBook = async () => {
    if (!newBookTitle || !pendingFileData) return;
    setIsExtracting(true);
    try {
      const bookId = Math.random().toString(36).substr(2, 9);
      // حفظ الـ PDF في IDB
      const bufferForStorage = pendingFileData.slice(0);
      await pdfStorage.saveFile(bookId, bufferForStorage);
      // الغلاف: إما جاهز من الخلفية، أو placeholder إذا لم يكتمل بعد
      const coverUrl = pendingCoverUrl || generateStyledCover(bookId, newBookTitle);
      await pdfStorage.saveCover(bookId, coverUrl);
      const newBook: Book = {
        id: bookId, shelfId: activeShelfId, title: newBookTitle,
        author: newBookAuthor || (lang === 'ar' ? 'مؤلف مجهول' : 'Unknown Scribe'),
        cover: coverUrl,
        content: "[VISUAL_PDF_MODE]", timeSpentSeconds: 0, dailyTimeSeconds: 0,
        lastReadDate: new Date().toISOString().split('T')[0], stars: 0,
        addedAt: Date.now(), lastPage: 0, annotations: []
      };
      const updated = [newBook, ...books];
      setBooks(updated);
      storageService.saveBooks(updated);
      setNewBookTitle(''); setNewBookAuthor(''); setPendingFileData(null); setPendingCoverUrl(null); setIsAddingBook(false);
    } catch (err) {
      console.error('Book addition failed:', err);
      alert(lang === 'ar' ? 'حدث خطأ أثناء رفع الكتاب. حاول مجدداً.' : 'Error uploading book. Please try again.');
    } finally {
      setIsExtracting(false);
    }
  };
  const handleAddShelf = () => {
    if (!newShelfName) return;
    const newShelf: ShelfData = { id: Math.random().toString(36).substr(2, 9), name: newShelfName, color: '#ff0000' };
    const updated = [...shelves, newShelf];
    setShelves(updated);
    storageService.saveShelves(updated);
    setNewShelfName(''); setIsAddingShelf(false);
  };
  const handleDeleteShelf = (e: React.MouseEvent, shelf: ShelfData) => {
    e.stopPropagation();
    if (shelf.id === 'default') return;
    setShelfToDelete(shelf);
    setDeleteShelfConfirmInput('');
  };
  const confirmDeleteShelf = () => {
    if (!shelfToDelete || deleteShelfConfirmInput !== (lang === 'ar' ? 'امسح الرف' : 'DELETE SHELF')) return;
    const shelfId = shelfToDelete.id;
    const updatedShelves = shelves.filter(s => s.id !== shelfId);
    setShelves(updatedShelves);
    storageService.saveShelves(updatedShelves);
    // حذف الكتب مع الرف — لا نقل للرف الافتراضي
    const booksToDelete = books.filter(b => b.shelfId === shelfId);
    booksToDelete.forEach(b => pdfStorage.deleteFile(b.id).catch(() => {}));
    const updatedBooks = books.filter(b => b.shelfId !== shelfId);
    setBooks(updatedBooks);
    storageService.saveBooks(updatedBooks);
    if (activeShelfId === shelfId) setActiveShelfId('default');
    setShelfToDelete(null);
  };
  const [shelfToDelete, setShelfToDelete] = useState<ShelfData | null>(null);
  const [deleteShelfConfirmInput, setDeleteShelfConfirmInput] = useState('');
  const handleReaderBack = useCallback(() => {
    // Immediately refresh books from storage so Dashboard + main shelf reflect latest reading data
    const freshBooks = storageService.getBooks();
    setBooks(freshBooks);
    setView(ViewState.SHELF);
    setTimeout(() => {
      setSelectedBook(null);
      setIsUiVisible(true);
      // Second refresh to capture any final sync delta from Reader unmount
      setBooks(storageService.getBooks());
    }, 350);
  }, []);
  const handleStatsUpdate = useCallback((starReached?: number | null) => {
    // Real-time omni-sync: immediately pull fresh data from storage into React state
    // This ensures Dashboard stats, Today's Focus, and Book Mins are always current
    setBooks(storageService.getBooks());
    if (starReached) setCelebrationStar(starReached);
  }, []);
  const handleCelebrationComplete = useCallback(() => setCelebrationStar(null), []);
  // ── TOAST NOTIFICATION SYSTEM ──
  const showToast = useCallback((text: string, type: 'success' | 'error', detail?: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage({ text, detail, type });
    triggerHaptic();
    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 4500);
  }, []);
  // ── PREMIUM LOADING OVERLAY HELPERS ──
  const startLoadingOverlay = useCallback((title: string, mode: 'book' | 'shelf' = 'book') => {
    setLoadingOverlayTitle(title);
    setLoadingOverlayMode(mode);
    setLoadingProgress(0);
    setShowLoadingOverlay(true);
    if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
    let progress = 0;
    loadingIntervalRef.current = setInterval(() => {
      progress += Math.random() * 8 + 2;
      if (progress > 92) progress = 92;
      setLoadingProgress(progress);
    }, 400);
  }, []);
  const stopLoadingOverlay = useCallback(() => {
    if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
    setLoadingProgress(100);
    setTimeout(() => {
      setShowLoadingOverlay(false);
      setLoadingProgress(0);
    }, 600);
  }, []);
  const handleExportShelf = useCallback(async () => {
    if (!shelfToExport || !exportUserName.trim() || !exportShelfName.trim()) {
      return;
    }
    
    setIsExportingShelf(true);
    startLoadingOverlay(t.loadingShelfExportTitle, 'shelf');
    try {
      const { uri, filename } = await communityService.exportShelf(
        { ...shelfToExport, name: exportShelfName.trim() },
        books,
        exportUserName
      );
      
      await communityService.downloadFile(uri, filename, lang);
      
      setShowExportModal(false);
      setExportUserName('');
      setExportShelfName('');
      setShelfToExport(null);
    } catch (error) {
      console.error('Export failed:', error);
      showToast(lang === 'ar' ? '✗ فشل التصدير' : '✗ Export failed', 'error');
    } finally {
      setIsExportingShelf(false);
      stopLoadingOverlay();
    }
  }, [shelfToExport, exportUserName, exportShelfName, books, lang, showToast, startLoadingOverlay, stopLoadingOverlay, t]);
  // ── SHARE SHELF HANDLER — with unified loading overlay ──
  const handleShareShelf = useCallback(async (shelf: ShelfData) => {
    const userName = exportUserName.trim() || localStorage.getItem('sanctuary_user_name') || (lang === 'ar' ? 'مستخدم المحراب' : 'Sanctuary User');
    const shelfNameInContext = exportShelfName.trim() || shelf.name;
    setIsSharingShelf(true);
    startLoadingOverlay(t.loadingShelfShareTitle, 'shelf');
    try {
      const result = await communityService.shareShelf({ ...shelf, name: shelfNameInContext }, books, userName, lang);
      
      if (result.success) {
        if (result.method === 'clipboard') {
          showToast(
            lang === 'ar' ? '✓ تم نسخ البيانات للحافظة' : '✓ Data copied to clipboard',
            'success',
            lang === 'ar' ? 'يمكنك لصقها في أي تطبيق' : 'Paste it in any app'
          );
        } else {
          showToast(lang === 'ar' ? '✓ تمت المشاركة بنجاح!' : '✓ Shared successfully!', 'success');
        }
      }
    } catch (error) {
      console.error('Share failed:', error);
      showToast(lang === 'ar' ? '✗ فشلت المشاركة' : '✗ Share failed', 'error');
    } finally {
      setIsSharingShelf(false);
      stopLoadingOverlay();
    }
  }, [exportUserName, books, lang, showToast, startLoadingOverlay, stopLoadingOverlay, t, exportShelfName]);
  const handleImportShelf = useCallback(async (file: File) => {
    setIsImportingShelf(true);
    startLoadingOverlay(lang === 'ar' ? t.loadingImportTitle : t.loadingImportTitle);
    try {
      const { shelf, books: importedBooks } = await communityService.importFile(file);
      
      const updatedShelves = [...shelves, shelf];
      setShelves(updatedShelves);
      storageService.saveShelves(updatedShelves);
      
      const updatedBooks = [...books, ...importedBooks];
      setBooks(updatedBooks);
      storageService.saveBooks(updatedBooks);
      
      setActiveShelfId(shelf.id);
      setActiveBookIndex(0);
      
      showToast(
        `✓ ${t.importSuccess}`,
        'success',
        `${shelf.name} — ${importedBooks.length} ${t.booksImported}`
      );
      
      setShowImportModal(false);
    } catch (error: any) {
      console.error('Import failed:', error);
      if (error?.message?.includes('FORMAT_MISMATCH:SINGLE_BOOK')) {
        setFormatMismatchMessage(lang === 'ar' ? t.formatMismatchBookAsShelf : t.formatMismatchBookAsShelf);
        setShowFormatMismatch(true);
      } else {
        showToast(`✗ ${t.importFailed}`, 'error');
      }
    } finally {
      setIsImportingShelf(false);
      stopLoadingOverlay();
    }
  }, [shelves, books, t, showToast, lang, startLoadingOverlay, stopLoadingOverlay]);
  // ── SINGLE BOOK EXPORT (Share via native sheet) — with loading overlay ──
  const handleExportBook = useCallback(async (book: Book) => {
    startLoadingOverlay(t.loadingExportTitle, 'book');
    try {
      await communityService.shareBook(book, lang);
    } catch (error) {
      console.error('Book export failed:', error);
      showToast(lang === 'ar' ? '✗ فشل تصدير الكتاب' : '✗ Book export failed', 'error');
    } finally {
      stopLoadingOverlay();
    }
  }, [lang, showToast, startLoadingOverlay, stopLoadingOverlay, t]);
  // ── SINGLE BOOK IMPORT — with shelf selection workflow ──
  const handleBookFileSelected = useCallback(async (file: File) => {
    // Validate format before proceeding
    try {
      const formatInfo = await communityService.validateFileFormat(file);
      if (!formatInfo.isBook && formatInfo.isShelf) {
        setFormatMismatchMessage(lang === 'ar' ? t.formatMismatchShelfAsBook : t.formatMismatchShelfAsBook);
        setShowFormatMismatch(true);
        return;
      }
      if (!formatInfo.isBook && !formatInfo.isShelf) {
        showToast(lang === 'ar' ? t.unsupportedFormat : t.unsupportedFormat, 'error');
        return;
      }
    } catch {}
    
    setPendingBookImportFile(file);
    setBookImportTargetShelfId(activeShelfId);
    setBookImportMode('existing');
    setBookImportNewShelfName('');
    setShowBookImportShelfSelect(true);
    setShowImportModal(false);
  }, [lang, t, activeShelfId, showToast]);
  const handleConfirmBookImport = useCallback(async () => {
    if (!pendingBookImportFile) return;
    
    let targetShelfId = bookImportTargetShelfId;
    
    // Create new shelf if selected
    if (bookImportMode === 'new' && bookImportNewShelfName.trim()) {
      const newShelf: ShelfData = {
        id: Math.random().toString(36).substr(2, 9),
        name: bookImportNewShelfName.trim(),
        color: '#ff0000'
      };
      const updatedShelves = [...shelves, newShelf];
      setShelves(updatedShelves);
      storageService.saveShelves(updatedShelves);
      targetShelfId = newShelf.id;
    }
    
    setShowBookImportShelfSelect(false);
    setIsImportingShelf(true);
    startLoadingOverlay(lang === 'ar' ? t.loadingImportTitle : t.loadingImportTitle);
    
    try {
      const importedBook = await communityService.importBook(pendingBookImportFile, targetShelfId);
      const updatedBooks = [importedBook, ...books];
      setBooks(updatedBooks);
      storageService.saveBooks(updatedBooks);
      setActiveShelfId(targetShelfId);
      setActiveBookIndex(0);
      showToast(
        lang === 'ar' ? `✓ تم استيراد "${importedBook.title}"` : `✓ Imported "${importedBook.title}"`,
        'success'
      );
    } catch (error: any) {
      console.error('Book import failed:', error);
      if (error?.message?.includes('FORMAT_MISMATCH:SHELF')) {
        setFormatMismatchMessage(lang === 'ar' ? t.formatMismatchShelfAsBook : t.formatMismatchShelfAsBook);
        setShowFormatMismatch(true);
      } else {
        showToast(lang === 'ar' ? '✗ فشل استيراد الكتاب' : '✗ Book import failed', 'error');
      }
    } finally {
      setIsImportingShelf(false);
      stopLoadingOverlay();
      setPendingBookImportFile(null);
    }
  }, [pendingBookImportFile, bookImportTargetShelfId, bookImportMode, bookImportNewShelfName, shelves, books, lang, t, showToast, startLoadingOverlay, stopLoadingOverlay]);
  return (
    <Layout lang={lang}>
      <SystemNotificationManager 
        lang={lang} 
        notifLang={(localStorage.getItem('sanctuary_notif_lang') as Language) || lang} 
        books={books} 
      />
      <div className={`flex flex-col h-screen-safe overflow-hidden select-none ${fontClass}`}>
        <div className="ambient-bg" />
        <AnimatePresence>
          {isSidebarOpen && view === ViewState.SHELF && (
            <MotionDiv key="sidebar-container" className="fixed inset-0 z-[8000] pointer-events-none">
              <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSidebarOpen(false)} className="absolute inset-0 bg-black/98 backdrop-blur-2xl pointer-events-auto" />
              <MotionAside
                initial={{ x: lang === 'ar' ? '100%' : '-100%' }} animate={{ x: 0 }} exit={{ x: lang === 'ar' ? '100%' : '-100%' }} transition={{ type: 'spring', damping: 30, stiffness: 250 }}
                className={`absolute top-0 bottom-0 ${lang === 'ar' ? 'right-0' : 'left-0'} w-[82vw] md:w-80 bg-[#050c05] border-none flex flex-col shadow-2xl overflow-hidden pointer-events-auto`}
              >
                <div className="p-8 flex items-center justify-between border-b border-white/5 shrink-0 relative z-10">
                  <div className="flex items-center gap-4">
                    <img src="/icon.png" className="w-10 h-10 rounded-2xl object-cover shadow-[0_0_25px_rgba(255,0,0,0.5)] border border-red-600/30" alt="Sanctuary Logo" />
                    <div className="flex flex-col">
                      <h2 className="text-xl font-black uppercase tracking-tighter text-white">{t.menu}</h2>
                      <span className="text-[8px] font-black text-red-600 uppercase tracking-[0.2em]">{lang === 'ar' ? 'بوابة النخبة' : 'Elite Access'}</span>
                    </div>
                  </div>
                  <button onClick={() => setIsSidebarOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 text-white/40 hover:text-white transition-all"><X size={20} /></button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scroll p-6 space-y-10 relative z-10">
                  {/* Dynamic Stats Header */}
                  <div className="bg-gradient-to-br from-red-600/20 to-transparent p-6 rounded-[2rem] border border-red-600/20">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase text-red-600 tracking-widest mb-1">{lang === 'ar' ? 'الرتبة المعرفية' : 'Cognitive Rank'}</span>
                        <h3 className="text-xl font-black text-white italic">
                          {activeBookStats.stars > 50 ? (lang === 'ar' ? 'حكيم المحراب' : 'Sanctuary Sage') :
                            activeBookStats.stars > 20 ? (lang === 'ar' ? 'باحث مفكر' : 'Deep Scholar') :
                              (lang === 'ar' ? 'طالب متميز' : 'Elite Student')}
                        </h3>
                      </div>
                      <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                        <Star size={20} className="text-red-600 fill-red-600" />
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, (activeBookStats.stars % 10) * 10)}%` }} className="h-full bg-red-600 shadow-[0_0_10px_rgba(255,0,0,0.5)]" />
                    </div>
                    <div className="flex justify-between mt-2 text-[8px] font-black uppercase text-white/40 tracking-widest">
                      <span>{lang === 'ar' ? 'المستوى الحالي' : 'Current Level'}</span>
                      <span>{10 - (activeBookStats.stars % 10)} {lang === 'ar' ? 'نجوم للمستوى التالي' : 'stars to next level'}</span>
                    </div>
                  </div>
                  <button onClick={() => { setView(ViewState.DASHBOARD); setIsSidebarOpen(false); }} className="w-full flex items-center gap-4 p-4 rounded-[1.5rem] bg-white/[0.03] border border-white/5 hover:bg-white/10 transition-all group">
                    <div className="p-3 rounded-xl bg-red-600/20 group-hover:bg-red-600/40"><LayoutDashboard size={20} className="text-red-600 group-hover:text-white" /></div>
                    <div className="flex flex-col items-start"><span className="text-[11px] font-black uppercase tracking-widest group-hover:text-white">{t.dashboard}</span><span className="text-[7.5px] uppercase font-black opacity-30 group-hover:text-white/60">{t.cognitiveMetrics}</span></div>
                  </button>
                  <a
                    href={`mailto:oussama.sebrou@gmail.com?subject=${encodeURIComponent(t.contactSubject)}&body=${encodeURIComponent(t.contactBody)}`}
                    className="w-full flex items-center gap-4 p-4 rounded-[1.5rem] bg-white/[0.03] border border-white/5 hover:bg-emerald-600/20 transition-all group no-underline"
                  >
                    <div className="p-3 rounded-xl bg-emerald-600/20 group-hover:bg-emerald-600/40"><Send size={20} className="text-emerald-500 group-hover:text-white" /></div>
                    <div className="flex flex-col items-start">
                      <span className="text-[11px] font-black uppercase tracking-widest group-hover:text-white text-white">{t.contactUs}</span>
                      <span className="text-[7.5px] uppercase font-black opacity-30 group-hover:text-white/60">{lang === 'ar' ? 'اتصل بنا' : 'Contact Us'}</span>
                    </div>
                  </a>
                  <section className="space-y-4">
                    <div className="flex items-center gap-3 opacity-30 px-2"><Globe size={14} className="text-white" /><span className="text-[10px] font-black uppercase text-white tracking-[0.2em]">{t.language}</span></div>
                    <div className="grid grid-cols-2 gap-3">{(['ar', 'en'] as const).map((l: Language) => (
                      <button key={l} onClick={() => { setLang(l); setIsSidebarOpen(false); }} className={`p-4 rounded-2xl border transition-all flex flex-col gap-2 items-center justify-center ${lang === l ? 'bg-white text-black border-white shadow-xl scale-105' : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'}`}>
                        <span className="text-[10px] font-black uppercase tracking-widest">{l === 'ar' ? 'العربية' : 'English'}</span>{lang === l && <Check size={12} className="text-red-600" />}
                      </button>))}
                    </div>
                  </section>
                  <section className="space-y-4">
                    <div className="flex items-center justify-between px-2"><div className="flex items-center gap-3 opacity-30"><Library size={12} className="text-white" /><span className="text-[10px] font-black uppercase text-white tracking-[0.2em]">{t.collections}</span></div><button onClick={() => setIsAddingShelf(true)} className="w-8 h-8 flex items-center justify-center bg-red-600 rounded-full text-white shadow-lg active:scale-90 transition-transform"><Plus size={14} /></button></div>
                    <div className="flex flex-col gap-2.5 custom-scroll max-h-[40vh] overflow-y-auto">{shelves.map((shelf: ShelfData) => (
                      <div key={shelf.id} className={`group w-full px-5 py-4 rounded-xl border transition-all text-[10px] font-black uppercase flex items-center justify-between cursor-pointer ${activeShelfId === shelf.id ? 'bg-white/5 border-white/20 text-white shadow-lg' : 'bg-transparent border-transparent text-white/10 hover:text-white/30'}`}>
                        <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => { setActiveShelfId(shelf.id); setActiveBookIndex(0); setView(ViewState.SHELF); setIsSidebarOpen(false); }}><div className={`w-1.5 h-1.5 rounded-full ${activeShelfId === shelf.id ? 'bg-red-600 shadow-[0_0_10px_rgba(255,0,0,0.8)]' : 'bg-white/10'}`} />{shelf.name}</div>
                        <div className="flex items-center gap-0.5">
                          {/* DIRECT SHARE ICON - GREEN */}
                          <button 
                            onClick={(e: any) => { e.stopPropagation(); handleShareShelf(shelf); }} 
                            className="p-1.5 text-white/30 hover:text-emerald-400 transition-colors active:scale-90" 
                            title={lang === 'ar' ? 'مشاركة مباشرة' : 'Direct Share'}
                          >
                            <Share2 size={12} />
                          </button>
                          
                          {/* DIRECT DOWNLOAD ICON - BLUE */}
                          <button 
                            onClick={(e: any) => { 
                              e.stopPropagation(); 
                              setShelfToExport(shelf); 
                              setExportShelfName(shelf.name);
                              setExportUserName(localStorage.getItem('sanctuary_user_name') || (lang === 'ar' ? 'مستخدم المحراب' : 'Sanctuary User'));
                              setShowExportModal(true); 
                            }} 
                            className="p-1.5 text-white/30 hover:text-blue-500 transition-colors active:scale-90" 
                            title={lang === 'ar' ? 'تنزيل للجهاز' : 'Download to Device'}
                          >
                            <Download size={12} />
                          </button>
                          {shelf.id !== 'default' && (
                            <button 
                              onClick={(e: any) => handleDeleteShelf(e, shelf)} 
                              className="p-1.5 text-white/30 hover:text-red-500 transition-colors active:scale-90" 
                              title="Delete"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>))}
                    </div>
                  </section>
                  <section className="space-y-3 border-t border-white/5 pt-6">
                    <div className="flex items-center gap-3 opacity-30 px-2"><Share2 size={12} className="text-white" /><span className="text-[10px] font-black uppercase text-white tracking-[0.2em]">{t.communityShelf}</span></div>
                    
                    {/* SHARE ACTIVE SHELF — Direct native share */}
                    <button 
                      onClick={() => {
                        const activeShelf = shelves.find(s => s.id === activeShelfId);
                        if (activeShelf) handleShareShelf(activeShelf);
                      }}
                      disabled={isSharingShelf}
                      className="w-full flex items-center gap-4 p-4 rounded-[1.5rem] bg-white/[0.03] border border-white/5 hover:bg-emerald-600/20 transition-all group"
                    >
                      <div className="p-3 rounded-xl bg-emerald-600/20 group-hover:bg-emerald-600/40">
                        {isSharingShelf 
                          ? <Loader2 size={20} className="text-emerald-500 animate-spin" />
                          : <Share2 size={20} className="text-emerald-500 group-hover:text-white" />
                        }
                      </div>
                      <div className="flex flex-col items-start">
                        <span className="text-[11px] font-black uppercase tracking-widest group-hover:text-white">{t.shareShelf}</span>
                        <span className="text-[7.5px] uppercase font-black opacity-30 group-hover:text-white/60">{t.shareDescription}</span>
                      </div>
                    </button>
                    {/* IMPORT SHELF — From JSON file */}
                    <button onClick={() => setShowImportModal(true)} className="w-full flex items-center gap-4 p-4 rounded-[1.5rem] bg-white/[0.03] border border-white/5 hover:bg-blue-600/20 transition-all group">
                      <div className="p-3 rounded-xl bg-blue-600/20 group-hover:bg-blue-600/40"><FileJson size={20} className="text-blue-500 group-hover:text-white" /></div>
                      <div className="flex flex-col items-start"><span className="text-[11px] font-black uppercase tracking-widest group-hover:text-white">{t.importShelf}</span><span className="text-[7.5px] uppercase font-black opacity-30 group-hover:text-white/60">{t.importDescription}</span></div>
                    </button>
                  </section>
                </div>
              </MotionAside>
            </MotionDiv>
          )}
        </AnimatePresence>
        {view === ViewState.SHELF && (
          <div className="fixed top-0 left-0 right-0 z-[9000] px-4 py-3 md:px-6 md:py-4 pointer-events-none flex justify-between items-center">
            <MotionDiv animate={{ opacity: isUiVisible ? 1 : 0.2 }} className="pointer-events-auto">
              <button onClick={() => { setIsSidebarOpen(true); triggerHaptic(); }} className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-xl bg-black/60 backdrop-blur-xl border border-white/[0.08] hover:bg-red-600/90 hover:border-red-600/50 transition-all active:scale-90"><Menu size={16} className="text-white/80" /></button>
            </MotionDiv>
            <div className="flex flex-row items-center gap-1.5 md:gap-2 pointer-events-auto">
              <button onClick={() => { setLang(lang === 'ar' ? 'en' : 'ar'); triggerHaptic(); }} className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center bg-black/60 backdrop-blur-xl border border-white/[0.08] rounded-xl text-white/50 hover:text-white hover:border-white/20 transition-all active:scale-90"><span className="text-[9px] font-black tracking-tight">{lang === 'ar' ? 'EN' : 'AR'}</span></button>
              <MotionDiv animate={{ opacity: isUiVisible ? 1 : 0, x: isUiVisible ? 0 : 10 }} className="flex items-center gap-2 bg-black/60 backdrop-blur-xl px-3 py-1.5 rounded-xl border border-red-500/20">
                <Clock size={12} className="text-red-500" /><div className="flex flex-col leading-none"><span className="text-[6px] font-bold uppercase opacity-40 tracking-widest">{t.todayFocus}</span><span className="text-[10px] font-black text-white">{totalTodayMinutes}<span className="text-[7px] ml-0.5 opacity-40">{lang === 'ar' ? 'د' : 'm'}</span></span></div>
              </MotionDiv>
              <button onClick={() => { setIsAddingBook(true); triggerHaptic(); }} className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-white/90 text-black flex items-center justify-center hover:bg-red-600 hover:text-white transition-all active:scale-90"><Plus size={16} /></button>
            </div>
          </div>
        )}
        <div className="flex-1 relative overflow-hidden flex flex-col">
          <AnimatePresence>
            {view === ViewState.SHELF && (
              <MotionDiv key="shelf-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex-1 flex flex-col relative pt-16">
                <header className="flex flex-col items-center text-center px-4">
                  <h1 className={`text-[clamp(2.5rem,8vw,5rem)] font-black text-white uppercase tracking-tighter big-title-white leading-none ${lang === 'ar' ? 'font-ar text-center' : 'font-en'}`}>{t.title}</h1>
                  <p className="text-[10px] md:text-sm font-black mt-3 text-red-600 uppercase tracking-[0.2em] italic drop-shadow-[0_0_10px_rgba(255,0,0,0.8)] px-4">
                    {t.philosophy}
                  </p>
                  <div className="mt-4 flex items-center gap-8 bg-black/40 px-6 py-2 rounded-full border border-white/5 backdrop-blur-3xl">
                    <div className="flex flex-col items-center"><Clock size={12} className="text-red-600" /><span className="text-xs font-black text-white">{activeBookStats.minutes}m</span><span className="text-[6px] font-black uppercase opacity-20">Book Mins</span></div>
                    <div className="w-[1px] h-4 bg-white/10" />
                    <div className="flex flex-col items-center"><Star size={12} className="text-red-600 fill-red-600" /><span className="text-xs font-black text-white">{activeBookStats.stars}</span><span className="text-[6px] font-black uppercase opacity-20">Stars</span></div>
                  </div>
                </header>
                <div className="h-16 flex items-center justify-center pointer-events-none relative z-50">
                  <AnimatePresence mode="wait">
                    {showInsights && insights.length > 0 && (
                      <MotionDiv key={activeInsightIndex} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} className={`flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 backdrop-blur-3xl shadow-2xl pointer-events-auto ${insights[activeInsightIndex % insights.length].color}`}>
                        <div className="shrink-0">{insights[activeInsightIndex % insights.length].icon}</div>
                        <span className="text-[9px] font-black uppercase text-white tracking-widest">{insights[activeInsightIndex % insights.length].text}</span>
                      </MotionDiv>
                    )}
                  </AnimatePresence>
                </div>
                <div className="flex-1 flex flex-col justify-center items-center pb-12 relative px-2">
                  {/* CINEMATIC SHELF AURA */}
                  <div className="absolute inset-x-10 inset-y-20 rounded-[5rem] pointer-events-none -z-10">
                    <div className="absolute inset-0 bg-red-600/8 blur-[60px] opacity-30" />
                    <div className="absolute inset-0 shadow-[0_0_120px_40px_rgba(255,0,0,0.12)] opacity-50" />
                  </div>
                  
                  <Shelf 
                    books={filteredBooks} 
                    lang={lang} 
                    activeIndex={activeBookIndex} 
                    onActiveIndexChange={setActiveBookIndex} 
                    onSelectBook={(b: Book) => { setSelectedBook(b); setView(ViewState.READER); }} 
                    onAddBook={() => setIsAddingBook(true)} 
                    onAddShelf={() => setIsAddingShelf(true)}
                    onDeleteBook={(b: Book) => setBookToDelete(b)}
                    onExportBook={handleExportBook}
                  />
                  {shelves.length > 1 && (
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 flex flex-col gap-4 opacity-50 transition-all">
                      {shelves.map((s: ShelfData) => (
                        <div key={s.id} className={`w-1 rounded-full transition-all duration-500 ${s.id === activeShelfId ? 'bg-red-600 h-12 shadow-[0_0_20px_rgba(255,0,0,0.8)]' : 'bg-white/10 h-5'}`} />
                      ))}
                    </div>
                  )}
                </div>
              </MotionDiv>
            )}
            {view === ViewState.DASHBOARD && <MotionDiv key="dashboard" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20, zIndex: -1 }} transition={{ duration: 0.2 }} className="fixed inset-0 z-[4000] bg-[#020502] overflow-y-auto pointer-events-auto"><Dashboard books={books} shelves={shelves} lang={lang} onBack={() => setView(ViewState.SHELF)} /></MotionDiv>}
            {view === ViewState.READER && selectedBook && <MotionDiv key="reader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, zIndex: -1 }} transition={{ duration: 0.2 }} className="fixed inset-0 z-[5000] bg-black pointer-events-auto"><Reader key={selectedBook.id} book={selectedBook} lang={lang} onBack={handleReaderBack} onStatsUpdate={handleStatsUpdate} /></MotionDiv>}
          </AnimatePresence>
        {/* EXPORT SHELF MODAL */}
        <AnimatePresence>
          {showExportModal && (
            <MotionDiv key="export-modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[11000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <MotionDiv initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-[2rem] p-8 max-w-md w-full shadow-2xl">
                <h3 className="text-2xl font-black text-white mb-6 flex items-center gap-3"><Download className="text-blue-500" size={24} /> {lang === 'ar' ? 'تنزيل الرف' : 'Download Shelf'}</h3>
                
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="text-xs font-black uppercase text-white/60 tracking-widest block mb-2">{lang === 'ar' ? 'اسم الرف للتنزيل' : 'Shelf Name for Download'}</label>
                    <input 
                      type="text" 
                      value={exportShelfName} 
                      onChange={(e) => setExportShelfName(e.target.value)} 
                      placeholder={lang === 'ar' ? 'أدخل اسم الرف' : 'Enter shelf name'}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-blue-500 transition-all font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-black uppercase text-white/60 tracking-widest block mb-2">{t.userName}</label>
                    <input 
                      type="text" 
                      value={exportUserName} 
                      onChange={(e) => setExportUserName(e.target.value)} 
                      placeholder={t.enterUserName}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-blue-500 transition-all"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => { setShowExportModal(false); setShelfToExport(null); }} className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-black uppercase text-xs hover:bg-white/10 transition-all">{t.discard}</button>
                  <button 
                    onClick={handleExportShelf} 
                    disabled={isExportingShelf || !exportUserName.trim() || !exportShelfName.trim()} 
                    className="flex-[2] px-4 py-3 rounded-xl bg-blue-600 text-white font-black uppercase text-xs hover:bg-blue-700 shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
                  >
                    {isExportingShelf ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                    {isExportingShelf ? (lang === 'ar' ? 'جاري التحميل...' : 'Downloading...') : (lang === 'ar' ? 'تنزيل الآن' : 'Download Now')}
                  </button>
                </div>
              </MotionDiv>
            </MotionDiv>
          )}
        </AnimatePresence>
        {/* IMPORT MODAL — Dual Option: Shelves vs Single Book */}
        <AnimatePresence>
          {showImportModal && (
            <MotionDiv key="import-modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[11000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <MotionDiv initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-[2rem] p-8 max-w-md w-full shadow-2xl">
                <h3 className="text-2xl font-black text-white mb-6 flex items-center gap-3"><Upload className="text-blue-500" size={24} /> {lang === 'ar' ? 'استيراد المحتوى' : 'Import Content'}</h3>
                
                <div className="space-y-4 mb-6">
                  {/* OPTION 1: Import Shelves */}
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-blue-500/30 transition-all group">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2.5 rounded-xl bg-blue-600/20 group-hover:bg-blue-600/30 transition-colors">
                        <Library size={18} className="text-blue-400" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[11px] font-black uppercase tracking-widest text-white">{t.importShelves}</span>
                        <span className="text-[8px] font-bold text-white/40 uppercase tracking-wider">{t.importShelfDescription}</span>
                      </div>
                    </div>
                    <button onClick={() => importFileInputRef.current?.click()} className="w-full px-4 py-3 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 font-black uppercase text-xs hover:bg-blue-600/40 transition-all flex items-center justify-center gap-2">
                      <Upload size={14} />
                      {t.selectFile}
                    </button>
                    <input 
                      ref={importFileInputRef} 
                      type="file" 
                      accept=".zip,.json" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImportShelf(file);
                        if (e.target) e.target.value = '';
                      }} 
                      className="hidden" 
                    />
                  </div>
                  {/* Separator */}
                  <div className="flex items-center gap-4 px-2">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-[8px] font-black uppercase tracking-[0.3em] text-white/20">{lang === 'ar' ? 'أو' : 'OR'}</span>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>
                  {/* OPTION 2: Import Single Book */}
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-emerald-500/30 transition-all group">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2.5 rounded-xl bg-emerald-600/20 group-hover:bg-emerald-600/30 transition-colors">
                        <BookMarked size={18} className="text-emerald-400" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[11px] font-black uppercase tracking-widest text-white">{t.importSingleBook}</span>
                        <span className="text-[8px] font-bold text-white/40 uppercase tracking-wider">{t.importBookFileDescription}</span>
                      </div>
                    </div>
                    <button onClick={() => importBookFileInputRef.current?.click()} className="w-full px-4 py-3 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 font-black uppercase text-xs hover:bg-emerald-600/40 transition-all flex items-center justify-center gap-2">
                      <Upload size={14} />
                      {t.selectBookFile}
                    </button>
                    <input 
                      ref={importBookFileInputRef} 
                      type="file" 
                      accept=".mbook,.sbook,.zip" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleBookFileSelected(file);
                        if (e.target) e.target.value = '';
                      }} 
                      className="hidden" 
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowImportModal(false)} className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-black uppercase text-xs hover:bg-white/10 transition-all">{t.discard}</button>
                </div>
              </MotionDiv>
            </MotionDiv>
          )}
        </AnimatePresence>
        {/* BOOK IMPORT — SHELF SELECTION MODAL */}
        <AnimatePresence>
          {showBookImportShelfSelect && (
            <MotionDiv key="book-shelf-select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[11500] flex items-center justify-center p-4 bg-black/85 backdrop-blur-lg">
              <MotionDiv initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} transition={{ type: 'spring', damping: 25 }} className="bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-[2rem] p-8 max-w-md w-full shadow-2xl">
                <h3 className="text-xl font-black text-white mb-2 flex items-center gap-3">
                  <BookMarked className="text-emerald-400" size={22} />
                  {t.selectShelfForBook}
                </h3>
                <p className="text-[9px] font-bold text-white/40 uppercase tracking-wider mb-6">
                  {pendingBookImportFile?.name}
                </p>
                
                {/* Toggle: Existing vs New */}
                <div className="grid grid-cols-2 gap-2 mb-5">
                  <button
                    onClick={() => setBookImportMode('existing')}
                    className={`px-4 py-3 rounded-xl font-black uppercase text-[9px] tracking-widest transition-all border ${
                      bookImportMode === 'existing'
                        ? 'bg-emerald-600/30 border-emerald-500/50 text-emerald-300 shadow-lg shadow-emerald-500/10'
                        : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
                    }`}
                  >
                    {t.addToExistingShelf}
                  </button>
                  <button
                    onClick={() => setBookImportMode('new')}
                    className={`px-4 py-3 rounded-xl font-black uppercase text-[9px] tracking-widest transition-all border ${
                      bookImportMode === 'new'
                        ? 'bg-blue-600/30 border-blue-500/50 text-blue-300 shadow-lg shadow-blue-500/10'
                        : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
                    }`}
                  >
                    {t.createNewShelfForBook}
                  </button>
                </div>
                {bookImportMode === 'existing' ? (
                  <div className="space-y-2 max-h-[35vh] overflow-y-auto custom-scroll mb-6 pr-1">
                    {shelves.map((shelf: ShelfData) => (
                      <button
                        key={shelf.id}
                        onClick={() => setBookImportTargetShelfId(shelf.id)}
                        className={`w-full px-4 py-3.5 rounded-xl border text-left transition-all flex items-center gap-3 ${
                          bookImportTargetShelfId === shelf.id
                            ? 'bg-emerald-600/20 border-emerald-500/40 shadow-lg shadow-emerald-500/5'
                            : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06]'
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full shrink-0 ${
                          bookImportTargetShelfId === shelf.id
                            ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                            : 'bg-white/10'
                        }`} />
                        <span className={`text-[10px] font-black uppercase tracking-widest ${
                          bookImportTargetShelfId === shelf.id ? 'text-white' : 'text-white/40'
                        }`}>
                          {shelf.name}
                        </span>
                        {bookImportTargetShelfId === shelf.id && (
                          <Check size={14} className="text-emerald-400 ml-auto" />
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mb-6">
                    <input
                      autoFocus
                      type="text"
                      value={bookImportNewShelfName}
                      onChange={(e) => setBookImportNewShelfName(e.target.value)}
                      placeholder={t.newShelfNamePlaceholder}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-white/30 focus:outline-none focus:border-blue-500 transition-all font-bold text-sm"
                    />
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowBookImportShelfSelect(false); setPendingBookImportFile(null); }}
                    className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-black uppercase text-xs hover:bg-white/10 transition-all"
                  >
                    {t.discard}
                  </button>
                  <button
                    onClick={handleConfirmBookImport}
                    disabled={
                      (bookImportMode === 'existing' && !bookImportTargetShelfId) ||
                      (bookImportMode === 'new' && !bookImportNewShelfName.trim())
                    }
                    className="flex-[2] px-4 py-3 rounded-xl bg-emerald-600 text-white font-black uppercase text-xs hover:bg-emerald-700 shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all disabled:opacity-30 flex items-center justify-center gap-2 active:scale-95"
                  >
                    <BookMarked size={14} />
                    {t.confirmImportBook}
                  </button>
                </div>
              </MotionDiv>
            </MotionDiv>
          )}
        </AnimatePresence>
        {/* FORMAT MISMATCH ALERT */}
        <AnimatePresence>
          {showFormatMismatch && (
            <MotionDiv key="format-mismatch" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[12500] flex items-center justify-center p-4 bg-black/80 backdrop-blur-lg">
              <MotionDiv initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.85, opacity: 0 }} transition={{ type: 'spring', damping: 22 }} className="bg-gradient-to-br from-amber-900/40 to-red-900/30 border border-amber-500/30 rounded-[2rem] p-8 max-w-sm w-full shadow-2xl text-center">
                <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-5 border border-amber-500/20">
                  <AlertTriangle size={28} className="text-amber-400" />
                </div>
                <h3 className="text-lg font-black text-white mb-3 uppercase tracking-wider">{t.formatMismatchTitle}</h3>
                <p className="text-xs text-white/60 mb-8 leading-relaxed">{formatMismatchMessage}</p>
                <button
                  onClick={() => setShowFormatMismatch(false)}
                  className="w-full px-6 py-3.5 rounded-xl bg-amber-600/30 border border-amber-500/40 text-amber-200 font-black uppercase text-[10px] tracking-widest hover:bg-amber-600/50 transition-all active:scale-95"
                >
                  {lang === 'ar' ? 'حسناً، مفهوم' : 'Understood'}
                </button>
              </MotionDiv>
            </MotionDiv>
          )}
        </AnimatePresence>
        {/* PREMIUM LOADING OVERLAY — Glassmorphism Export/Import Experience */}
        <AnimatePresence>
          {showLoadingOverlay && (
            <MotionDiv
              key="loading-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="fixed inset-0 z-[13000] flex items-center justify-center bg-black/95 backdrop-blur-3xl"
            >
              {/* Ambient animated background */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <MotionDiv
                  animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.05, 0.15, 0.05],
                  }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  className={`absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] rounded-full blur-[100px] ${loadingOverlayMode === 'shelf' ? 'bg-emerald-600/20' : 'bg-red-600/20'}`}
                />
                <MotionDiv
                  animate={{
                    scale: [1.2, 1, 1.2],
                    opacity: [0.03, 0.1, 0.03],
                  }}
                  transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                  className={`absolute bottom-1/4 left-1/3 w-[60vw] h-[60vw] rounded-full blur-[80px] ${loadingOverlayMode === 'shelf' ? 'bg-teal-500/10' : 'bg-amber-500/10'}`}
                />
              </div>
              <div className="relative flex flex-col items-center justify-center px-8 max-w-md w-full">
                {/* Animated icon */}
                <MotionDiv
                  animate={{
                    rotateY: [0, 360],
                  }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                  className="mb-8"
                  style={{ perspective: '500px' }}
                >
                  <div className={`w-20 h-20 rounded-[1.5rem] bg-gradient-to-br ${loadingOverlayMode === 'shelf' ? 'from-emerald-600/30 to-emerald-900/20 border border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.2)]' : 'from-red-600/30 to-red-900/20 border border-red-500/30 shadow-[0_0_40px_rgba(255,0,0,0.2)]'} flex items-center justify-center`}>
                    {loadingOverlayMode === 'shelf' ? <Library size={32} className="text-emerald-400" /> : <BookOpen size={32} className="text-red-400" />}
                  </div>
                </MotionDiv>
                {/* Title */}
                <MotionDiv
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <h2 className="text-xl font-black text-white uppercase tracking-[0.2em] text-center mb-3">
                    {loadingOverlayTitle}
                  </h2>
                </MotionDiv>
                {/* Progress bar */}
                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mb-8">
                  <MotionDiv
                    animate={{ width: `${loadingProgress}%` }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                    className={`h-full rounded-full ${loadingOverlayMode === 'shelf' ? 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-400 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-gradient-to-r from-red-600 via-red-500 to-amber-500 shadow-[0_0_15px_rgba(255,0,0,0.5)]'}`}
                  />
                </div>
                {/* Animated loading dots */}
                <div className="flex items-center gap-2 mb-10">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <MotionDiv
                      key={i}
                      animate={{
                        scale: [1, 1.5, 1],
                        opacity: [0.2, 0.8, 0.2],
                      }}
                      transition={{
                        duration: 1.2,
                        repeat: Infinity,
                        delay: i * 0.15,
                        ease: 'easeInOut',
                      }}
                      className={`w-1.5 h-1.5 rounded-full ${loadingOverlayMode === 'shelf' ? 'bg-emerald-500' : 'bg-red-500'}`}
                    />
                  ))}
                </div>
                {/* Arabic Community Quote — Glassmorphism card */}
                <MotionDiv
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="w-full px-6 py-5 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl"
                >
                  <div className="space-y-4">
                    <p className={`text-center leading-relaxed text-white/70 ${lang === 'ar' ? 'font-ar text-sm' : 'font-en text-xs'}`} style={{ fontFamily: lang === 'ar' ? 'Alexandria, sans-serif' : 'Montserrat, sans-serif', lineHeight: '1.8' }}>
                      {loadingOverlayMode === 'shelf' ? t.shelfCommunityQuote : t.loadingCommunityQuote}
                    </p>
                    
                    {/* Intellectual Note — Reflective subtle style */}
                    <div className="pt-4 border-t border-white/10">
                      <p className={`text-center italic opacity-40 ${lang === 'ar' ? 'font-ar text-[10px]' : 'font-en text-[9px]'}`} style={{ fontFamily: lang === 'ar' ? 'Alexandria, sans-serif' : 'Montserrat, sans-serif', lineHeight: '1.6' }}>
                        {loadingOverlayMode === 'shelf' ? t.shelfIntellectualNote : t.sharingIntellectualNote}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex justify-center">
                    <div className={`w-8 h-px bg-gradient-to-r from-transparent ${loadingOverlayMode === 'shelf' ? 'via-emerald-600/50' : 'via-red-600/50'} to-transparent`} />
                  </div>
                </MotionDiv>
                {/* Progress percentage */}
                <MotionDiv
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="mt-6"
                >
                  <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20">
                    {Math.floor(loadingProgress)}%
                  </span>
                </MotionDiv>
              </div>
            </MotionDiv>
          )}
        </AnimatePresence>
        </div>
        <AnimatePresence>
          {isAddingBook && (
            <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-black/98 backdrop-blur-3xl">
              <MotionDiv initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-[#0b140b] border border-white/5 p-8 rounded-[3rem] w-full max-w-lg relative">
                <button onClick={() => setIsAddingBook(false)} className="absolute top-6 right-6 text-white/20 hover:text-white"><X size={20} /></button>
                <h2 className="text-2xl font-black mb-8 text-white uppercase italic flex items-center gap-3"><BookOpen size={24} className="text-red-600" /> {t.newIntake}</h2>
                <div className="space-y-6">
                  <div onClick={() => !isExtracting && fileInputRef.current?.click()} className="w-full aspect-video border-2 border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center gap-4 bg-white/5 hover:border-red-600/30 transition-all cursor-pointer">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".pdf" />
                    {isExtracting ? <Loader2 size={32} className="animate-spin text-red-600" /> : <><Upload size={24} className="text-white/20" /><span className="text-[10px] uppercase font-black opacity-30 tracking-widest">{pendingFileData ? newBookTitle : t.uploadHint}</span></>}
                  </div>
                  <input type="text" value={newBookTitle} onChange={e => setNewBookTitle(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-sm font-bold text-white outline-none focus:border-red-600/50" placeholder={t.bookTitle} />
                  <input type="text" value={newBookAuthor} onChange={e => setNewBookAuthor(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-sm font-bold text-white outline-none focus:border-red-600/50" placeholder={t.author} />
                  <button onClick={handleAddBook} disabled={!newBookTitle || !pendingFileData} className="w-full bg-white text-black py-5 rounded-2xl font-black text-xs uppercase tracking-[0.4em] hover:bg-red-600 hover:text-white transition-all">{t.save}</button>
                </div>
              </MotionDiv>
            </MotionDiv>
          )}
          {isAddingShelf && (
            <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[8500] flex items-center justify-center p-6 bg-black/98 backdrop-blur-xl">
              <MotionDiv initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} className="bg-[#0b140b] border border-white/10 p-10 rounded-[3rem] w-full max-w-sm text-center shadow-4xl">
                <h3 className="text-2xl font-black text-white mb-6 uppercase italic flex items-center justify-center gap-3">
                  <Library className="text-red-600" size={24} /> {lang === 'ar' ? 'إنشاء رف' : 'New Shelf'}
                </h3>
                <input 
                  autoFocus 
                  type="text" 
                  value={newShelfName} 
                  onChange={e => setNewShelfName(e.target.value)} 
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-sm font-bold text-white outline-none mb-8 focus:border-red-600/50 transition-colors" 
                  placeholder={lang === 'ar' ? 'اسم الرف (مثلاً: الفقه)...' : 'Shelf Name...'} 
                />
                <div className="flex gap-4">
                  <button 
                    onClick={() => { setIsAddingShelf(false); setNewShelfName(''); }} 
                    className="flex-1 py-5 rounded-2xl bg-white/5 text-white/40 font-black text-[10px] uppercase tracking-widest hover:text-white"
                  >
                    {lang === 'ar' ? 'تراجع' : 'Cancel'}
                  </button>
                  <button 
                    onClick={handleAddShelf} 
                    disabled={!newShelfName.trim()}
                    className="flex-1 py-5 rounded-2xl bg-red-600 font-black text-[10px] text-white uppercase tracking-widest shadow-lg shadow-red-600/20 active:scale-95 disabled:opacity-30"
                  >
                    {lang === 'ar' ? 'إنشاء' : 'Establish'}
                  </button>
                </div>
              </MotionDiv>
            </MotionDiv>
          )}
          {bookToDelete && (
            <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[11000] flex items-center justify-center p-6 bg-black/98 backdrop-blur-3xl">
              <MotionDiv initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-[#0b140b] border border-white/10 p-10 rounded-[4rem] w-full max-w-md text-center">
                <div className="w-20 h-20 rounded-full bg-red-600/10 flex items-center justify-center mx-auto mb-6"><Trash2 className="text-red-600" size={32} /></div>
                <h2 className="text-2xl font-black text-white uppercase mb-4">{lang === 'ar' ? 'حذف الكتاب؟' : 'Delete Volume?'}</h2>
                <p className="text-xs text-white/50 mb-8 leading-relaxed uppercase">{lang === 'ar' ? `هل أنت متأكد من حذف "${bookToDelete.title}"؟` : `Are you sure you want to erase "${bookToDelete.title}"?`}</p>
                <div className="space-y-4">
                  <input type="text" value={deleteConfirmInput} onChange={(e) => setDeleteConfirmInput(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-center text-white font-black" placeholder={lang === 'ar' ? 'امسح من المحراب' : 'DELETE'} />
                  <div className="flex gap-4">
                    <button onClick={() => setBookToDelete(null)} className="flex-1 py-4 rounded-2xl bg-white/5 text-white/40 font-black uppercase text-[10px]">{lang === 'ar' ? 'تراجع' : 'Cancel'}</button>
                    <button onClick={confirmDeleteBook} disabled={deleteConfirmInput !== (lang === 'ar' ? 'امسح من المحراب' : 'DELETE')} className="flex-1 py-4 rounded-2xl bg-red-600 text-white font-black uppercase text-[10px] disabled:opacity-20">Confirm</button>
                  </div>
                </div>
              </MotionDiv>
            </MotionDiv>
          )}
          {celebrationStar && <CelebrationOverlay starCount={celebrationStar} lang={lang} onComplete={handleCelebrationComplete} />}
          {showOnboarding && <Onboarding lang={lang} onComplete={handleOnboardingComplete} />}
          {shelfToDelete && (
            <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[11000] flex items-center justify-center p-6 bg-black/98 backdrop-blur-3xl">
              <MotionDiv initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-[#0b140b] border border-white/10 p-10 rounded-[4rem] w-full max-w-md text-center">
                <div className="w-20 h-20 rounded-full bg-red-600/10 flex items-center justify-center mx-auto mb-6"><Trash2 className="text-red-600" size={32} /></div>
                <h2 className="text-2xl font-black text-white uppercase mb-4">{lang === 'ar' ? 'حذف الرف؟' : 'Dissolve Shelf?'}</h2>
                <p className="text-xs text-white/50 mb-8 leading-relaxed uppercase">{lang === 'ar' ? `هل أنت متأكد من حذف الرف "${shelfToDelete.name}"؟ سيتم حذف جميع الكتب الموجودة فيه نهائياً.` : `Are you sure you want to dissolve "${shelfToDelete.name}"? All books inside will be permanently deleted.`}</p>
                <div className="space-y-4">
                  <input type="text" value={deleteShelfConfirmInput} onChange={(e) => setDeleteShelfConfirmInput(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-center text-white font-black" placeholder={lang === 'ar' ? 'امسح الرف' : 'DELETE SHELF'} />
                  <div className="flex gap-4">
                    <button onClick={() => setShelfToDelete(null)} className="flex-1 py-4 rounded-2xl bg-white/5 text-white/40 font-black uppercase text-[10px]">{lang === 'ar' ? 'تراجع' : 'Cancel'}</button>
                    <button onClick={confirmDeleteShelf} disabled={deleteShelfConfirmInput !== (lang === 'ar' ? 'امسح الرف' : 'DELETE SHELF')} className="flex-1 py-4 rounded-2xl bg-red-600 text-white font-black uppercase text-[10px] disabled:opacity-20">{lang === 'ar' ? 'تأكيد' : 'Confirm'}</button>
                  </div>
                </div>
              </MotionDiv>
            </MotionDiv>
          )}
        </AnimatePresence>
        {/* ── GLASSMORPHISM TOAST NOTIFICATION ── */}
        <AnimatePresence>
          {toastMessage && (
            <MotionDiv
              key="toast-notification"
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className={`fixed bottom-20 left-4 right-4 z-[12000] flex items-start gap-3 px-5 py-4 rounded-2xl border backdrop-blur-2xl shadow-2xl ${
                toastMessage.type === 'success'
                  ? 'bg-emerald-900/60 border-emerald-500/30 shadow-emerald-500/10'
                  : 'bg-red-900/60 border-red-500/30 shadow-red-500/10'
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                toastMessage.type === 'success' ? 'bg-emerald-500/20' : 'bg-red-500/20'
              }`}>
                {toastMessage.type === 'success'
                  ? <Check size={16} className="text-emerald-400" />
                  : <X size={16} className="text-red-400" />
                }
              </div>
              <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                <span className="text-[11px] font-black uppercase tracking-wider text-white">{toastMessage.text}</span>
                {toastMessage.detail && (
                  <span className="text-[9px] font-bold text-white/50 truncate">{toastMessage.detail}</span>
                )}
              </div>
              <button onClick={() => setToastMessage(null)} className="text-white/30 hover:text-white shrink-0">
                <X size={14} />
              </button>
            </MotionDiv>
          )}
        </AnimatePresence>
        {view !== ViewState.READER && (
          <MotionDiv 
            initial={{ y: 50, opacity: 0 }} 
            animate={{ y: 0, opacity: isNavVisible ? 1 : 0.15 }} 
            transition={{ duration: 0.4 }}
            className="fixed bottom-6 left-0 right-0 z-[6000] flex justify-center md:hidden pointer-events-none"
            onTouchStart={() => {
              setIsNavVisible(true);
              if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);
              navTimeoutRef.current = setTimeout(() => setIsNavVisible(false), 4000);
            }}
          >
            {/* Invisible touch-proximity zone — larger than the bar */}
            <div 
              className="absolute -inset-x-0 -top-16 bottom-0 pointer-events-auto" 
              onTouchStart={() => {
                setIsNavVisible(true);
                if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);
                navTimeoutRef.current = setTimeout(() => setIsNavVisible(false), 4000);
              }}
            />
            <div className={`relative px-4 py-2 rounded-2xl bg-black/50 border backdrop-blur-xl flex items-center gap-1.5 shadow-2xl overflow-hidden pointer-events-auto transition-all duration-500 ${isNavVisible ? 'border-white/15 bg-black/60' : 'border-white/5 bg-black/20'}`}>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent pointer-events-none" />
              
              <button 
                onClick={() => { setView(ViewState.SHELF); triggerHaptic(); }} 
                className={`relative flex items-center gap-2 p-2 px-4 rounded-xl transition-all duration-500 group
                  ${view === ViewState.SHELF ? 'text-red-600' : 'text-white/20 hover:text-white/40'}`}
              >
                <Library size={16} className={`transition-all duration-500 ${view === ViewState.SHELF ? 'drop-shadow-[0_0_8px_rgba(255,0,0,0.8)]' : ''}`} />
                {view === ViewState.SHELF && (
                  <span className="text-[9px] font-black uppercase tracking-widest whitespace-nowrap">
                    {lang === 'ar' ? 'المِحْرابْ' : 'Sanctuary'}
                  </span>
                )}
                {view === ViewState.SHELF && (
                  <MotionDiv layoutId="nav-glow" className="absolute inset-0 bg-red-600/[0.06] rounded-xl -z-10" />
                )}
              </button>
              <div className="w-px h-3.5 bg-white/10" />
              <button 
                onClick={() => { setView(ViewState.DASHBOARD); triggerHaptic(); }} 
                className={`relative flex items-center gap-2 p-2 px-4 rounded-xl transition-all duration-500 group
                  ${view === ViewState.DASHBOARD ? 'text-red-600' : 'text-white/20 hover:text-white/40'}`}
              >
                <LayoutDashboard size={16} className={`transition-all duration-500 ${view === ViewState.DASHBOARD ? 'drop-shadow-[0_0_8px_rgba(255,0,0,0.8)]' : ''}`} />
                {view === ViewState.DASHBOARD && (
                  <span className="text-[9px] font-black uppercase tracking-widest whitespace-nowrap">
                    {lang === 'ar' ? 'البصيرة' : 'Insights'}
                  </span>
                )}
                {view === ViewState.DASHBOARD && (
                  <MotionDiv layoutId="nav-glow" className="absolute inset-0 bg-red-600/[0.06] rounded-xl -z-10" />
                )}
              </button>
            </div>
          </MotionDiv>
        )}
      </div>
    </Layout>
  );
};
export default App;
