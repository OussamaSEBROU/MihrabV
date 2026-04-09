
import React, { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue } from 'framer-motion';
import { Language } from '../types';
import type { Book } from '../types';
import { translations } from '../i18n/translations';
import { Upload, Trash2, Share2 } from 'lucide-react';
import { pdfStorage } from '../services/pdfStorage';

const MotionDiv = motion.div as any;

interface ShelfProps {
  books: Book[];
  lang: Language;
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onSelectBook: (book: Book) => void;
  onAddBook: () => void;
  onDeleteBook: (book: Book) => void;
  onExportBook?: (book: Book) => void;
  onAddShelf?: () => void;
}

// Cover image cache — in-memory for instant display
const coverCache = new Map<string, string>();

export const Shelf: React.FC<ShelfProps> = React.memo(({ books, lang, activeIndex, onActiveIndexChange, onSelectBook, onAddBook, onDeleteBook, onExportBook }) => {
  const t = (translations as any)[lang];
  const dragX = useMotionValue(0);
  const [dragOffset, setDragOffset] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const isSwiping = useRef(false);
  const [coverUrls, setCoverUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    return dragX.onChange((v: any) => setDragOffset(v));
  }, [dragX]);

  // Load covers from IndexedDB into memory cache (instant after first load)
  useEffect(() => {
    const loadCovers = async () => {
      const newCovers: Record<string, string> = {};
      let hasNew = false;
      
      for (const book of books) {
        // 1. Check memory cache first
        if (coverCache.has(book.id)) {
          newCovers[book.id] = coverCache.get(book.id)!;
          continue;
        }
        
        // 2. If cover is already a data URL (base64) in the book object, use it
        if (book.cover && book.cover.startsWith('data:')) {
          newCovers[book.id] = book.cover;
          coverCache.set(book.id, book.cover);
          continue;
        }

        // 3. Try to load from IndexedDB cover store
        try {
          const storedCover = await pdfStorage.getCover(book.id);
          if (storedCover) {
            newCovers[book.id] = storedCover;
            coverCache.set(book.id, storedCover);
            hasNew = true;
            continue;
          }
        } catch (e) {
          // IndexedDB might not have covers for old books
        }

        // 4. CRITICAL FIX: Regenerate from stored PDF if cover is missing
        try {
          const pdfData = await pdfStorage.getFile(book.id);
          if (pdfData) {
            const cover = await pdfStorage.generateCoverFromPDF(pdfData);
            if (cover) {
              await pdfStorage.saveCover(book.id, cover);
              newCovers[book.id] = cover;
              coverCache.set(book.id, cover);
              hasNew = true;
              continue;
            }
          }
        } catch (e) {
          // PDF might not exist
        }

        // 5. Ultimate fallback: use whatever cover URL is stored (external)
        if (book.cover) {
          newCovers[book.id] = book.cover;
        }
      }
      
      if (Object.keys(newCovers).length > 0) {
        setCoverUrls(prev => ({ ...prev, ...newCovers }));
      }
    };

    if (books.length > 0) {
      loadCovers();
    }
  }, [books]);

  // Ultra-fast touch swipe handler
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    isSwiping.current = false;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
      isSwiping.current = true;
      setDragOffset(dx);
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const elapsed = Date.now() - touchStartRef.current.time;
    const velocity = Math.abs(dx) / elapsed;

    const SWIPE_THRESHOLD = 20;
    const VELOCITY_THRESHOLD = 0.3;

    if (isSwiping.current && (Math.abs(dx) > SWIPE_THRESHOLD || velocity > VELOCITY_THRESHOLD)) {
      if (dx < 0 && activeIndex < books.length - 1) {
        onActiveIndexChange(activeIndex + 1);
      } else if (dx > 0 && activeIndex > 0) {
        onActiveIndexChange(activeIndex - 1);
      }
    }

    touchStartRef.current = null;
    isSwiping.current = false;
    setDragOffset(0);
    dragX.set(0);
  }, [activeIndex, books.length, onActiveIndexChange, dragX]);

  const handleBookTap = useCallback((book: Book, isCenter: boolean) => {
    if (!isCenter || isSwiping.current) return;
    onSelectBook(book);
  }, [onSelectBook]);

  const visibleBooks = useMemo(() => {
    return books.map((book, index) => {
      const diff = index - activeIndex;
      if (Math.abs(diff) > 2) return null;
      return { book, index, diff };
    }).filter(Boolean) as { book: Book; index: number; diff: number }[];
  }, [books, activeIndex]);

  if (books.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] px-8">
        <MotionDiv animate={{ opacity: 1, scale: 1 }} className="text-center w-full max-w-sm">
          <button onClick={onAddBook} className="group relative w-full aspect-[1/1.2] border-2 border-dashed border-white/10 rounded-[3rem] bg-white/[0.02] hover:border-[#ff0000]/40 transition-all flex flex-col items-center justify-center gap-8 overflow-hidden shadow-2xl btn-press">
            <div className="absolute inset-0 bg-gradient-to-br from-[#ff0000]/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:scale-110 group-hover:bg-[#ff0000]/10 group-hover:border-[#ff0000]/30 transition-all shrink-0">
               <Upload size={40} className="text-white/20 group-hover:text-[#ff0000]" />
            </div>
            <div className="flex flex-col items-center gap-3 px-6">
              <span className="text-[12px] font-black tracking-[0.4em] uppercase text-white/40 group-hover:text-[#ff0000] transition-colors">{t.addToSanctuary}</span>
              <p className="text-[10px] text-white/10 group-hover:text-white/30 uppercase font-bold text-center leading-relaxed">{lang === 'ar' ? 'قم برفع ملف PDF للبدء في بناء محرابك الخاص' : 'Upload a PDF to begin building your private sanctuary'}</p>
            </div>
          </button>
        </MotionDiv>
      </div>
    );
  }

  return (
    <div className="relative w-full flex-1 flex flex-col items-center justify-start overflow-visible pt-0 px-4">

      {/* Touch swipe zone */}
      <div 
        ref={containerRef}
        className="relative w-full flex items-center justify-center perspective-1000"
        style={{ 
          touchAction: 'pan-y',
          height: 'min(52vh, 440px)',
          marginTop: '-12px'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <AnimatePresence mode="popLayout">
          {visibleBooks.map(({ book, index, diff }) => {
            const isCenter = diff === 0;
            const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
            const itemSpacing = isMobile ? 140 : 250;
            const offsetX = diff * itemSpacing + (dragOffset * 1.8);
            const rotateY = diff * (isMobile ? -20 : -28) + (dragOffset / 15);
            const scaleVal = isCenter ? (1.06 - Math.abs(dragOffset) / 900) : (0.74 + Math.abs(dragOffset) / 1400);
            const opacityVal = isCenter ? (1 - Math.abs(dragOffset) / 600) : (0.60 + Math.abs(dragOffset) / 1000);

            // Get cover URL from state (high-res from IndexedDB) or fallback to book.cover
            const coverUrl = coverUrls[book.id] || book.cover;

            return (
              <MotionDiv
                key={book.id}
                initial={false}
                animate={{ 
                  opacity: opacityVal, 
                  x: offsetX, 
                  scale: scaleVal, 
                  rotateY: rotateY,
                  zIndex: isCenter ? 120 : (20 - Math.abs(diff)),
                  filter: isCenter && Math.abs(dragOffset) < 30 
                    ? 'brightness(1.1) contrast(1.05)' 
                    : `brightness(0.45) saturate(0.5) blur(${Math.abs(diff) * 1.5}px)` 
                }}
                exit={{ opacity: 0, scale: 0.2, x: diff > 0 ? 500 : -500 }}
                transition={{ type: 'spring', stiffness: 600, damping: 35, mass: 0.8 }}
                className={`absolute book-card-3d ${isCenter ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'}`}
                style={{
                  width: isMobile ? '190px' : '270px',
                  height: isMobile ? '285px' : '400px',
                }}
                onClick={() => handleBookTap(book, isCenter)}
              >
                {/* ====== ELEGANT RED GLOW — 2 CLEAN LAYERS ====== */}
                {isCenter && (
                  <>
                    <div className="absolute pointer-events-none" style={{
                      inset: '-16px',
                      zIndex: -10,
                      borderRadius: '2rem',
                      background: 'radial-gradient(ellipse at center, rgba(255,0,0,0.18) 0%, rgba(255,0,0,0.06) 50%, transparent 80%)',
                      filter: 'blur(18px)',
                      animation: 'glowBreathe 3.5s ease-in-out infinite',
                    }} />

                    <div className="absolute pointer-events-none" style={{
                      inset: '-2.5px',
                      zIndex: -3,
                      borderRadius: '1.65rem',
                      border: '2px solid rgba(255, 20, 20, 0.65)',
                      boxShadow: '0 0 10px 2px rgba(255,0,0,0.20), 0 0 25px 6px rgba(255,0,0,0.08)',
                      animation: 'redBorderPulse 3s ease-in-out infinite',
                    }} />
                  </>
                )}

                {/* ====== CARD BODY: CINEMATIC IMAGE + 3D SHADOW ====== */}
                <div className={`relative w-full h-full rounded-[1.5rem] overflow-hidden transition-all duration-500`}
                  style={{
                    boxShadow: isCenter 
                      ? '0 30px 60px -12px rgba(0,0,0,0.95), 0 15px 30px -6px rgba(0,0,0,0.70), 0 0 0 1px rgba(255,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.06)' 
                      : '0 15px 35px -10px rgba(0,0,0,0.65), 0 8px 16px -6px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.03)',
                    transform: isCenter ? 'translateZ(15px)' : 'translateZ(-8px)',
                  }}
                >
                  {!isCenter && (
                    <div className="absolute left-0 top-0 bottom-0 w-[6px] z-10 pointer-events-none" style={{
                      background: 'linear-gradient(to right, rgba(0,0,0,0.5), rgba(0,0,0,0.15), transparent)',
                    }} />
                  )}

                  {/* HIGH-QUALITY Cover Image */}
                  {coverUrl ? (
                    <img 
                      src={coverUrl} 
                      alt={book.title} 
                      className="w-full h-full object-cover select-none pointer-events-none" 
                      loading={isCenter ? "eager" : "lazy"}
                      decoding="async"
                      style={{ imageRendering: 'auto' }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#1a0000] via-[#0d0d0d] to-[#1a0000] flex items-center justify-center">
                      <div className="w-14 h-14 rounded-full border border-red-600/20 flex items-center justify-center">
                        <div className="w-7 h-1 bg-red-600/30 rounded-full" />
                      </div>
                    </div>
                  )}
                  
                  {/* Delete button */}
                  {isCenter && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteBook(book);
                      }}
                      className="absolute top-3 right-3 p-2 rounded-full bg-black/60 backdrop-blur-sm text-white/50 hover:text-[#ff0000] hover:bg-black/80 transition-all shadow-lg btn-press z-20 border border-white/10"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}

                  {/* Export/Share book icon — faint by default, visible on interaction */}
                  {isCenter && onExportBook && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onExportBook(book);
                      }}
                      className="absolute bottom-3 left-3 p-2.5 rounded-full bg-black/40 backdrop-blur-sm text-white/20 hover:text-emerald-400 hover:bg-black/70 active:text-emerald-300 active:scale-90 transition-all duration-300 shadow-lg z-20 border border-white/[0.06] hover:border-emerald-500/30"
                      title={lang === 'ar' ? 'تصدير الكتاب' : 'Export Book'}
                    >
                      <Share2 size={12} />
                    </button>
                  )}

                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
                  <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-white/[0.04] to-transparent pointer-events-none" />
                </div>
              </MotionDiv>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Book title + author below card */}
      {books.length > 0 && books[activeIndex] && (
        <div className="text-center mt-2.5 mb-1 px-4">
          <p className="text-[13px] md:text-xl font-calibri font-bold text-white/95 truncate tracking-tight">
            {books[activeIndex].title}
          </p>
          <p className="text-[9px] md:text-[11px] font-black text-red-600/80 uppercase tracking-[0.15em] mt-0.5">
            {books[activeIndex].author?.trim() ? books[activeIndex].author : (lang === 'ar' ? 'مؤلف مجهول' : 'Unknown Author')}
          </p>
        </div>
      )}

      {/* Pagination dots */}
      {books.length > 1 && (
        <div className="flex items-center justify-center gap-2 mt-1 mb-1">
          {books.map((_, i) => (
            <button
              key={i}
              onClick={() => onActiveIndexChange(i)}
              className={`swipe-dot h-1.5 rounded-full transition-all duration-500
                ${i === activeIndex ? 'active w-7 bg-red-600 shadow-[0_0_10px_rgba(255,0,0,0.8)]' : 'w-1.5 bg-white/10'}`}
            />
          ))}
        </div>
      )}

      <div className="mb-2">
        <p className="text-[9px] font-black uppercase tracking-[0.4em] opacity-10">
          {lang === 'ar' ? 'اسحب للتصفح • المس للقراءة' : 'Swipe to Browse • Tap to Read'}
        </p>
      </div>
    </div>
  );
});
