
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Zap, ShieldCheck, BrainCircuit, BookOpen, ChevronRight, ChevronLeft } from 'lucide-react';
import { Language } from '../types';

const MotionDiv = motion.div as any;

interface OnboardingProps {
  lang: Language;
  onComplete: () => void;
}

const onboardingData = {
  ar: [
    {
      title: "بداية التكوين",
      description: "«القراءة هي محاورة لأفضل العقول في القرون الماضية.» — ديكارت. هنا تبدأ رحلتك في بناء ذاتك الفكرية.",
      icon: <BookOpen className="text-[#ff0000] drop-shadow-[0_0_15px_rgba(255,0,0,0.5)]" size={56} />,
      color: "from-[#ff0000]/30 to-transparent",
      quote: "المعرفة قوة"
    },
    {
      title: "هندسة العادة",
      description: "«نحن ما نفعله بانتظام. التميز إذن ليس فعلاً، بل عادة.» — أرسطو. دستور: التزم بمسار الـ 40 يوماً لتثبيت وعيك.",
      icon: <BrainCircuit className="text-emerald-500 drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]" size={56} />,
      color: "from-emerald-500/30 to-transparent",
      quote: "التكرار يولد الإتقان"
    },
    {
      title: "دقيقتان فقط تحمي سلسلتك",
      description: "«القليل الدائم خير من الكثير المنقطع.» دستور: في أشد أيامك ازدحاما، دقيقتان كفيلة بإبقاء شعلة الفكر متقدة.",
      icon: <Zap className="text-orange-500 drop-shadow-[0_0_15px_rgba(249,115,22,0.5)]" size={56} />,
      color: "from-orange-500/30 to-transparent",
      quote: "لا تستسلم للفراغ"
    },
    {
      title: "دروع الوعي",
      description: "«الكتاب هو الجليس الذي لا يطريك، والصديق الذي لا يغريك.» دستور: احمِ استمراريتك بالدروع عبر الالتزام اليومي.",
      icon: <ShieldCheck className="text-blue-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]" size={56} />,
      color: "from-blue-500/30 to-transparent",
      quote: "حصن عقلك"
    },
    {
      title: "رابطة المحراب",
      description: "الكمالات كلها لا تُنال إلا بحظ من المشقة، ولا يُعبر إليها إلا على جسر من التعب، وقد أجمع عقلاء كل أمة أن النعيم لا يُدرك بالنعيم",
      icon: <Sparkles className="text-purple-500 drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]" size={56} />,
      color: "from-purple-500/30 to-transparent",
      quote: "ارتقِ بفكرك"
    }
  ],
  en: [
    {
      title: "The Genesis",
      description: "\"The reading of all good books is like a conversation with the finest minds of past centuries.\" — Descartes. Your intellectual journey starts here.",
      icon: <BookOpen className="text-[#ff0000] drop-shadow-[0_0_15px_rgba(255,0,0,0.5)]" size={56} />,
      color: "from-[#ff0000]/30 to-transparent",
      quote: "Knowledge is Power"
    },
    {
      title: "Habit Engineering",
      description: "\"We are what we repeatedly do. Excellence, then, is not an act, but a habit.\" — Aristotle. Master the 40-day path.",
      icon: <BrainCircuit className="text-emerald-500 drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]" size={56} />,
      color: "from-emerald-500/30 to-transparent",
      quote: "Repetition is Mastery"
    },
    {
      title: "The Rescue Philosophy",
      description: "\"Small, steady steps lead to great distances.\" On your busiest days, 2 minutes keep the intellectual flame alive.",
      icon: <Zap className="text-orange-500 drop-shadow-[0_0_15px_rgba(249,115,22,0.5)]" size={56} />,
      color: "from-orange-500/30 to-transparent",
      quote: "Never Yield to Void"
    },
    {
      title: "Shields of Awareness",
      description: "\"A book is a companion that does not flatter you, and a friend that does not tempt you.\" Protect your streak with daily commitment.",
      icon: <ShieldCheck className="text-blue-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]" size={56} />,
      color: "from-blue-500/30 to-transparent",
      quote: "Fortify Your Mind"
    },
    {
      title: "The Sanctuary Bond",
      description: "\"A room without books is like a body without a soul.\" — Cicero. Make this your sacred retreat for growth.",
      icon: <Sparkles className="text-purple-500 drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]" size={56} />,
      color: "from-purple-500/30 to-transparent",
      quote: "Elevate Your Soul"
    }
  ]
};

