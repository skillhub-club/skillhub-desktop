import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './en.json'
import zh from './zh.json'

// Get saved language or default to system language
function getDefaultLanguage(): string {
  const saved = localStorage.getItem('skillhub-language')
  if (saved) return saved

  // Check browser/system language
  const browserLang = navigator.language.toLowerCase()
  if (browserLang.startsWith('zh')) return 'zh'
  return 'en'
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    zh: { translation: zh },
  },
  lng: getDefaultLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false, // React already escapes
  },
})

// Save language preference
export function setLanguage(lang: string) {
  localStorage.setItem('skillhub-language', lang)
  i18n.changeLanguage(lang)
}

export function getLanguage(): string {
  return i18n.language
}

export default i18n
