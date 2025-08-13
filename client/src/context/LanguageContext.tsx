import React, { createContext, useState, useContext, ReactNode } from 'react';
import { translations } from '../constants';
import { retrieveLaunchParams } from "@telegram-apps/sdk-react"

type Language = 'en' | 'ru';
type TranslateFunc = (key: keyof typeof translations.en) => string;

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: TranslateFunc;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const LaunchParams = retrieveLaunchParams();
    const language_code = LaunchParams.tgWebAppData?.user?.language_code as Language;
    
    const [language, setLanguage] = useState<Language>(language_code || 'en');
    const t: TranslateFunc = (key) => {
        return translations[language][key] || translations.en[key];
    };
    return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
        {children}
    </LanguageContext.Provider>
    );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
