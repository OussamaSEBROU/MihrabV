import React from 'react';
import { motion } from 'framer-motion';
import { Language } from '../types';
import type { FlashCard } from '../types';
import { translations } from '../i18n/translations';
import { storageService } from '../services/storageService';
import { ChevronLeft, Layers, Calendar } from 'lucide-react';

// Using any to bypass motion property type errors
const MotionDiv = motion.div as any;

interface VaultProps {
  lang: Language;
  onBack: () => void;
}

export const Vault: React.FC<VaultProps> = ({ lang, onBack }) => {
  const t = translations[lang];
  const cards = storageService.getCards();

  return (
    <div className="min-h-[80vh] py-12">
      <header className="flex items-center justify-between mb-12">
        <button onClick={onBack} className="p-2 hover:text-[#ff0000] transition-colors flex items-center gap-2">
          <ChevronLeft />
          <span className="font-bold text-sm tracking-widest uppercase">{t.backToShelf}</span>
        </button>
        <h2 className="text-3xl font-black italic uppercase tracking-tighter flex items-center gap-3">
          <Layers className="text-[#ff0000]" />
          {t.vault}
        </h2>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 perspective-1000">
        {cards.length === 0 ? (
          <div className="col-span-full text-center py-20 opacity-30">
            <Layers size={64} className="mx-auto mb-4" />
            <p className="text-xl">Your vault is empty. Highlight knowledge to store it.</p>
          </div>
        ) : (
          cards.map((card, idx) => (
            <MotionDiv
              key={card.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              whileHover={{ rotateY: 5, rotateX: 5 }}
              className="group relative h-[300px] preserve-3d transition-transform duration-500 cursor-pointer"
            >
              <div className="absolute inset-0 bg-[#001a00] border border-white/10 rounded-2xl p-6 flex flex-col justify-between overflow-hidden shadow-xl hover:shadow-[#ff0000]/10 transition-shadow">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#ff0000]/5 rounded-full blur-3xl -mr-10 -mt-10" />
                
                <p className={`line-clamp-6 text-lg italic ${lang === 'ar' ? 'text-right' : 'text-left'}`}>
                   "{card.content}"
                </p>

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5 opacity-50 group-hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-2 text-xs">
                    <Calendar size={14} />
                    {new Date(card.addedAt).toLocaleDateString()}
                  </div>
                  <div className="text-[10px] uppercase font-bold tracking-widest text-[#ff0000]">
                    Review Pending
                  </div>
                </div>
              </div>
            </MotionDiv>
          ))
        )}
      </div>
    </div>
  );
};