import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Language, Book, ChatMessage, Annotation } from '../types';
import { translations } from '../i18n/translations';
import { storageService } from '../services/storageService';
import { pdfStorage } from '../services/pdfStorage';
import { 
  ChevronLeft, ChevronRight, Maximize2, Highlighter, 
  PenTool, MessageSquare, Trash2, X, MousePointer2, 
  ListOrdered, Volume2, CloudLightning, Waves, 
  Moon, Bird, Flame, VolumeX, Sparkles, Search, Droplets,
  Edit3, Sun, Clock, BoxSelect, Palette, Check, LayoutGrid,
  FileAudio, Users, Send, MessageCircle, Share2, Zap,
  Mic, MicOff, Hand, Ghost, BookOpen,
  PhoneOff, Video, VideoOff, MoreVertical, Monitor, ArrowLeft,
  Underline
} from 'lucide-react';
import { Socket } from 'socket.io-client';
import Peer from 'simple-peer';
declare const pdfjsLib: any;
// const MotionDiv = motion.div as any;
const MotionHeader = motion.header as any;
interface ReaderProps {
  book: Book;
  lang: Language;
  userId?: string;
  onBack: () => void;
  onStatsUpdate: (starReached?: number | null) => void;
  socket?: Socket | null;
  roomId?: string | null;
  roomData?: any;
}
interface RoomMember {
  id: string;
  name: string;
  currentPage: number;
  isMicActive?: boolean;
  isHandRaised?: boolean;
}
interface VoiceSignalPayload {
  from: string;
  signal: any;
}
interface MemberMovedPayload {
  id: string;
  page: number;
}
interface MemberCursorPayload {
  id: string;
  cursor: { x: number, y: number };
}
interface NewReactionPayload {
  id: string;
  reaction: string;
}
interface MicStatusPayload {
  id: string;
  active: boolean;
}
interface HandRaisedPayload {
  id: string;
  raised: boolean;
}
type Tool = 'view' | 'highlight' | 'underline' | 'box' | 'note';
const COLORS = [
  { name: 'Yellow', hex: '#fbbf24' },
  { name: 'Red', hex: '#ef4444' },
  { name: 'Green', hex: '#22c55e' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Purple', hex: '#a855f7' }
];
const SOUNDS = [
  { id: 'none', icon: VolumeX, url: '' },
  { id: 'rain', icon: CloudLightning, url: '/assets/sounds/rain.mp3' },
  { id: 'sea', icon: Waves, url: '/assets/sounds/sea.mp3' },
  { id: 'river', icon: Droplets, url: '/assets/sounds/river.mp3' },
  { id: 'night', icon: Moon, url: '/assets/sounds/night.mp3' },
  { id: 'birds', icon: Bird, url: '/assets/sounds/birds.mp3' },
  { id: 'fire', icon: Flame, url: '/assets/sounds/fire.mp3' }
];
const TOOL_ICONS = {
  view: MousePointer2,
  highlight: Highlighter,
  underline: Underline,
  box: BoxSelect,
  note: MessageSquare
};
const Reader: React.FC<ReaderProps> = ({ book, lang, userId, onBack, onStatsUpdate, socket, roomId, roomData }) => {
  const [isZenMode, setIsZenMode] = useState(false);
  const [isNightMode, setIsNightMode] = useState(false);
  const [showControls, setShowControls] = useState(true);
  
  // ── OPTIMIZATION: Index-based Record for high performance ──
  const [pages, setPages] = useState<Record<number, string>>({});
  
  const [currentPage, setCurrentPage] = useState(book.lastPage || 0);
  const [isLoading, setIsLoading] = useState(false);
  const [totalPages, setTotalPages] = useState(0);
  
  const [activeTool, setActiveTool] = useState<Tool>('view');
  const [activeColor, setActiveColor] = useState(COLORS[0].hex);
  const [annotations, setAnnotations] = useState<Annotation[]>(book.annotations || []);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentRect, setCurrentRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  
  const [editingAnnoId, setEditingAnnoId] = useState<string | null>(null);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isGoToPageOpen, setIsGoToPageOpen] = useState(false);
  const [isSoundPickerOpen, setIsSoundPickerOpen] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isThumbnailsOpen, setIsThumbnailsOpen] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [pdfRequestSent, setPdfRequestSent] = useState(false);
  const [activeSoundId, setActiveSoundId] = useState('none');
  const [volume, setVolume] = useState(0.5);
  const [customSoundName, setCustomSoundName] = useState('');
  const [targetPageInput, setTargetPageInput] = useState('');
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [zoomScale, setZoomScale] = useState(1);
  const [isPinching, setIsPinching] = useState(false);
  const [direction, setDirection] = useState(0); 
  const [thumbCache, setThumbCache] = useState<Record<number, string>>({});
  const [thumbRange, setThumbRange] = useState({ start: 0, end: 20 });
  const thumbInitialScrollDone = useRef(false);
  const pdfDocRef = useRef<any>(null);
  const PAGE_CACHE_MAX = 8;
  const [isFlashcardMode, setIsFlashcardMode] = useState(false);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [members, setMembers] = useState<any[]>([]);
  const [memberCursors, setMemberCursors] = useState<Record<string, { x: number, y: number, name: string }>>({});
  const [activeReactions, setActiveReactions] = useState<any[]>([]);
  const [isMembersListOpen, setIsMembersListOpen] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const [isSpeakerActive, setIsSpeakerActive] = useState(true);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteScreenStream, setRemoteScreenStream] = useState<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const [showCopySuccess, setShowCopySuccess] = useState(false);
  const [speakingMembers, setSpeakingMembers] = useState<Set<string>>(new Set());
  const [peers, setPeers] = useState<Record<string, Peer.Instance>>({});
  const streamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Record<string, Peer.Instance>>({});
  const isAdmin = socket && roomData?.adminId === userId;
  
  const initialPinchDistance = useRef<number | null>(null);
  const initialScaleOnPinch = useRef<number>(1);
  const timerRef = useRef<number | null>(null);
  const sessionSecondsRef = useRef<number>(0);
  const lastSyncedSecondsRef = useRef<number>(0);
  const onStatsUpdateRef = useRef(onStatsUpdate);
  const onBackRef = useRef(onBack);
  onStatsUpdateRef.current = onStatsUpdate;
  onBackRef.current = onBack;
  const pageRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const controlsTimeoutRef = useRef<number | null>(null);
  const enqueueWindowRef = useRef<any>(null);
  const pageReadyRef = useRef(false);
  const t = translations[lang];
  const isRTL = lang === 'ar';
  const fontClass = isRTL ? 'font-ar' : 'font-en';
  useEffect(() => {
    const syncDelta = () => {
      const total = sessionSecondsRef.current;
      const delta = total - lastSyncedSecondsRef.current;
      if (delta > 0) {
        const result = storageService.updateBookStats(book.id, delta);
        lastSyncedSecondsRef.current = total;
        onStatsUpdateRef.current(result.starReached);
      }
    };
    const startTimer = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = window.setInterval(() => {
        if (document.visibilityState === 'visible' && pageReadyRef.current) {
          setSessionSeconds(prev => {
            const next = prev + 1;
            sessionSecondsRef.current = next;
            if (next % 30 === 0) syncDelta();
            return next;
          });
        }
      }, 1000);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        startTimer();
      } else {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        syncDelta();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    startTimer();
    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      syncDelta();
    };
  }, [book.id]);
  const formatSessionTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs > 0 ? hrs + ':' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  useEffect(() => {
    if (!socket || !roomId) return;
    socket.on("pdf-requested", async ({ bookId, requesterId }: { bookId: string, requesterId: string }) => {
      if (isAdmin && bookId === book.id) {
        const data = await pdfStorage.getFile(bookId);
        if (data) socket.emit("send-pdf", { roomId, bookId, requesterId, pdfData: data });
      }
    });
    socket.on("pdf-received", async ({ bookId, pdfData }: { bookId: string, pdfData: ArrayBuffer }) => {
      if (bookId === book.id) {
        await pdfStorage.saveFile(bookId, pdfData);
        setPdfRequestSent(false);
      }
    });
    const setupVoice = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        streamRef.current = stream;
        stream.getAudioTracks().forEach(track => track.enabled = isMicActive);
      } catch (err) { console.error("Voice error", err); }
    };
    setupVoice();
    socket.on("room-updated", (data: { members: RoomMember[] }) => {
      setMembers(data.members);
      if (streamRef.current) {
        data.members.forEach((member: RoomMember) => {
          if (member.id !== userId && !peersRef.current[member.id]) createPeer(member.id, streamRef.current!);
        });
      }
    });
    socket.on("voice-signal", ({ from, signal }: VoiceSignalPayload) => {
      const peer = peersRef.current[from];
      if (peer) peer.signal(signal);
      else if (streamRef.current) addPeer(signal, from, streamRef.current!);
    });
    const createPeer = (userToSignal: string, stream: MediaStream) => {
      const combinedStream = new MediaStream([...stream.getTracks()]);
      if (screenStreamRef.current) screenStreamRef.current.getTracks().forEach(track => combinedStream.addTrack(track));
      const peer = new Peer({ initiator: true, trickle: false, stream: combinedStream });
      peer.on("signal", (signal: any) => socket.emit("voice-signal", { signal, to: userToSignal, from: userId }));
      peer.on("stream", (stream: MediaStream) => {
        if (stream.getAudioTracks().length > 0) {
          const audio = document.createElement("audio");
          audio.srcObject = stream; audio.autoplay = true; audio.id = `audio-${userToSignal}`;
          document.body.appendChild(audio);
        }
      });
      peersRef.current[userToSignal] = peer;
      setPeers(prev => ({ ...prev, [userToSignal]: peer }));
    };
    const addPeer = (incomingSignal: any, callerId: string, stream: MediaStream) => {
      const combinedStream = new MediaStream([...stream.getTracks()]);
      const peer = new Peer({ initiator: false, trickle: false, stream: combinedStream });
      peer.on("signal", (signal: any) => socket.emit("voice-signal", { signal, to: callerId, from: userId }));
      peer.on("stream", (stream: MediaStream) => {
        if (stream.getAudioTracks().length > 0) {
          const audio = document.createElement("audio");
          audio.srcObject = stream; audio.autoplay = true; audio.id = `audio-${callerId}`;
          document.body.appendChild(audio);
        }
      });
      peer.signal(incomingSignal);
      peersRef.current[callerId] = peer;
      setPeers(prev => ({ ...prev, [callerId]: peer }));
    };
    return () => {
      socket.off("pdf-requested"); socket.off("pdf-received"); socket.off("room-updated"); socket.off("voice-signal");
      Object.values(peersRef.current).forEach(peer => peer.destroy());
      peersRef.current = {};
      if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    };
  }, [socket, roomId, isAdmin, book.id, userId, isMicActive]);
  const handleUserActivity = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = window.setTimeout(() => {
      if (!isToolsOpen && !isArchiveOpen && !isGoToPageOpen && !isSoundPickerOpen && !isThumbnailsOpen && !editingAnnoId) {
        setShowControls(false);
      }
    }, 4000);
  }, [isToolsOpen, isArchiveOpen, isGoToPageOpen, isSoundPickerOpen, isThumbnailsOpen, editingAnnoId]);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePageChange(currentPage - 1);
      else if (e.key === 'ArrowRight') handlePageChange(currentPage + 1);
      else if (e.key === 'Escape') { setIsToolsOpen(false); setIsArchiveOpen(false); setIsGoToPageOpen(false); setIsSoundPickerOpen(false); setIsThumbnailsOpen(false); setEditingAnnoId(null); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, totalPages]);
  const toggleZenMode = () => {
    setIsZenMode(!isZenMode);
    if (!isZenMode) {
      setIsZenMode(true); setZoomScale(1); setIsToolsOpen(false); setIsThumbnailsOpen(false);
    }
  };
  useEffect(() => {
    const yieldToMain = (): Promise<void> =>
      typeof (scheduler as any)?.yield === 'function'
        ? (scheduler as any).yield()
        : new Promise(r => setTimeout(r, 4));
    
    const loadPdf = async () => {
      setIsLoading(true); setIsPdfLoading(true);
      try {
        let data = await pdfStorage.getFile(book.id);
        if (!data && socket && roomId && !isAdmin) {
          socket.emit("request-pdf", { roomId, bookId: book.id, requesterId: userId });
          setPdfRequestSent(true); return;
        }
        if (!data) { setIsLoading(false); setIsPdfLoading(false); return; }
        
        // ── OPTIMIZED PDF OPENING ──
        const pdf = await pdfjsLib.getDocument({ 
          data, 
          stopAtErrors: false,
          isEvalSupported: false,
          disableFontFace: false
        }).promise;
        
        const numPages = pdf.numPages; setTotalPages(numPages);
        let rendering = false; 
        const queue: number[] = [];
        let thumbRendering = false; 
        const thumbQueue: number[] = [];
        const pageSlots: Record<number, string> = {};
        const thumbSlots: Record<number, string> = {};
        pdfDocRef.current = pdf;
        
        // ── HIGH-RES PAGE RENDERER ──
        const flushQueue = async () => {
          if (rendering || queue.length === 0) return;
          rendering = true;
          while (queue.length > 0) {
            const idx = queue.shift()!;
            if (pageSlots[idx]) continue;
            try {
              const p = await pdf.getPage(idx + 1);
              const vp = p.getViewport({ scale: 2.0 }); // Sharper rendering
              const cv = document.createElement('canvas');
              cv.width = vp.width; cv.height = vp.height;
              const ctx = cv.getContext('2d', { alpha: false, desynchronized: true })!;
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, cv.width, cv.height);
              await p.render({ canvasContext: ctx, viewport: vp }).promise;
              pageSlots[idx] = cv.toDataURL('image/jpeg', 0.85);
              cv.width = 0; cv.height = 0;
              setPages(prev => ({ ...prev, [idx]: pageSlots[idx] }));
              await yieldToMain();
            } catch (e) { console.error(`[Reader] Render error page ${idx+1}`, e); }
          }
          rendering = false;
        };
        
        // ── THUMBNAIL RENDERER ──
        const flushThumbQueue = async () => {
          if (thumbRendering || thumbQueue.length === 0) return;
          thumbRendering = true;
          while (thumbQueue.length > 0) {
            const idx = thumbQueue.shift()!;
            if (thumbSlots[idx]) continue;
            try {
              const p = await pdf.getPage(idx + 1);
              const baseW = p.getViewport({ scale: 1 }).width;
              const vp = p.getViewport({ scale: 120 / baseW });
              const cv = document.createElement('canvas');
              cv.width = vp.width; cv.height = vp.height;
              const ctx = cv.getContext('2d', { alpha: false })!;
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, cv.width, cv.height);
              await p.render({ canvasContext: ctx, viewport: vp }).promise;
              thumbSlots[idx] = cv.toDataURL('image/jpeg', 0.45);
              cv.width = 0; cv.height = 0;
              setThumbCache(prev => ({ ...prev, [idx]: thumbSlots[idx] }));
              await yieldToMain();
            } catch {}
          }
          thumbRendering = false;
        };
        
        const WINDOW = 1; // Reduced window for massive PDFs
        const enqueueWindow = (center: number, isThumbnailRequest = false) => {
          // ── AGGRESSIVE MEMORY EVICTION ──
          Object.keys(pageSlots).forEach(key => {
            const idx = parseInt(key);
            if (Math.abs(idx - center) > WINDOW + 1) {
              // Explicitly nullify to help GC
              pageSlots[idx] = null as any;
              delete pageSlots[idx];
              setPages(prev => {
                const n = { ...prev };
                delete n[idx];
                return n;
              });
            }
          });
          
          const priority = [center, center + 1, center - 1, center + 2, center - 2]
            .filter(i => i >= 0 && i < numPages && !pageSlots[i]);
          for (const p of priority.reverse()) {
            if (!queue.includes(p)) queue.unshift(p);
          }
          flushQueue();
          
          if (isThumbnailRequest) {
            const start = Math.max(0, center - 5);
            const end = Math.min(numPages, center + 15);
            for (let i = start; i < end; i++) {
              if (!thumbSlots[i] && !thumbQueue.includes(i)) thumbQueue.push(i);
            }
            flushThumbQueue();
          }
        };
        (window as any).__pdfEnqueueWindow = enqueueWindow;
        enqueueWindow(currentPage);
        enqueueWindowRef.current = enqueueWindow;
        setIsLoading(false); setIsPdfLoading(false);
        pageReadyRef.current = true;
      } catch (err) {
        console.error("[Reader] PDF initialization failed", err);
        setIsLoading(false); setIsPdfLoading(false);
      }
    };
    pageReadyRef.current = false;
    loadPdf();
    return () => {
      pageReadyRef.current = false;
      if (pdfDocRef.current) { pdfDocRef.current.destroy(); pdfDocRef.current = null; }
    };
  }, [book.id, roomId, socket, pdfRequestSent, userId, isAdmin]);
  
  const handlePageChange = (newPage: number) => {
    if (newPage < 0 || newPage >= totalPages || newPage === currentPage) return;
    setDirection(newPage > currentPage ? 1 : -1);
    setCurrentPage(newPage); setZoomScale(1);
    if (socket && roomId) socket.emit("move-page", { roomId, page: newPage });
    if ((window as any).__pdfEnqueueWindow) (window as any).__pdfEnqueueWindow(newPage);
    storageService.updateBookPage(book.id, newPage);
  };
  const jumpToPage = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(targetPageInput) - 1;
    if (!isNaN(p)) handlePageChange(p);
    setIsGoToPageOpen(false); setTargetPageInput('');
  };
  const getRelativeCoords = (clientX: number, clientY: number) => {
    if (!pageRef.current) return { x: 0, y: 0 };
    const rect = pageRef.current.getBoundingClientRect();
    const rawX = ((clientX - rect.left) / rect.width) * 100;
    const rawY = ((clientY - rect.top) / rect.height) * 100;
    return { x: Math.max(0, Math.min(100, rawX)), y: Math.max(0, Math.min(100, rawY)) };
  };
  const handleTouchStart = (e: React.TouchEvent) => {
    handleUserActivity();
    if (e.touches.length === 2) {
      const dist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
      initialPinchDistance.current = dist; initialScaleOnPinch.current = zoomScale; setIsPinching(true); setIsDrawing(false); 
      return;
    }
    if (activeTool !== 'view' && e.touches.length === 1) handleStart(e.touches[0].clientX, e.touches[0].clientY);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistance.current !== null) {
      const dist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
      const newScale = (dist / initialPinchDistance.current) * initialScaleOnPinch.current;
      setZoomScale(Math.max(1, Math.min(newScale, 4))); return;
    }
    if (isDrawing && e.touches.length === 1) handleMove(e.touches[0].clientX, e.touches[0].clientY);
  };
  const handleStart = (clientX: number, clientY: number) => {
    handleUserActivity();
    if (activeTool === 'view' || isPinching) return;
    const { x, y } = getRelativeCoords(clientX, clientY);
    if (activeTool === 'note') {
      const newNote: Annotation = { id: Math.random().toString(36).substr(2, 9), type: 'note', pageIndex: currentPage, x, y, text: '', title: '', color: activeColor };
      setAnnotations(prev => [...prev, newNote]); setEditingAnnoId(newNote.id); return;
    }
    setIsDrawing(true); setStartPos({ x, y }); setCurrentRect({ x, y, w: 0, h: 0 });
  };
  const handleMove = (clientX: number, clientY: number) => {
    if (!isDrawing || isPinching) return;
    const { x: currentX, y: currentY } = getRelativeCoords(clientX, clientY);
    setCurrentRect({ x: Math.min(startPos.x, currentX), y: Math.min(startPos.y, currentY), w: Math.abs(currentX - startPos.x), h: Math.abs(currentY - startPos.y) });
  };
  const handleEnd = () => {
    if (isPinching) {
      setIsPinching(false);
      initialPinchDistance.current = null;
    }
    if (!isDrawing) return;
    if (currentRect && currentRect.w > 0.5) {
      const newAnno: Annotation = { 
        id: Math.random().toString(36).substr(2, 9), 
        type: activeTool as any, 
        pageIndex: currentPage, 
        x: currentRect.x, 
        y: currentRect.y, 
        width: currentRect.w, 
        height: activeTool === 'underline' ? 2 : currentRect.h, 
        color: activeColor, 
        text: '', title: '' 
      };
      const updated = [...annotations, newAnno];
      setAnnotations(updated); storageService.updateBookAnnotations(book.id, updated);
      setEditingAnnoId(newAnno.id);
    }
    setIsDrawing(false); setCurrentRect(null);
  };
  const currentEditingAnno = annotations.find(a => a.id === editingAnnoId);
  const updateEditingAnnotation = (updates: Partial<Annotation>) => {
    const updated = annotations.map(a => a.id === editingAnnoId ? { ...a, ...updates } : a);
    setAnnotations(updated); storageService.updateBookAnnotations(book.id, updated);
  };
  return (
    <div className={`fixed inset-0 z-[1000] bg-black flex flex-col ${fontClass} select-none overflow-hidden`} onMouseMove={handleUserActivity} onTouchStart={handleUserActivity}>
      <AnimatePresence>
        {showControls && (
          <MotionHeader key="header" initial={{ y: -100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -100, opacity: 0 }} className="fixed top-0 left-0 right-0 p-2 md:p-6 flex items-center justify-between z-[1100] bg-black/80 backdrop-blur-2xl border-b border-white/10 pointer-events-auto">
            <div className="flex items-center gap-1.5 md:gap-3">
              <button onClick={() => {
                if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
                const delta = sessionSecondsRef.current - lastSyncedSecondsRef.current;
                if (delta > 0) {
                  storageService.updateBookStats(book.id, delta);
                  lastSyncedSecondsRef.current = sessionSecondsRef.current;
                }
                onBackRef.current();
              }} className="flex items-center gap-1 px-2 py-1.5 md:px-5 md:py-2.5 bg-white/5 text-white rounded-full hover:bg-red-600/20 transition-all border border-white/10">
                <ArrowLeft size={14} className={isRTL ? "rotate-180" : ""} />
                <span className="text-[8px] md:text-xs font-black uppercase tracking-widest hidden mini:inline">{isRTL ? 'المحراب' : 'Sanctuary'}</span>
              </button>
              <button onClick={() => setIsArchiveOpen(true)} className="w-7 h-7 md:w-11 md:h-11 flex items-center justify-center bg-white/5 rounded-full text-white/40 hover:bg-white/10"><ListOrdered size={14}/></button>
              <button onClick={() => setIsNightMode(!isNightMode)} className={`w-7 h-7 md:w-11 md:h-11 flex items-center justify-center rounded-full transition-all ${isNightMode ? 'bg-red-600 text-white' : 'bg-white/5 text-white/40'}`}>{isNightMode ? <Sun size={14}/> : <Moon size={14}/>}</button>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setIsToolsOpen(!isToolsOpen)} className={`w-7 h-7 md:w-11 md:h-11 flex items-center justify-center rounded-full transition-all ${isToolsOpen ? 'bg-white text-black' : 'bg-white/5 text-white/40'}`}><Palette size={14}/></button>
              <button onClick={toggleZenMode} className={`w-7 h-7 md:w-11 md:h-11 flex items-center justify-center rounded-full border transition-all ${isZenMode ? 'bg-red-600 border-red-600 text-white' : 'bg-white/5 border-white/10 text-white/40'}`}><Maximize2 size={14}/></button>
            </div>
          </MotionHeader>
        )}
      </AnimatePresence>
      <main className="flex-1 flex items-center justify-center bg-black relative overflow-hidden" ref={containerRef}>
        <AnimatePresence>
          {isThumbnailsOpen && (
            <MotionDiv key="thumbnails" initial={{ x: -100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -100, opacity: 0 }} onAnimationComplete={() => { thumbInitialScrollDone.current = false; }} className="fixed left-0 top-0 bottom-0 w-24 md:w-32 bg-black/80 backdrop-blur-2xl z-[1500] border-r border-white/5 flex flex-col pt-24 pb-8 overflow-hidden">
              <div
                className="flex-1 overflow-y-auto no-scrollbar"
                onScroll={(e) => {
                  const el = e.currentTarget;
                  const ITEM_H = 120;
                  const s = Math.max(0, Math.floor(el.scrollTop / ITEM_H) - 4);
                  const end = Math.min(totalPages, Math.ceil((el.scrollTop + el.clientHeight) / ITEM_H) + 4);
                  if (s !== thumbRange.start || end !== thumbRange.end) setThumbRange({ start: s, end });
                  for (let i = s; i < end; i++) {
                    if (!thumbCache[i] && enqueueWindowRef.current) enqueueWindowRef.current(i, true);
                  }
                }}
                ref={(el) => {
                  if (!el || thumbInitialScrollDone.current) return;
                  thumbInitialScrollDone.current = true;
                  requestAnimationFrame(() => {
                    el.scrollTop = Math.max(0, (currentPage - 2) * 120);
                    const viewH = el.clientHeight;
                    const s = Math.max(0, currentPage - 4);
                    const end = Math.min(totalPages, currentPage + Math.ceil(viewH / 120) + 4);
                    setThumbRange({ start: s, end });
                    if (enqueueWindowRef.current) enqueueWindowRef.current(currentPage, true);
                  });
                }}
              >
                <div style={{ height: `${totalPages * 120}px`, position: 'relative' }}>
                  {Array.from({ length: Math.min(thumbRange.end, totalPages) - thumbRange.start }, (_, i) => {
                    const idx = thumbRange.start + i;
                    if (idx < 0 || idx >= totalPages) return null;
                    const thumb = thumbCache[idx] || pages[idx];
                    return (
                      <button key={idx} onClick={() => handlePageChange(idx)} className={`absolute left-0 right-0 p-2 md:p-3 transition-all ${currentPage === idx ? 'scale-110 brightness-125' : 'opacity-40 hover:opacity-100 grayscale hover:grayscale-0'}`} style={{ top: `${idx * 120}px`, height: '120px' }}>
                        <div className={`relative w-full h-full bg-white rounded-lg overflow-hidden border-2 ${currentPage === idx ? 'border-red-600 shadow-[0_0_15px_rgba(255,0,0,0.5)]' : 'border-transparent'}`}>
                          {thumb ? <img src={thumb} className="w-full h-full object-cover" alt={`Page ${idx + 1}`} /> : <div className="w-full h-full flex items-center justify-center bg-white/5"><div className="w-4 h-4 border border-white/10 border-t-red-600 rounded-full animate-spin" /></div>}
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 py-0.5 text-[7px] font-black text-white text-center">{idx + 1}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </MotionDiv>
          )}
        </AnimatePresence>
        <div className={`w-full h-full flex items-center justify-center ${isZenMode ? 'p-0' : 'p-4 md:p-12'}`} onClick={() => isZenMode && handleUserActivity()}>
          <MotionDiv 
            ref={pageRef}
            drag={activeTool === 'view' ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={(e: any, info: any) => {
              if (activeTool !== 'view' || isPinching) return;
              const threshold = 50;
              if (info.offset.x < -threshold) handlePageChange(currentPage + 1);
              else if (info.offset.x > threshold) handlePageChange(currentPage - 1);
            }}
            onMouseDown={(e:any) => handleStart(e.clientX, e.clientY)} 
            onMouseMove={(e:any) => handleMove(e.clientX, e.clientY)} 
            onMouseUp={handleEnd} 
            onTouchStart={handleTouchStart} 
            onTouchMove={handleTouchMove} 
            onTouchEnd={handleEnd} 
            animate={{ scale: zoomScale }} className={`relative shadow-[0_0_100px_rgba(0,0,0,1)] overflow-hidden touch-none ${isZenMode ? 'h-full w-full rounded-none' : 'max-h-[85vh] w-auto aspect-[1/1.41] rounded-2xl md:rounded-3xl'}`} style={{ backgroundColor: isNightMode ? '#000000' : '#ffffff', transformOrigin: 'center center' }}
          >
            <AnimatePresence mode="wait">
              <MotionDiv key={currentPage} initial={{ x: direction * (isRTL ? -40 : 40), opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: direction * (isRTL ? 40 : -40), opacity: 0 }} transition={{ duration: 0.25 }} className="w-full h-full flex items-center justify-center">
                {pages[currentPage] ? <img src={pages[currentPage]} className="w-full h-full object-contain pointer-events-none" style={{ filter: isNightMode ? 'invert(1) hue-rotate(180deg)' : 'none' }} alt={`Page ${currentPage + 1}`} /> : <div className="w-12 h-12 rounded-full border-2 border-white/5 border-t-red-600 animate-spin" />}
              </MotionDiv>
            </AnimatePresence>
            <div className="absolute inset-0 pointer-events-none">
              {annotations.filter(a => a.pageIndex === currentPage).map(anno => (
                <div key={anno.id} className="absolute pointer-events-auto cursor-pointer" onClick={() => setEditingAnnoId(anno.id)} style={{
                  left: `${anno.x}%`,
                  top: `${anno.y}%`,
                  width: anno.width ? `${anno.width}%` : '0%',
                  height: anno.type === 'underline' ? '4px' : (anno.height ? `${anno.height}%` : '0%'),
                  backgroundColor: anno.type === 'highlight' ? `${anno.color}44` : (anno.type === 'underline' ? anno.color : 'transparent'),
                  borderRadius: anno.type === 'underline' ? '2px' : undefined,
                  boxShadow: anno.type === 'underline' ? `0 0 6px ${anno.color}88` : undefined,
                  border: anno.type === 'box' ? `2px solid ${anno.color}` : 'none'
                }}>
                  {anno.type === 'note' && <div className="w-7 h-7 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-2xl border-2 border-white flex items-center justify-center" style={{ backgroundColor: anno.color }}><MessageSquare size={12} className="text-white" /></div>}
                </div>
              ))}
              {currentRect && <div className="absolute border-2 border-dashed pointer-events-none" style={{ left: `${currentRect.x}%`, top: `${currentRect.y}%`, width: `${currentRect.w}%`, height: activeTool === 'underline' ? '4px' : `${currentRect.h}%`, borderColor: activeColor, backgroundColor: activeTool === 'highlight' ? `${activeColor}22` : (activeTool === 'underline' ? activeColor : 'transparent') }} />}
            </div>
          </MotionDiv>
        </div>
      </main>
      <div className="fixed bottom-6 left-0 right-0 z-[2000] pointer-events-none px-6 flex flex-col items-center gap-4">
        <AnimatePresence>
          {showControls && (
            <MotionDiv key="bottom-controls" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="flex flex-col items-center gap-4 pointer-events-auto">
              <AnimatePresence>
                {isToolsOpen && (
                  <MotionDiv key="tools" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="bg-black/80 backdrop-blur-3xl border border-white/10 px-4 py-2 rounded-full shadow-4xl flex items-center gap-3 mb-2">
                    {(Object.keys(TOOL_ICONS) as Tool[]).map(tool => {
                      const Icon = TOOL_ICONS[tool];
                      const isActive = activeTool === tool;
                      return (
                        <div key={tool} className="relative flex items-center">
                          <button onClick={() => setActiveTool(activeTool === tool ? 'view' : tool)} className={`w-8 h-8 flex items-center justify-center rounded-full transition-all duration-300 ${isActive ? 'bg-red-600 text-white shadow-xl scale-110' : 'text-white/30 hover:bg-white/5'}`}><Icon size={14}/></button>
                          {isActive && tool !== 'view' && (
                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/95 p-1.5 rounded-full border border-white/10 shadow-2xl">
                              {COLORS.map(c => (
                                <button key={c.hex} onClick={() => setActiveColor(c.hex)} className={`w-3.5 h-3.5 rounded-full border transition-all ${activeColor === c.hex ? 'border-white scale-125 shadow-[0_0_8px_white]' : 'border-transparent opacity-60'}`} style={{ backgroundColor: c.hex }} />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </MotionDiv>
                )}
              </AnimatePresence>
              <div className="bg-red-600/10 border border-red-600/30 px-5 py-1.5 rounded-full backdrop-blur-xl flex items-center gap-2 shadow-2xl">
                 <Clock size={12} className="text-red-600 animate-pulse" />
                 <span className="text-[10px] md:text-xs font-black text-red-600 tracking-widest">{Math.floor(sessionSeconds/60)}m</span>
              </div>
              <div className="bg-black/60 backdrop-blur-3xl border border-white/10 rounded-full p-2 flex items-center gap-2 shadow-4xl">
                 <button onClick={() => setIsThumbnailsOpen(!isThumbnailsOpen)} className={`w-9 h-9 flex items-center justify-center rounded-full transition-all ${isThumbnailsOpen ? 'bg-white text-black shadow-xl' : 'text-white/40 hover:bg-white/5'}`}><LayoutGrid size={16}/></button>
                 <div className="flex items-center gap-1 bg-white/5 rounded-full px-4 py-1.5 border border-white/5">
                   <button onClick={() => handlePageChange(currentPage-1)} className="text-white/30 hover:text-white transition-colors"><ChevronLeft size={16}/></button>
                   <span className="text-[10px] font-black text-white px-2 min-w-[40px] text-center">{currentPage+1}/{totalPages}</span>
                   <button onClick={() => handlePageChange(currentPage+1)} className="text-white/30 hover:text-white transition-colors"><ChevronRight size={16}/></button>
                 </div>
                 <button onClick={() => setIsGoToPageOpen(true)} className="w-9 h-9 flex items-center justify-center rounded-full text-white/40 hover:bg-white/5 transition-colors"><Search size={16}/></button>
              </div>
            </MotionDiv>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {isArchiveOpen && (
          <MotionDiv key="archive" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[2000] bg-black/40 backdrop-blur-[40px] p-6 flex items-center justify-center pointer-events-auto">
             <MotionDiv initial={{ y: 50 }} animate={{ y: 0 }} className="w-full max-w-xl bg-[#0b140b] border border-white/10 rounded-[2.5rem] p-6 max-h-[85vh] overflow-hidden flex flex-col shadow-4xl relative">
                <div className="flex justify-between items-center mb-6 shrink-0">
                  <h2 className="text-lg font-black italic uppercase tracking-tighter text-white/60">{t.wisdomIndex}</h2>
                  <button onClick={() => setIsArchiveOpen(false)} className="hover:text-red-600 transition-colors p-1.5 bg-white/5 rounded-full"><X size={16}/></button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scroll space-y-2 pr-1">
                  {annotations.length === 0 ? <p className="text-center opacity-20 py-20 uppercase font-black tracking-widest text-xs">{t.noAnnotations}</p> : 
                    [...annotations].sort((a,b) => a.pageIndex - b.pageIndex).map(anno => (
                    <div key={anno.id} className="p-3.5 bg-white/[0.03] rounded-xl border border-white/5 hover:border-red-600/30 transition-all flex items-start justify-between gap-3">
                      <div className="cursor-pointer flex-1" onClick={() => { handlePageChange(anno.pageIndex); setIsArchiveOpen(false); }}>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: anno.color }} />
                          <span className="text-[8px] font-black text-red-600 uppercase tracking-widest">{t.page} {anno.pageIndex + 1}</span>
                        </div>
                        <h4 className="text-[10px] font-black text-white/90 truncate">{anno.title || '...'}</h4>
                      </div>
                      <button onClick={() => { setEditingAnnoId(anno.id); setIsArchiveOpen(false); }} className="p-2 text-white/20 hover:text-white transition-all rounded-lg bg-white/5"><Edit3 size={12} /></button>
                    </div>
                  ))}
                </div>
             </MotionDiv>
          </MotionDiv>
        )}
        {editingAnnoId && currentEditingAnno && (
          <MotionDiv key="editing-anno" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[4000] bg-black/60 backdrop-blur-xl flex items-center justify-center p-6 pointer-events-auto">
            <MotionDiv initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-black/40 backdrop-blur-2xl border border-white/10 p-5 rounded-[2rem] w-full max-w-[300px] shadow-5xl flex flex-col">
              <div className="flex items-center justify-between mb-4">
                 <h3 className="text-xs font-black uppercase text-white/90">{isRTL ? 'بيانات التعديل' : 'Modification Details'}</h3>
                 <button onClick={() => setEditingAnnoId(null)} className="p-1.5 rounded-full bg-white/5 text-white/30 hover:text-white"><X size={14}/></button>
              </div>
              <div className="space-y-3 flex-1 overflow-y-auto no-scrollbar pr-1">
                <input type="text" value={currentEditingAnno.title || ''} onChange={(e) => updateEditingAnnotation({ title: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-[10px] font-bold text-white outline-none focus:border-red-600/50" placeholder={isRTL ? 'عنوان التعديل...' : 'Entry Title...'} />
                <textarea value={currentEditingAnno.text || ''} onChange={(e) => updateEditingAnnotation({ text: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-[10px] font-bold text-white outline-none focus:border-red-600/50 min-h-[70px] resize-none" placeholder={isRTL ? 'ملاحظات استخلاص الحكمة...' : 'Wisdom Notes...'} />
                <div className="flex flex-wrap gap-1.5">{COLORS.map(c => (<button key={c.hex} onClick={() => updateEditingAnnotation({ color: c.hex })} className={`w-5 h-5 rounded-full border transition-all ${currentEditingAnno.color === c.hex ? 'border-white scale-110 shadow-[0_0_8px_white]' : 'border-transparent opacity-60'}`} style={{ backgroundColor: c.hex }} />))}</div>
              </div>
              <div className="flex gap-2 mt-4 pt-3 border-t border-white/5">
                <button 
                  onClick={() => { 
                    const confirmMsg = isRTL ? 'هل أنت متأكد من مسح هذه الملاحظة نهائياً؟' : 'Are you sure you want to delete this note permanently?';
                    if (window.confirm(confirmMsg)) {
                      setAnnotations(annotations.filter(a => a.id !== editingAnnoId)); 
                      setEditingAnnoId(null); 
                    }
                  }} 
                  className="w-9 h-9 bg-red-600/10 border border-red-600/20 text-red-600 rounded-lg flex items-center justify-center hover:bg-red-600 hover:text-white transition-all"
                >
                  <Trash2 size={14}/>
                </button>
                <button onClick={() => { setEditingAnnoId(null); setActiveTool('view'); }} className="flex-1 bg-white text-black py-2 rounded-lg font-black uppercase text-[8px] tracking-widest hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-2"><Check size={12}/>{isRTL ? 'حفظ بالفهرس' : 'Save to Index'}</button>
              </div>
            </MotionDiv>
          </MotionDiv>
        )}
        {isGoToPageOpen && (
          <MotionDiv key="goto-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[3000] bg-black/60 backdrop-blur-[40px] flex items-center justify-center p-6 pointer-events-auto">
            <MotionDiv initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} className="bg-[#0b140b]/95 backdrop-blur-3xl border border-white/10 p-6 rounded-[2rem] w-full max-w-[280px] shadow-[0_0_80px_rgba(255,0,0,0.1)] flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-widest text-white/80">{t.goToPage}</h3>
                <button onClick={() => { setIsGoToPageOpen(false); setTargetPageInput(''); }} className="p-1.5 rounded-full bg-white/5 text-white/30 hover:text-white transition-colors"><X size={14}/></button>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={targetPageInput}
                  onChange={(e: any) => setTargetPageInput(e.target.value)}
                  onKeyDown={(e: any) => { if (e.key === 'Enter') { e.preventDefault(); const p = parseInt(targetPageInput) - 1; if (!isNaN(p)) handlePageChange(p); setIsGoToPageOpen(false); setTargetPageInput(''); } }}
                  placeholder={`1 - ${totalPages}`}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 text-sm font-black text-white text-center outline-none focus:border-red-600/50 transition-colors placeholder:text-white/15 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  autoFocus
                />
              </div>
              <button
                onClick={() => { const p = parseInt(targetPageInput) - 1; if (!isNaN(p)) handlePageChange(p); setIsGoToPageOpen(false); setTargetPageInput(''); }}
                className="w-full bg-red-600 py-3 rounded-xl font-black uppercase text-[9px] tracking-[0.3em] text-white hover:bg-red-500 active:scale-95 transition-all shadow-xl shadow-red-600/20 flex items-center justify-center gap-2"
              >
                <Search size={12}/>
                {t.jump}
              </button>
              <p className="text-[8px] text-white/15 text-center font-bold uppercase tracking-widest">{isRTL ? `صفحة ${currentPage + 1} من ${totalPages}` : `Page ${currentPage + 1} of ${totalPages}`}</p>
            </MotionDiv>
          </MotionDiv>
        )}
      </AnimatePresence>
    </div>
  );
};
export default Reader;
