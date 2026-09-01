import { create } from 'zustand';
import { getBackendApiRoot, getTenantHeaders } from '@/lib/runtime-context';

interface TranslationState {
  locale: string;
  dictionary: Record<string, string>;
  isReady: boolean;
  initLocale: () => Promise<void>;
  setLocale: (newLocale: string) => Promise<void>;
  t: (key: string, fallback?: string, replacements?: Record<string, any>) => string;
}

const getApiUrl = (endpoint: string) => `${getBackendApiRoot()}${endpoint}`;

export const useTranslation = create<TranslationState>((set, get) => ({
  locale: 'en',
  dictionary: {},
  isReady: false,

  initLocale: async () => {
    const savedLocale = typeof window !== 'undefined' ? localStorage.getItem('hive_locale') || 'en' : 'en';
    await get().setLocale(savedLocale);
  },

  setLocale: async (newLocale: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('hive_locale', newLocale);
    }

    try {
      const res = await fetch(getApiUrl(`/translations/${newLocale}`), {
        headers: {
          'Accept': 'application/json',
          ...getTenantHeaders()
        }
      });

      if (res.ok) {
        const data = await res.json();
        const cleanDictionary = data.data || data || {};
        set({ locale: newLocale, dictionary: cleanDictionary, isReady: true });
      } else {
        set({ locale: newLocale, isReady: true });
      }
    } catch (err) {
      console.error("Failed to load dictionary:", err);
      set({ locale: newLocale, isReady: true });
    }
  },

  t: (key: string, fallback?: string, replacements?: Record<string, any>) => {
    const { dictionary } = get();
    let text = dictionary[key];
    if (!text && key.startsWith('global.')) {
      text = dictionary[key.slice(7)];
    }
    if (!text && !key.includes('.')) {
      text = dictionary[`global.${key}`];
    }
    text = text || fallback || key;

    if (replacements) {
      // Sort keys by length descending so longer keys (e.g., 'total') are replaced before prefixes (e.g., 'to')
      Object.entries(replacements)
        .sort((a, b) => b[0].length - a[0].length)
        .forEach(([k, v]) => {
          text = text
            .replace(new RegExp(`:${k}\\b`, 'g'), String(v))
            .replace(new RegExp(`:${k}`, 'g'), String(v))
            .replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        });
    }

    return text;
  }
}));
