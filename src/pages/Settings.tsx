import { useState } from 'react'
import { FolderOpen, ExternalLink, RefreshCw, Eye, Globe } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store'
import { detectTools } from '../api/skillhub'
import SkillsExplorer from '../components/SkillsExplorer'
import { setLanguage, getLanguage } from '../i18n'
import type { DetectedTool } from '../types'

export default function Settings() {
  const { tools, setTools, setToastMessage } = useAppStore()
  const { t } = useTranslation()

  const [refreshing, setRefreshing] = useState(false)
  const [exploringTool, setExploringTool] = useState<DetectedTool | null>(null)
  const [currentLang, setCurrentLang] = useState(getLanguage())

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang)
    setCurrentLang(lang)
  }

  const handleRefreshTools = async () => {
    setRefreshing(true)
    try {
      const newTools = await detectTools()
      setTools(newTools)
    } catch (error) {
      console.error('Failed to refresh tools:', error)
    } finally {
      setRefreshing(false)
    }
  }

  const openFolder = async (path: string) => {
    try {
      await invoke('open_folder', { path })
    } catch (error) {
      console.error('Failed to open folder:', error)
      setToastMessage('Failed to open folder')
    }
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

      {/* Detected Tools */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="swiss-label">{t('settings.detectedTools')}</h2>
          <button
            onClick={handleRefreshTools}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold uppercase tracking-wider text-foreground hover:bg-secondary border-2 border-transparent hover:border-foreground"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            {t('settings.refreshTools')}
          </button>
        </div>

        <div className="card divide-y divide-border-light">
          {tools.map(tool => (
            <div key={tool.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground">{tool.name}</span>
                  {tool.installed ? (
                    <span className="px-2 py-0.5 text-xs font-bold uppercase tracking-wider bg-foreground text-background">
                      {t('settings.installed')}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-xs font-bold uppercase tracking-wider bg-muted text-muted-foreground">
                      {t('settings.notFound')}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1 font-mono">{tool.config_path}</p>
              </div>

              {tool.installed && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setExploringTool(tool)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold uppercase tracking-wider text-foreground hover:bg-secondary border-2 border-transparent hover:border-foreground"
                  >
                    <Eye size={16} />
                    {t('settings.viewSkills')}
                  </button>
                  <button
                    onClick={() => openFolder(tool.skills_path)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold uppercase tracking-wider text-foreground hover:bg-secondary border-2 border-transparent hover:border-foreground"
                  >
                    <FolderOpen size={16} />
                    {t('settings.openFolder')}
                  </button>
                </div>
              )}
            </div>
          ))}
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
              href="https://skillhub.dev"
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

      {/* Skills Explorer Modal */}
      {exploringTool && (
        <SkillsExplorer
          tool={exploringTool}
          onClose={() => setExploringTool(null)}
        />
      )}
    </div>
  )
}
