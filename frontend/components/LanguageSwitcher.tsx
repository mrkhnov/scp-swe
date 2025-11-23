import React from 'react';
import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const changeLanguage = (e: React.ChangeEvent<HTMLSelectElement>) => {
    i18n.changeLanguage(e.target.value);
  };

  return (
    <div className="relative inline-block">
      <select
        value={i18n.resolvedLanguage}
        onChange={changeLanguage}
        className="appearance-none bg-white/50 backdrop-blur-sm border border-system-border rounded-lg py-1.5 pl-3 pr-8 text-xs font-medium text-system-text hover:border-system-blue focus:outline-none focus:ring-2 focus:ring-system-blue/20 transition-all cursor-pointer"
      >
        <option value="en">English</option>
        <option value="ru">Русский</option>
        <option value="kk">Қазақша</option>
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-system-textSec">
        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}
