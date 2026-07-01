import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';


import en from './en.json';
import es from './es.json';
import fr from './fr.json';
import de from './de.json';
import ja from './ja.json';
import pt from './pt.json';
import it from './it.json';
import ko from './ko.json';
import zh from './zh.json';
import ru from './ru.json';
import ar from './ar.json';
import hi from './hi.json';
import tr from './tr.json';
import pl from './pl.json';
import nl from './nl.json';
import sv from './sv.json';
import th from './th.json';
import vi from './vi.json';
import id from './id.json';
import uk from './uk.json';
import ta from './ta.json';


i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
      fr: { translation: fr },
      de: { translation: de },
      ja: { translation: ja },
      pt: { translation: pt },
      it: { translation: it },
      ko: { translation: ko },
      zh: { translation: zh },
      ru: { translation: ru },
      ar: { translation: ar },
      hi: { translation: hi },
      tr: { translation: tr },
      pl: { translation: pl },
      nl: { translation: nl },
      sv: { translation: sv },
      th: { translation: th },
      vi: { translation: vi },
      id: { translation: id },
      uk: { translation: uk },
      ta: { translation: ta },

    },
    lng: 'en', 
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, 
    },
  });

export default i18n;
