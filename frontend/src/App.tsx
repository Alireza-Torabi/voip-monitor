import { useEffect, useState } from 'react';
import { messages, type Language } from './i18n.js';

export function App({ initialLanguage = 'en' }: { initialLanguage?: Language }) {
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const direction = language === 'fa' ? 'rtl' : 'ltr';
  const text = messages[language];

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = direction;
  }, [language, direction]);

  return (
    <main dir={direction} lang={language}>
      <header>
        <h1>{text.title}</h1>
        <button
          type="button"
          onClick={() => setLanguage(language === 'en' ? 'fa' : 'en')}
          aria-label={language === 'en' ? 'Switch to Persian' : 'تغییر زبان به انگلیسی'}
        >
          {text.switchLanguage}
        </button>
      </header>
      <section aria-label={text.stage}>
        <h2>{text.stage}</h2>
        <p>{text.description}</p>
      </section>
    </main>
  );
}