export const Onboarding: React.FC<OnboardingProps> = ({ lang, onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const steps = onboardingData[lang];
  const isLastStep = currentIndex === steps.length - 1;
  const isRTL = lang === 'ar';
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  // Play cinematic intro sound on mount
  useEffect(() => {
    try {
      const audio = new Audio('/sanctuary_intro.mp3');
      audio.loop = true;
      audio.volume = 0;
      audioRef.current = audio;
      
      const playPromise = audio.play();
      if (playPromise) {
        playPromise.catch(() => {
          // Autoplay blocked — will play on first user interaction
          const resumeAudio = () => {
            audio.play().catch(() => {});
            document.removeEventListener('touchstart', resumeAudio);
            document.removeEventListener('click', resumeAudio);
          };
          document.addEventListener('touchstart', resumeAudio, { once: true });
          document.addEventListener('click', resumeAudio, { once: true });
        });
      }
      
      // Smooth fade-in over 2 seconds
      let vol = 0;
      const fadeIn = setInterval(() => {
        vol = Math.min(vol + 0.05, 0.6);
        audio.volume = vol;
        if (vol >= 0.6) clearInterval(fadeIn);
      }, 100);
    } catch (e) {
      // Sound file not found — silent fallback
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const fadeOutAndComplete = () => {
    // Smooth fade-out over 800ms then stop
    if (audioRef.current) {
      const audio = audioRef.current;
      let vol = audio.volume;
      const fadeOut = setInterval(() => {
        vol = Math.max(vol - 0.08, 0);
        audio.volume = vol;
        if (vol <= 0) {
          clearInterval(fadeOut);
          audio.pause();
          audio.currentTime = 0;
        }
      }, 50);
    }
    onComplete();
  };

  const next = () => {
    if (isLastStep) {
      fadeOutAndComplete();
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const prev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  return (
    <MotionDiv 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] bg-[#000a00] flex items-center justify-center p-6 overflow-hidden"
    >
      {/* Dynamic Background Aura */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <MotionDiv
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.2, 0.4, 0.2]
          }}
          transition={{ duration: 8, repeat: Infinity }}
          className={`absolute inset-0 bg-gradient-to-tr ${steps[currentIndex].color} blur-[120px] transition-colors duration-1000`} 
        />
      </div>

      <div className="relative w-full max-w-xl flex flex-col items-center text-center perspective-1000">
        <AnimatePresence mode="wait">
          <MotionDiv
            key={currentIndex}
            initial={{ rotateY: isRTL ? 45 : -45, opacity: 0, scale: 0.8, z: -100 }}
            animate={{ rotateY: 0, opacity: 1, scale: 1, z: 0 }}
            exit={{ rotateY: isRTL ? -45 : 45, opacity: 0, scale: 0.8, z: -100 }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
            className="flex flex-col items-center w-full"
          >
            <div className="mb-10 relative group">
              <div className="absolute inset-0 bg-white/20 blur-3xl rounded-full scale-150 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative p-10 rounded-[3.5rem] bg-white/[0.02] border border-white/10 shadow-[0_0_50px_rgba(255,255,255,0.05)] backdrop-blur-xl">
                {steps[currentIndex].icon}
              </div>
            </div>
            
            <div className="mb-4">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#ff0000] shining-text">
                {steps[currentIndex].quote}
              </span>
            </div>

            <h2 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter mb-6 italic drop-shadow-2xl">
              {steps[currentIndex].title}
            </h2>
            
            <p className="text-base md:text-lg text-white/70 font-bold leading-relaxed max-w-md mb-12 px-4 drop-shadow-lg">
              {steps[currentIndex].description}
            </p>
          </MotionDiv>
        </AnimatePresence>

        <div className="flex items-center gap-3 mb-12">
          {steps.map((_, i) => (
            <div 
              key={i} 
              className={`h-1.5 rounded-full transition-all duration-700 ${i === currentIndex ? 'w-12 bg-[#ff0000] shadow-[0_0_15px_rgba(255,0,0,0.8)]' : 'w-3 bg-white/5'}`} 
            />
          ))}
        </div>

        <div className="flex items-center gap-6 w-full max-w-md">
          {currentIndex > 0 && (
            <button 
              onClick={prev}
              className="p-5 rounded-full bg-white/5 text-white/40 hover:text-white transition-all border border-white/10 hover:bg-white/10 active:scale-90"
            >
              {isRTL ? <ChevronRight size={28} /> : <ChevronLeft size={28} />}
            </button>
          )}
          
          <button 
            onClick={next}
            className="flex-1 bg-white text-black py-6 rounded-[2.5rem] font-black text-sm uppercase tracking-[0.4em] shadow-[0_20px_40px_rgba(0,0,0,0.4)] hover:bg-[#ff0000] hover:text-white transition-all active:scale-95 relative overflow-hidden group"
          >
            <span className="relative z-10">
              {isLastStep ? (lang === 'ar' ? 'ابدأ الرحلة' : 'Begin Journey') : (lang === 'ar' ? 'التالي' : 'Next')}
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
          </button>
        </div>
      </div>
    </MotionDiv>
  );
};
