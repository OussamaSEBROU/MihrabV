import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Language } from '../types';
import type { Book, ShelfData } from '../types';
import { translations } from '../i18n/translations';
import { storageService } from '../services/storageService';
import { 
  Clock, Star, ChevronLeft, BrainCircuit, Activity, Trash2, AlertTriangle,
  BarChart3, LineChart, BookOpen, Zap, Globe2, ShieldCheck, Fingerprint, 
  LayoutPanelTop, Timer, Rocket, Sparkles
} from 'lucide-react';

// Using any to bypass motion property type errors
const MotionDiv = motion.div as any;
const MotionPath = motion.path as any;

interface DashboardProps {
  books: Book[];
  shelves: ShelfData[];
  lang: Language;
  onBack: () => void;
}

const ANALYTICAL_COLORS = [
  '#3b82f6', // Bright Blue
  '#10b981', // Emerald Green
  '#f59e0b', // Amber Orange
  '#8b5cf6', // Violet Purple
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#ef4444'  // Sanctuary Red
];

export const Dashboard: React.FC<DashboardProps> = ({ books, shelves, lang, onBack }) => {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const t = translations[lang];
  const isRTL = lang === 'ar';

  // Global Metrics
  const globalSeconds = useMemo(() => books.reduce((acc, b) => acc + b.timeSpentSeconds, 0), [books]);
  const globalMinutes = Math.floor(globalSeconds / 60);
  const globalStars = useMemo(() => books.reduce((acc, b) => acc + b.stars, 0), [books]);
  const globalAnnotations = useMemo(() => books.reduce((acc, b) => acc + (b.annotations?.length || 0), 0), [books]);
  
  // Book Statistics
  const bookStats = useMemo(() => {
    return books.map((book, idx) => {
      const minutes = Math.floor(book.timeSpentSeconds / 60);
      return {
        id: book.id,
        title: book.title,
        minutes,
        stars: book.stars,
        color: ANALYTICAL_COLORS[idx % ANALYTICAL_COLORS.length]
      };
    }).sort((a, b) => b.minutes - a.minutes);
  }, [books]);

  const maxBookMinutes = useMemo(() => Math.max(...bookStats.map(b => b.minutes), 1), [bookStats]);

  // Individual Book Growth Evolution (Multi-Line Chart)
  const bookEvolutionData = useMemo(() => {
    const timePoints = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
    return bookStats.slice(0, 12).map(book => ({
      ...book,
      // Simulate cumulative growth: each point is a fraction of total minutes
      points: timePoints.map(p => Math.floor(book.minutes * p))
    }));
  }, [bookStats]);

  // Peak Hourly Performance
  const peakHours = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      intensity: 0
    }));
    books.forEach(b => {
      const lastHour = new Date(b.lastReadAt || Date.now()).getHours();
      hours[lastHour].intensity += (b.timeSpentSeconds / 60); 
    });
    
    const maxInt = Math.max(...hours.map(h => h.intensity), 1);
    return hours.map(h => ({
      ...h,
      normalized: (h.intensity / maxInt) * 100
    }));
  }, [books]);

  const habitData = useMemo(() => storageService.getHabitData(), []);
  
  const habitStartDate = useMemo(() => {
    const allDates = [...habitData.history, ...habitData.missedDays].sort();
    return allDates.length > 0 ? new Date(allDates[0]) : null;
  }, [habitData]);

  const habitPhases = useMemo(() => {
    const streak = habitData.streak;
    if (streak <= 10) return { phase: 1, name: isRTL ? 'مرحلة المقاومة' : 'Resistance Phase', color: '#ef4444' };
    if (streak <= 21) return { phase: 2, name: isRTL ? 'مرحلة التثبيت' : 'Installation Phase', color: '#f59e0b' };
    return { phase: 3, name: isRTL ? 'مرحلة الانصهار' : 'Integration Phase', color: '#10b981' };
  }, [habitData.streak, isRTL]);

  const handleClearAll = () => {
    storageService.saveBooks([]);
    window.location.reload(); 
  };

  return (
    <MotionDiv 
      animate={{ opacity: 1 }} 
      className="p-3 md:p-8 w-full max-w-7xl mx-auto space-y-8 md:space-y-24 mb-24 bg-[#020502] min-h-full"
    >
      {/* Header Sticky Bar */}
      <header className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6 sticky top-0 bg-[#020502]/95 backdrop-blur-3xl py-4 md:py-8 z-[100] border-b border-white/5 px-4 md:px-6 rounded-none md:rounded-b-[3rem] shadow-2xl">
        <button onClick={onBack} className="self-start p-2.5 md:p-3 bg-white/5 rounded-full text-white/60 flex items-center gap-2 active:scale-95 transition-all hover:bg-[#ff0000]/20 hover:text-white border border-white/5">
          <ChevronLeft size={18} className={`${isRTL ? "rotate-180" : ""}`} />
          <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest">{t.backToShelf}</span>
        </button>
        <div className="text-center">
          <h2 className="text-xl md:text-5xl font-black italic uppercase tracking-tighter flex items-center justify-center gap-3 md:gap-4">
            <LayoutPanelTop className="text-[#ff0000] size-5 md:size-10 animate-pulse" />
            {t.dashboard}
          </h2>
          <p className="text-[8px] md:text-xs uppercase font-bold tracking-[0.3em] md:tracking-[0.5em] text-white/20 mt-1 md:mt-2">Neural Comparative Interface v5.5</p>
        </div>
        <div className="flex items-center gap-3 md:gap-4">
           <button onClick={() => setShowClearConfirm(true)} className="p-2.5 md:p-3 bg-red-600/10 border border-red-600/20 rounded-full text-red-600 hover:bg-red-600 hover:text-white transition-all shadow-xl shadow-red-600/5">
             <Trash2 className="size-4 md:size-5" />
           </button>
        </div>
      </header>

      {/* SECTION 0: HABIT FORMATION PATH (NEW) */}
      <section className="bg-white/[0.02] border border-white/10 p-5 md:p-12 rounded-[1.5rem] md:rounded-[4rem] space-y-8 shadow-4xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-[0.02] pointer-events-none">
          <BrainCircuit size={200} />
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/5 rounded-xl border border-white/10" style={{ color: habitPhases.color }}>
              <Zap className="size-5 md:size-8" />
            </div>
            <div>
              <h3 className="text-lg md:text-4xl font-black uppercase tracking-tighter italic">{isRTL ? 'مسار تكوين العادة (40 يوماً)' : 'Habit Formation Path (40 Days)'}</h3>
              <p className="text-[8px] md:text-xs uppercase font-bold tracking-widest text-white/30 mt-1">{habitPhases.name} - Streak: {habitData.streak} Days</p>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            {/* Shields Display */}
            <div className="flex items-center gap-2 bg-blue-600/10 px-4 py-2 rounded-full border border-blue-600/20 backdrop-blur-md">
              <ShieldCheck className="size-4 text-blue-500" />
              <div className="flex flex-col">
                <span className="text-[7px] font-black uppercase text-blue-500/60 leading-none">{isRTL ? 'الدروع المتبقية' : 'Shields Left'}</span>
                <span className="text-[10px] font-black text-blue-500">{habitData.shields} / 3</span>
                <div className="w-12 h-1 bg-blue-500/10 rounded-full mt-1 overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-1000" 
                    style={{ width: `${(habitData.consecutiveFullDays / 7) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-black/40 px-4 py-2 rounded-full border border-white/5 backdrop-blur-md">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: habitPhases.color }} />
              <span className="text-[10px] font-black uppercase tracking-widest text-white/60">
                {isRTL ? `اليوم ${habitData.streak} من 40` : `Day ${habitData.streak} of 40`}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2 md:gap-3 relative z-10">
          {[...Array(40)].map((_, i) => {
            const dayNum = i + 1;
            
            const dayDate = habitStartDate ? new Date(habitStartDate) : null;
            if (dayDate) dayDate.setDate(dayDate.getDate() + i);
            const dayDateStr = dayDate ? dayDate.toISOString().split('T')[0] : null;

            const isCompleted = dayDateStr ? habitData.history.includes(dayDateStr) : false;
            const isMissed = dayDateStr ? habitData.missedDays.includes(dayDateStr) : false;
            const isRescue = dayDateStr && habitData.lastUpdated === dayDateStr && !isCompleted && !isMissed;
            const isCurrent = dayNum === habitData.streak + 1;
            
            let dayColor = 'rgba(255,255,255,0.03)';
            if (isCompleted) {
              if (dayNum <= 10) dayColor = '#ef4444';
              else if (dayNum <= 21) dayColor = '#f59e0b';
              else dayColor = '#10b981';
            } else if (isMissed) {
              dayColor = '#333333'; // Ash Gray for scars
            } else if (isRescue) {
              dayColor = '#3b82f6'; // Blue for Rescue
            }

            return (
              <div 
                key={i}
                className={`aspect-square rounded-lg md:rounded-xl border flex items-center justify-center transition-all duration-500 relative group
                  ${isCompleted ? 'border-transparent shadow-lg' : isMissed ? 'border-white/10' : isRescue ? 'border-blue-500/30' : 'border-white/5 bg-white/[0.02]'}
                  ${isCurrent ? 'border-white/20 animate-pulse' : ''}
                `}
                style={{ 
                  backgroundColor: (isCompleted || isMissed || isRescue) ? dayColor : undefined,
                  boxShadow: isCompleted ? `0 0 15px ${dayColor}44` : isRescue ? `0 0 10px ${dayColor}33` : 'none'
                }}
              >
                <span className={`text-[8px] md:text-[10px] font-black ${isCompleted ? 'text-black' : isMissed ? 'text-white/20' : isRescue ? 'text-white' : 'text-white/10'}`}>
                  {dayNum}
                </span>
                {isCompleted && (
                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none rounded-lg md:rounded-xl" />
                )}
                
                {/* Tooltip for phases */}
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all pointer-events-none bg-black border border-white/10 px-2 py-1 rounded text-[7px] uppercase font-black whitespace-nowrap z-50">
                  {isMissed ? (isRTL ? 'فجوة عصبية' : 'Neural Gap') : 
                   isRescue ? (isRTL ? 'جلسة إنقاذ' : 'Rescue Session') :
                   dayNum <= 10 ? (isRTL ? 'المقاومة' : 'Resistance') : 
                   dayNum <= 21 ? (isRTL ? 'التثبيت' : 'Installation') : 
                   (isRTL ? 'الانصهار' : 'Integration')}
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="flex justify-between items-center pt-4 border-t border-white/5 opacity-30">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#ef4444]" />
            <span className="text-[7px] uppercase font-black tracking-widest">{isRTL ? 'المقاومة (1-10)' : 'Resistance (1-10)'}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#f59e0b]" />
            <span className="text-[7px] uppercase font-black tracking-widest">{isRTL ? 'التثبيت (11-21)' : 'Installation (11-21)'}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#10b981]" />
            <span className="text-[7px] uppercase font-black tracking-widest">{isRTL ? 'الانصهار (22-40)' : 'Integration (22-40)'}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#3b82f6]" />
            <span className="text-[7px] uppercase font-black tracking-widest">{isRTL ? 'جلسة إنقاذ' : 'Rescue Session'}</span>
          </div>
        </div>
      </section>

      {/* SECTION: THE SCIENCE OF HABIT FORMATION */}
      <section className="bg-white/[0.01] border border-white/5 p-6 md:p-16 rounded-[2rem] md:rounded-[5rem] space-y-10 relative overflow-hidden">
        <div className="flex items-center gap-6 relative z-10">
          <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
            <BrainCircuit className="text-purple-500 size-6 md:size-8" />
          </div>
          <div>
            <h3 className="text-xl md:text-5xl font-black uppercase tracking-tighter italic">{isRTL ? 'علم تكوين العادات' : 'The Science of Habit'}</h3>
            <p className="text-[9px] md:text-xs uppercase font-bold tracking-widest text-white/30 mt-1 md:mt-2">Neuroplasticity & Behavioral Engineering</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
          <div className="space-y-4 p-6 bg-white/[0.02] rounded-3xl border border-white/5">
            <div className="text-red-500 font-black text-2xl italic">01. {isRTL ? 'مقاومة الدماغ' : 'Brain Resistance'}</div>
            <p className="text-xs text-white/40 leading-relaxed uppercase font-bold tracking-tight">
              {isRTL ? 'الأيام (1-10): دماغك يحب توفير الطاقة ويفضل العادات القديمة. في هذه المرحلة، أنت تبني مساراً جديداً تماماً ضد رغبة دماغك في الراحة. الاستمرار هنا هو مفتاح النجاح.' : 'Days (1-10): Your brain hates wasting energy and prefers old routines. You are fighting your biology to build a new path. Staying consistent here is the hardest but most vital step.'}
            </p>
          </div>
          <div className="space-y-4 p-6 bg-white/[0.02] rounded-3xl border border-white/5">
            <div className="text-orange-500 font-black text-2xl italic">02. {isRTL ? 'بناء المسارات' : 'Building the Path'}</div>
            <p className="text-xs text-white/40 leading-relaxed uppercase font-bold tracking-tight">
              {isRTL ? 'الأيام (11-21): يبدأ الدماغ في تغليف المسارات العصبية الجديدة بمادة عازلة تجعل نقل المعلومات أسرع. ستشعر أن القراءة بدأت تصبح أسهل وأقل مجهوداً من ذي قبل.' : 'Days (11-21): Your brain starts insulating the new neural paths, making them faster and more efficient. You\'ll notice that starting to read requires much less effort than it did in the first week.'}
            </p>
          </div>
          <div className="space-y-4 p-6 bg-white/[0.02] rounded-3xl border border-white/5">
            <div className="text-emerald-500 font-black text-2xl italic">03. {isRTL ? 'الوضع التلقائي' : 'Auto-Pilot Mode'}</div>
            <p className="text-xs text-white/40 leading-relaxed uppercase font-bold tracking-tight">
              {isRTL ? 'الأيام (22-40): أصبحت القراءة الآن "مبرمجة" في مراكز التحكم العميقة في دماغك. لقد تحولت من فعل يتطلب إرادة إلى عادة تلقائية تشعرك بالراحة تماماً كالتنفس.' : 'Days (22-40): Reading is now "hard-wired" into your brain\'s deep control centers. It has transitioned from a conscious effort to an automatic habit that feels as natural as breathing.'}
            </p>
          </div>
        </div>

        <div className="p-8 bg-red-600/5 border border-red-600/10 rounded-[2rem] flex flex-col md:flex-row items-center gap-8">
           <AlertTriangle className="text-red-600 size-12 shrink-0" />
           <div className="space-y-2">
             <h4 className="text-sm font-black uppercase tracking-widest text-red-600">{isRTL ? 'قاعدة الـ 48 ساعة' : 'The 48-Hour Rule'}</h4>
             <p className="text-[10px] md:text-xs text-white/40 uppercase font-bold leading-relaxed">
               {isRTL ? 'تفويت يوم واحد هو مجرد زلة، لكن تفويت يومين متتاليين هو بداية لعادة "عدم الفعل" الجديدة. استخدم الدروع لحماية تقدمك، واحرص دائماً على العودة فوراً للحفاظ على قوة الوصلات العصبية.' : 'Missing one day is a slip, but missing two is the start of a new "lazy" habit. Use your shields to protect your progress, and always bounce back immediately to keep the neural connections strong.'}
             </p>
           </div>
        </div>
      </section>

      {/* SECTION: RESILIENCE & RECOVERY PROTOCOL */}
      <section className="bg-white/[0.01] border border-white/5 p-6 md:p-16 rounded-[2rem] md:rounded-[5rem] space-y-10 relative overflow-hidden">
        <div className="flex items-center gap-6 relative z-10">
          <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
            <ShieldCheck className="text-blue-500 size-6 md:size-8" />
          </div>
          <div>
            <h3 className="text-xl md:text-5xl font-black uppercase tracking-tighter italic">{isRTL ? 'بروتوكول المرونة والتعافي' : 'Resilience & Recovery Protocol'}</h3>
            <p className="text-[9px] md:text-xs uppercase font-bold tracking-widest text-white/30 mt-1 md:mt-2">Systemic Safeguards for Habit Preservation</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
          {/* Rescue Session Explanation */}
          <div className="space-y-6 p-8 bg-blue-600/5 rounded-[2.5rem] border border-blue-600/10">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-600/20 rounded-xl">
                <Activity className="text-blue-500 size-6" />
              </div>
              <h4 className="text-lg font-black uppercase tracking-tight text-blue-500">{isRTL ? 'جلسة الإنقاذ (دقيقتان)' : 'Rescue Session (2 Min)'}</h4>
            </div>
            <p className="text-xs text-white/50 leading-relaxed uppercase font-bold">
              {isRTL 
                ? 'في الأيام الحرجة، دقيقتان من القراءة تكفي لحماية "سلسلة الالتزام" من الانكسار. هي بمثابة "صيانة عصبية" تمنع دماغك من نسيان العادة، لكنها لا تحتسب يوماً كاملاً في مسار الـ 40 يوماً.' 
                : 'On critical days, 2 minutes of reading is enough to protect your streak from breaking. It acts as "neural maintenance," preventing your brain from forgetting the habit, though it doesn\'t count as a full day on the 40-day path.'}
            </p>
          </div>

          {/* Earnable Shields Explanation */}
          <div className="space-y-6 p-8 bg-emerald-600/5 rounded-[2.5rem] border border-emerald-600/10">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-600/20 rounded-xl">
                <ShieldCheck className="text-emerald-500 size-6" />
              </div>
              <h4 className="text-lg font-black uppercase tracking-tight text-emerald-500">{isRTL ? 'دروع الاستحقاق' : 'Earnable Shields'}</h4>
            </div>
            <p className="text-xs text-white/50 leading-relaxed uppercase font-bold">
              {isRTL 
                ? 'كل 7 أيام متتالية من القراءة الكاملة تمنحك درعاً واحداً. كما أن الوصول للنجمة الخامسة في أي كتاب يمنحك درعين إضافيين فوراً (بحد أقصى 3 دروع إجمالاً).' 
                : 'Every 7 consecutive full days earns you 1 shield. Additionally, reaching the 5th star in any book grants you 2 extra shields immediately (max 3 total).'}
            </p>
          </div>
        </div>

        <div className="p-8 bg-white/[0.02] border border-white/5 rounded-[2rem] space-y-6">
          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">{isRTL ? 'سياسة التطبيق وتوجيهات الاستخدام' : 'App Policy & User Guidance'}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-white/80">{isRTL ? 'إدارة الطوارئ' : 'Emergency Management'}</span>
              </div>
              <p className="text-[10px] text-white/40 uppercase font-bold leading-relaxed">
                {isRTL 
                  ? 'النظام مصمم ليدعمك في ظروفك الصعبة. لا تشعر بالإحباط عند استهلاك درع؛ فقد وُجدت لهذا الغرض. ركز على العودة للمسار في أقرب فرصة.' 
                  : 'The system is designed to support you during tough times. Don\'t feel discouraged when a shield is consumed; they exist for this purpose. Focus on returning to the path as soon as possible.'}
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-white/80">{isRTL ? 'النمو المعرفي' : 'Cognitive Growth'}</span>
              </div>
              <p className="text-[10px] text-white/40 uppercase font-bold leading-relaxed">
                {isRTL 
                  ? 'الوصول للنجمة الخامسة يتطلب تركيزاً عميقاً وتراكماً معرفياً. مكافأة الدرعين هي تقديراً لجهدك في الغوص في أعماق المخطوطة.' 
                  : 'Reaching the 5th star requires deep focus and knowledge accumulation. The 2-shield reward is a recognition of your effort in diving deep into the manuscript.'}
              </p>
            </div>
          </div>
          
          <div className="pt-6 border-t border-white/5 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex gap-4">
              <div className="text-blue-500 font-black text-xl">01</div>
              <p className="text-[10px] text-white/40 uppercase font-bold leading-tight">{isRTL ? 'الأولوية لحماية السلسلة (Streak) عبر جلسات الإنقاذ.' : 'Priority is given to streak preservation via Rescue Sessions.'}</p>
            </div>
            <div className="flex gap-4">
              <div className="text-emerald-500 font-black text-xl">02</div>
              <p className="text-[10px] text-white/40 uppercase font-bold leading-tight">{isRTL ? 'استهلاك الدروع يتم آلياً عند الغياب التام دون تدخل منك.' : 'Shield consumption is automated during total absence without user intervention.'}</p>
            </div>
            <div className="flex gap-4">
              <div className="text-red-600 font-black text-xl">03</div>
              <p className="text-[10px] text-white/40 uppercase font-bold leading-tight">{isRTL ? 'عند نفاذ الدروع، تظهر "الندوب الرمادية" كتوثيق صادق لرحلتك.' : 'When shields are exhausted, "Neural Scars" appear as an honest record of your journey.'}</p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 1: INDIVIDUAL MANUSCRIPT EVOLUTION (BARS) */}
      <section className="bg-white/[0.02] border border-white/10 p-5 md:p-20 rounded-[1.5rem] md:rounded-[5rem] space-y-8 md:space-y-16 shadow-4xl relative overflow-hidden">
        <div className="flex items-center gap-4 md:gap-6 relative z-10">
          <div className="p-3 md:p-4 bg-white/5 rounded-xl md:rounded-2xl border border-white/10">
            <BarChart3 className="text-[#ef4444] size-5 md:size-8" />
          </div>
          <div>
            <h3 className="text-lg md:text-5xl font-black uppercase tracking-tighter italic">{t.bookGrowthBenchmark}</h3>
            <p className="text-[8px] md:text-xs uppercase font-bold tracking-widest text-white/30 mt-1 md:mt-2">Individual Manuscript Concentration Metrics</p>
          </div>
        </div>

        {bookStats.length === 0 ? (
          <div className="h-[300px] md:h-[400px] flex items-center justify-center text-white/20 uppercase font-black tracking-widest text-[10px] md:text-xs italic">
            {isRTL ? 'لا توجد بيانات للمقارنة' : 'No manuscripts available for analysis'}
          </div>
        ) : (
          <div className="flex items-end gap-1.5 md:gap-4 h-[350px] md:h-[450px] mt-8 md:mt-12 px-2 md:px-8 border-b border-white/10 relative z-10 overflow-x-auto no-scrollbar">
            {bookStats.map((book, i) => {
              const barHeight = (book.minutes / maxBookMinutes) * 100;
              return (
                <div key={book.id} className="min-w-[40px] md:min-w-0 flex-1 flex flex-col items-center group relative h-full justify-end">
                  <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-all duration-300 bg-white text-black font-black text-[9px] px-2 py-1 rounded-full whitespace-nowrap z-20 shadow-xl">
                    {book.minutes}m / {book.stars}★
                  </div>
                  <MotionDiv 
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(4, barHeight)}%` }}
                    transition={{ duration: 1.5, delay: i * 0.08, ease: "circOut" }}
                    className="w-full max-w-[50px] md:max-w-[70px] rounded-t-xl md:rounded-t-2xl relative overflow-hidden group-hover:brightness-125 transition-all duration-500 shadow-2xl"
                    style={{ 
                      backgroundColor: book.color,
                      boxShadow: `0 0 20px ${book.color}44`
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-white/10" />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                       <span className="text-[7px] md:text-[10px] font-black text-white/30 rotate-[-90deg] whitespace-nowrap">
                         {book.minutes}m
                       </span>
                    </div>
                  </MotionDiv>
                  <div className="mt-6 h-24 md:h-32 flex items-center justify-center overflow-visible">
                    <span className={`text-[7px] md:text-[11px] font-black uppercase tracking-tighter rotate-[-45deg] origin-center whitespace-nowrap transition-all duration-500 group-hover:text-white ${isRTL ? "text-right" : "text-left"}`} style={{ color: book.color }}>
                      {book.title}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SECTION 1.5: MANUSCRIPT BADGES (NEW) */}
      <section className="bg-white/[0.02] border border-white/10 p-5 md:p-20 rounded-[1.5rem] md:rounded-[5rem] space-y-8 md:space-y-16 shadow-4xl relative overflow-hidden">
        <div className="flex items-center gap-4 md:gap-6 relative z-10">
          <div className="p-3 md:p-4 bg-white/5 rounded-xl md:rounded-2xl border border-white/10">
            <ShieldCheck className="text-yellow-500 size-5 md:size-8" />
          </div>
          <div>
            <h3 className="text-lg md:text-5xl font-black uppercase tracking-tighter italic">{isRTL ? 'أوسمة المخطوطات' : 'Manuscript Badges'}</h3>
            <p className="text-[8px] md:text-xs uppercase font-bold tracking-widest text-white/30 mt-1 md:mt-2">Earned Distinctions per Manuscript</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 relative z-10">
          {books.map((book) => (
            <div key={book.id} className="p-4 md:p-6 bg-black/40 border border-white/5 rounded-[1.5rem] md:rounded-[2rem] space-y-4 hover:border-red-600/30 transition-all group">
              <div className="flex justify-between items-start">
                <h4 className="text-[10px] md:text-xs font-black uppercase tracking-widest text-white/80 group-hover:text-white transition-colors truncate max-w-[120px] md:max-w-[150px]">{book.title}</h4>
                <div className="flex items-center gap-1 bg-red-600/10 px-2 py-0.5 md:py-1 rounded-full border border-red-600/20">
                  <Star className="text-red-600 fill-red-600 size-2 md:size-2.5" />
                  <span className="text-[8px] md:text-[9px] font-black text-red-600">{book.stars || 0}</span>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-1.5 md:gap-2">
                {[...Array(7)].map((_, i) => {
                  const isEarned = (book.stars || 0) > i;
                  return (
                    <div 
                      key={i} 
                      className={`p-1.5 md:p-2 rounded-lg md:rounded-xl border transition-all flex items-center gap-1.5 md:gap-2 ${isEarned ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500' : 'bg-white/5 border-transparent text-white/10 grayscale opacity-40'}`}
                      title={t.badges[i]}
                    >
                      <Sparkles className={`size-2.5 md:size-3 ${isEarned ? "animate-pulse" : ""}`} />
                      <span className="text-[7px] md:text-[8px] font-black uppercase tracking-tighter">{t.badges[i]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {books.length === 0 && (
             <div className="col-span-full py-12 md:py-20 text-center opacity-20 uppercase font-black tracking-widest text-[10px] md:text-xs italic">
               {isRTL ? 'لا توجد أوسمة محصلة بعد' : 'No badges earned yet'}
             </div>
          )}
        </div>
      </section>

      {/* SECTION 1.7: BADGE CRITERIA TABLE (NEW) */}
      <section className="bg-white/[0.02] border border-white/10 p-5 md:p-20 rounded-[1.5rem] md:rounded-[5rem] space-y-8 md:space-y-16 shadow-4xl relative overflow-hidden">
        <div className="flex items-center gap-4 md:gap-6 relative z-10">
          <div className="p-3 md:p-4 bg-white/5 rounded-xl md:rounded-2xl border border-white/10">
            <LayoutPanelTop className="text-red-600 size-5 md:size-8" />
          </div>
          <div>
            <h3 className="text-lg md:text-5xl font-black uppercase tracking-tighter italic">{isRTL ? 'معايير الاستحقاق' : 'Merit Criteria'}</h3>
            <p className="text-[8px] md:text-xs uppercase font-bold tracking-widest text-white/30 mt-1 md:mt-2">Temporal Thresholds for Intellectual Distinctions</p>
          </div>
        </div>

        <div className="relative z-10 overflow-hidden rounded-3xl border border-white/5 bg-black/40">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-bottom border-white/10 bg-white/5">
                  <th className="p-4 md:p-6 text-[10px] md:text-xs font-black uppercase tracking-widest text-white/40">{isRTL ? 'الرتبة' : 'Rank'}</th>
                  <th className="p-4 md:p-6 text-[10px] md:text-xs font-black uppercase tracking-widest text-white/40">{isRTL ? 'الوسام' : 'Badge'}</th>
                  <th className="p-4 md:p-6 text-[10px] md:text-xs font-black uppercase tracking-widest text-white/40 text-right">{isRTL ? 'مدة التركيز' : 'Focus Duration'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  { star: 1, min: 15 },
                  { star: 2, min: 30 },
                  { star: 3, min: 50 },
                  { star: 4, min: 140 },
                  { star: 5, min: 200 },
                  { star: 6, min: 260 },
                  { star: 7, min: 320 }
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="p-4 md:p-6">
                      <div className="flex items-center gap-2">
                        <Star size={14} className="text-red-600 fill-red-600" />
                        <span className="text-xs md:text-sm font-black text-white">{row.star}</span>
                      </div>
                    </td>
                    <td className="p-4 md:p-6">
                      <div className="flex items-center gap-3">
                        <Sparkles size={14} className="text-yellow-500 opacity-40 group-hover:opacity-100 transition-opacity" />
                        <span className="text-xs md:text-sm font-bold text-white/80 group-hover:text-white transition-colors tracking-tight">
                          {t.badges[i]}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 md:p-6 text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-xs md:text-sm font-mono font-black text-red-600">
                          {row.min} {isRTL ? 'دقيقة' : 'min'}
                        </span>
                        {row.min >= 60 && (
                          <span className="text-[9px] font-bold text-white/20 uppercase tracking-tighter">
                            ({Math.floor(row.min / 60)}h {row.min % 60}m)
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* SECTION 2: NEURAL SYNERGY FLOW (LINE CHART) */}
      <section className="bg-white/[0.01] border border-white/5 p-5 md:p-20 rounded-[1.5rem] md:rounded-[5rem] space-y-8 md:space-y-16 relative overflow-hidden shadow-3xl">
        <div className="absolute top-0 right-0 p-6 md:p-16 opacity-[0.03] pointer-events-none rotate-12">
          <LineChart size={window.innerWidth < 768 ? 150 : 350} />
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-8 relative z-10">
          <div className="flex items-center gap-4 md:gap-6">
            <div className="p-3 md:p-4 bg-white/5 rounded-xl md:rounded-2xl border border-white/10">
              <Activity className="text-[#3b82f6] size-5 md:size-8" />
            </div>
            <div>
              <h3 className="text-lg md:text-5xl font-black uppercase tracking-tighter italic">{t.bookSynergy}</h3>
              <p className="text-[8px] md:text-xs uppercase font-bold tracking-widest text-white/30 mt-1 md:mt-2">Comparative Intellectual Velocity over Time</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 md:gap-4 max-w-lg justify-start md:justify-end">
            {bookStats.slice(0, 8).map(b => (
              <div key={b.id} className="flex items-center gap-1.5 md:gap-2 bg-black/40 px-2.5 py-1 md:py-1.5 rounded-full border border-white/5 backdrop-blur-md">
                <div className="w-1 md:w-1.5 h-1 md:h-1.5 rounded-full" style={{ backgroundColor: b.color, boxShadow: `0 0 8px ${b.color}` }} />
                <span className="text-[6px] md:text-[7px] font-black uppercase tracking-widest opacity-40 truncate max-w-[50px] md:max-w-[80px]">{b.title}</span>
                <span className="text-[6px] md:text-[7px] font-black text-white/20 ml-1">{b.minutes}m</span>
              </div>
            ))}
          </div>
        </div>

        <div className="h-[250px] md:h-[500px] w-full relative mt-8 md:mt-16 px-2">
          <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
            <defs>
              {bookEvolutionData.map((s, i) => (
                <linearGradient key={`grad-book-${i}`} id={`grad-book-${i}`} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={s.color} stopOpacity="0.2" />
                  <stop offset="100%" stopColor={s.color} stopOpacity="0" />
                </linearGradient>
              ))}
            </defs>
            
            {[...Array(6)].map((_, i) => (
              <line key={i} x1="0" y1={i * 20} x2="100" y2={i * 20} stroke="white" strokeOpacity="0.03" strokeWidth="0.1" />
            ))}
            
            {bookEvolutionData.map((book, sIdx) => {
              const maxVal = Math.max(...bookEvolutionData.flatMap(s => s.points), 1);
              const pathData = book.points.map((p, pIdx) => {
                const x = (pIdx / (book.points.length - 1)) * 100;
                const y = 100 - (p / maxVal) * 90;
                return pIdx === 0 ? `M ${x},${y}` : `L ${x},${y}`;
              }).join(' ');

              const areaData = `${pathData} L 100,100 L 0,100 Z`;

              return (
                <g key={book.id}>
                  <MotionPath 
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 3, ease: "easeInOut", delay: sIdx * 0.2 }}
                    d={pathData} 
                    fill="none" 
                    stroke={book.color} 
                    strokeWidth="0.8" 
                    strokeLinecap="round"
                    style={{ filter: `drop-shadow(0 0 8px ${book.color}66)` }}
                  />
                  <MotionPath 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 2, delay: 1.5 + sIdx * 0.2 }}
                    d={areaData} 
                    fill={`url(#grad-book-${sIdx})`} 
                  />
                </g>
              );
            })}
          </svg>
          <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2 pt-4 md:pt-6 border-t border-white/5 opacity-10 text-[6px] md:text-[9px] font-black uppercase tracking-[0.2em] md:tracking-[0.6em]">
            <span>Genesis</span>
            <span>Archive Growth</span>
            <span>Current Mastery</span>
          </div>
        </div>
      </section>

      {/* SECTION 3: CHRONO-PEAK ANALYSIS */}
      <section className="bg-white/[0.02] border border-white/10 p-5 md:p-20 rounded-[1.5rem] md:rounded-[5rem] space-y-8 md:space-y-16 shadow-2xl relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-8">
          <div className="flex items-center gap-4 md:gap-6">
            <div className="p-3 md:p-4 bg-white/5 rounded-xl md:rounded-2xl border border-white/10">
              <Timer className="text-[#f59e0b] size-5 md:size-8" />
            </div>
            <div>
              <h3 className="text-lg md:text-5xl font-black uppercase tracking-tighter italic">{t.peakFocusHours}</h3>
              <p className="text-[8px] md:text-xs uppercase font-bold tracking-widest text-white/30 mt-1 md:mt-2">Circadian Reading Intensity Over 24-Hour Cycle</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white/5 px-3 md:px-6 py-1.5 md:py-3 rounded-full border border-white/10 self-start md:self-auto">
             <div className="w-1 md:w-1.5 h-1 md:h-1.5 rounded-full bg-[#f59e0b] animate-ping" />
             <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-[#f59e0b]">Active Chrono-Mapping</span>
          </div>
        </div>

        <div className="grid grid-cols-6 md:grid-cols-12 lg:grid-cols-24 gap-1 md:gap-2 h-[120px] md:h-[220px] items-end mt-8 md:mt-12 px-2 border-b border-white/5 pb-2">
          {peakHours.map((h, i) => (
            <div key={i} className="flex-1 group relative h-full flex flex-col justify-end">
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-white text-black text-[8px] px-1.5 py-0.5 rounded font-black whitespace-nowrap z-50">
                {h.hour}:00
              </div>
              <MotionDiv 
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(4, h.normalized)}%` }}
                transition={{ duration: 1, delay: i * 0.04 }}
                className="w-full rounded-t-md md:rounded-t-lg transition-all hover:brightness-150 cursor-pointer"
                style={{ 
                  backgroundColor: h.normalized > 60 ? '#f59e0b' : 'rgba(255,255,255,0.08)',
                  boxShadow: h.normalized > 60 ? '0 0 15px rgba(245, 158, 11, 0.5)' : 'none'
                }}
              />
              <span className="text-[6px] font-black opacity-20 mt-3 block text-center truncate">{h.hour}h</span>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 4: GLOBAL SUMMARY ZENITH */}
      <section className="bg-gradient-to-br from-[#ff0000]/[0.05] via-[#020502] to-[#020502] border border-white/5 p-8 md:p-24 rounded-[3rem] md:rounded-[6rem] shadow-[0_50px_150px_rgba(0,0,0,0.8)] relative overflow-hidden">
        <div className="absolute bottom-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-[#ff0000]/30 to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] md:w-[800px] h-[600px] md:h-[800px] bg-[#ff0000]/5 rounded-full blur-[150px] md:blur-[200px] pointer-events-none" />
        <div className="absolute top-0 right-0 p-6 md:p-24 opacity-[0.05] pointer-events-none">
          <Globe2 className="size-32 md:size-[500px]" />
        </div>

        <div className="text-center mb-12 md:mb-24 relative z-10">
          <div className="inline-flex p-4 md:p-8 bg-white/5 rounded-[1.5rem] md:rounded-[3.5rem] border border-white/10 mb-6 md:mb-10 shadow-3xl">
            <Zap className="text-[#ff0000] drop-shadow-[0_0_30px_#ff0000] size-6 md:size-14" />
          </div>
          <h3 className="text-3xl md:text-9xl font-black italic uppercase tracking-tighter leading-none mb-6 md:mb-8">The Sanctuary Zenith</h3>
          <p className="text-[10px] md:text-2xl font-bold uppercase tracking-[0.4em] md:tracking-[0.8em] text-white/20">Holistic Cognitive Synthesis</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-10 relative z-10">
          {[
            { label: t.totalReadingTime, value: `${globalMinutes}m`, icon: Clock, color: '#ff0000' },
            { label: 'Stars Earned', value: globalStars, icon: Star, color: '#f59e0b' },
            { label: 'Neural Entries', value: globalAnnotations, icon: BrainCircuit, color: '#3b82f6' },
            { label: 'Archived Texts', value: books.length, icon: BookOpen, color: '#10b981' }
          ].map((stat, i) => (
            <MotionDiv 
              key={i}
              whileHover={{ scale: 1.05, y: -5 }}
              className="p-8 md:p-16 bg-black/60 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] md:rounded-[5rem] flex flex-col items-center text-center gap-6 md:gap-8 shadow-5xl group"
            >
              <div className="p-3 md:p-6 rounded-xl md:rounded-[2rem] bg-white/5 group-hover:bg-white/10 transition-colors" style={{ color: stat.color }}>
                <stat.icon className="size-6 md:size-12" />
              </div>
              <div>
                <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] md:tracking-[0.4em] opacity-30 mb-2 md:mb-4">{stat.label}</p>
                <p className="text-4xl md:text-8xl font-black italic tracking-tighter">{stat.value}</p>
              </div>
            </MotionDiv>
          ))}
        </div>

        <div className="mt-12 md:mt-24 pt-8 md:pt-24 border-t border-white/5 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-12 relative z-10">
           <div className="flex items-center gap-4 md:gap-8 p-4 md:p-10 bg-white/[0.02] rounded-[1.5rem] md:rounded-[3.5rem] border border-white/5 group hover:border-white/20 transition-all">
             <Fingerprint className="text-white/20 group-hover:text-[#ff0000] transition-colors size-6 md:size-8" />
             <div>
               <p className="text-[7px] md:text-[10px] font-black uppercase tracking-widest opacity-20">Identity Hash</p>
               <p className="text-[10px] md:text-sm font-mono font-bold tracking-tighter opacity-50 truncate max-w-[120px] md:max-w-[150px]">SNCT-CORE-{globalSeconds.toString(16).toUpperCase()}</p>
             </div>
           </div>
           <div className="flex items-center gap-4 md:gap-8 p-4 md:p-10 bg-white/[0.02] rounded-[1.5rem] md:rounded-[3.5rem] border border-white/5 group hover:border-white/20 transition-all">
             <ShieldCheck className="text-white/20 group-hover:text-[#10b981] transition-colors size-6 md:size-8" />
             <div>
               <p className="text-[7px] md:text-[10px] font-black uppercase tracking-widest opacity-20">Neural Integrity</p>
               <p className="text-[10px] md:text-sm font-black text-[#10b981] uppercase tracking-widest">Systems Optimized</p>
             </div>
           </div>
           <div className="flex items-center gap-4 md:gap-8 p-4 md:p-10 bg-white/[0.02] rounded-[1.5rem] md:rounded-[3.5rem] border border-white/5 group hover:border-white/20 transition-all">
             <Rocket className="text-white/20 group-hover:text-[#3b82f6] transition-colors size-6 md:size-8" />
             <div>
               <p className="text-[7px] md:text-[10px] font-black uppercase tracking-widest opacity-20">Archive Velocity</p>
               <p className="text-[10px] md:text-sm font-black text-[#3b82f6] uppercase tracking-widest">{(globalMinutes / Math.max(books.length, 1)).toFixed(1)} m/b</p>
             </div>
           </div>
        </div>
      </section>

      {/* Wipe Confirmation Overlay */}
      <AnimatePresence>
        {showClearConfirm && (
          <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[2000] bg-black/98 backdrop-blur-[100px] flex items-center justify-center p-4 md:p-6 text-center">
            <MotionDiv initial={{ scale: 0.9, y: 50 }} animate={{ scale: 1, y: 0 }} className="bg-[#0b140b] border border-white/10 p-8 md:p-16 rounded-[2rem] md:rounded-[5rem] w-full max-w-lg shadow-[0_0_150px_rgba(255,0,0,0.2)]">
               <div className="w-12 h-12 md:w-24 md:h-24 bg-red-600/10 rounded-full flex items-center justify-center text-red-600 mx-auto mb-6 md:mb-10 border border-red-600/20"><AlertTriangle className="size-6 md:size-12" /></div>
               <h3 className="text-lg md:text-3xl font-black uppercase italic mb-4 md:mb-8 tracking-tighter">{isRTL ? 'تأكيد المسح الشامل' : 'TOTAL ARCHIVE WIPE'}</h3>
               <p className="text-[8px] md:text-sm text-white/40 font-bold uppercase tracking-[0.15em] md:tracking-[0.2em] mb-8 md:mb-16 leading-relaxed">
                 {isRTL ? 'سيتم مسح جميع المخطوطات والتقدم والنجوم نهائياً من المحراب. لا يمكن التراجع عن هذا الفعل.' : 'Permanent erasure of all neural records and manuscripts. This action is irreversible.'}
               </p>
               <div className="flex flex-col gap-3 md:gap-5">
                 <button onClick={handleClearAll} className="w-full bg-red-600 py-3 md:py-6 rounded-[1rem] md:rounded-[2.5rem] font-black text-[9px] md:text-xs uppercase text-white tracking-[0.2em] md:tracking-[0.4em] shadow-2xl hover:bg-red-500 transition-all">{isRTL ? 'نعم، امسح كل شيء' : 'YES, PURGE ARCHIVE'}</button>
                 <button onClick={() => setShowClearConfirm(false)} className="w-full bg-white/5 py-3 md:py-6 rounded-[1rem] md:rounded-[2.5rem] font-black text-[9px] md:text-xs uppercase text-white/30 tracking-[0.2em] md:tracking-[0.4em] hover:bg-white/10 transition-all">{isRTL ? 'إلغاء' : 'CANCEL'}</button>
               </div>
            </MotionDiv>
          </MotionDiv>
        )}
      </AnimatePresence>
    </MotionDiv>
  );
};
