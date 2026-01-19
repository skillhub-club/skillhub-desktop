import { useState } from 'react'
import { ExternalLink, Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { setLanguage, getLanguage } from '../i18n'

export default function Settings() {
  const { t } = useTranslation()
  const [currentLang, setCurrentLang] = useState(getLanguage())

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang)
    setCurrentLang(lang)
  }

  return (
    <div className="p-6 max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2 tracking-tight">{t('settings.title').toUpperCase()}</h1>
        <p className="text-muted-foreground">{t('settings.subtitle')}</p>
      </div>

      {/* Language Selection */}
      <section className="mb-8">
        <h2 className="swiss-label mb-4">{t('settings.language')}</h2>
        <div className="card p-4">
          <div className="flex items-center gap-3 mb-3">
            <Globe size={20} className="text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('settings.languageDescription')}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleLanguageChange('en')}
              className={`px-4 py-2 text-sm font-bold uppercase tracking-wider transition-all border-2 ${
                currentLang === 'en'
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-background text-foreground border-border-light hover:border-foreground'
              }`}
            >
              {t('settings.english')}
            </button>
            <button
              onClick={() => handleLanguageChange('zh')}
              className={`px-4 py-2 text-sm font-bold uppercase tracking-wider transition-all border-2 ${
                currentLang === 'zh'
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-background text-foreground border-border-light hover:border-foreground'
              }`}
            >
              {t('settings.chinese')}
            </button>
          </div>
        </div>
      </section>

      {/* About */}
      <section className="mb-8">
        <h2 className="swiss-label mb-4">{t('settings.about')}</h2>
        <div className="card p-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-foreground flex items-center justify-center">
              <span className="text-background font-bold text-xl">SH</span>
            </div>
            <div>
              <h3 className="font-bold text-foreground">SkillHub Desktop</h3>
              <p className="text-sm text-muted-foreground uppercase tracking-wider">{t('settings.version')} 0.1.0</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            {t('settings.aboutDescription')}
          </p>

          <div className="flex gap-4">
            <a
              href="https://www.skillhub.club"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm font-semibold text-foreground underline underline-offset-4 decoration-2 hover:decoration-4 transition-all"
            >
              <ExternalLink size={14} />
              {t('settings.visitSkillHub')}
            </a>
            <a
              href="https://github.com/anthropics/skillhub"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm font-semibold text-foreground underline underline-offset-4 decoration-2 hover:decoration-4 transition-all"
            >
              <ExternalLink size={14} />
              {t('settings.github')}
            </a>
          </div>
        </div>
      </section>

      {/* Keyboard Shortcuts */}
      <section>
        <h2 className="swiss-label mb-4">{t('settings.keyboardShortcuts')}</h2>
        <div className="card p-4">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">{t('settings.searchSkills')}</span>
              <kbd className="px-3 py-1.5 bg-foreground text-background text-xs font-bold tracking-wider">⌘ + K</kbd>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">{t('settings.refreshToolsShortcut')}</span>
              <kbd className="px-3 py-1.5 bg-foreground text-background text-xs font-bold tracking-wider">⌘ + R</kbd>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">{t('settings.settingsShortcut')}</span>
              <kbd className="px-3 py-1.5 bg-foreground text-background text-xs font-bold tracking-wider">⌘ + ,</kbd>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
