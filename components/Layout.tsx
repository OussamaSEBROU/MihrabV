
import React, { ReactNode } from 'react';
import { Language } from '../types';

interface LayoutProps {
  children: ReactNode;
  lang: Language;
}

export const Layout: React.FC<LayoutProps> = ({ children, lang }) => {
  return (
    <div 
      className={`min-h-screen bg-[#000a00] text-white selection:bg-[#ff0000] selection:text-white ${lang === 'ar' ? 'rtl' : 'ltr'}`}
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="relative">
        {children}
      </div>
    </div>
  );
};
