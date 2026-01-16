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
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('settings.title')}</h1>
        <p className="text-gray-600">{t('settings.subtitle')}</p>
      </div>

      {/* Language Selection */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('settings.language')}</h2>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-3">
            <Globe size={20} className="text-gray-500" />
            <p className="text-sm text-gray-600">{t('settings.languageDescription')}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleLanguageChange('en')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentLang === 'en'
                  ? 'bg-primary-100 text-primary-700 border-2 border-primary-500'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-transparent'
              }`}
            >
              {t('settings.english')}
            </button>
            <button
              onClick={() => handleLanguageChange('zh')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentLang === 'zh'
                  ? 'bg-primary-100 text-primary-700 border-2 border-primary-500'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-transparent'
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
          <h2 className="text-lg font-semibold text-gray-900">{t('settings.detectedTools')}</h2>
          <button
            onClick={handleRefreshTools}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            {t('settings.refreshTools')}
          </button>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
          {tools.map(tool => (
            <div key={tool.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{tool.name}</span>
                  {tool.installed ? (
                    <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                      {t('settings.installed')}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-500 rounded">
                      {t('settings.notFound')}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">{tool.config_path}</p>
              </div>

              {tool.installed && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setExploringTool(tool)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-50 rounded-lg"
                  >
                    <Eye size={16} />
                    {t('settings.viewSkills')}
                  </button>
                  <button
                    onClick={() => openFolder(tool.skills_path)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
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
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('settings.about')}</h2>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
              <span className="text-primary-600 font-bold text-xl">SH</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">SkillHub Desktop</h3>
              <p className="text-sm text-gray-500">{t('settings.version')} 0.1.0</p>
            </div>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            {t('settings.aboutDescription')}
          </p>

          <div className="flex gap-4">
            <a
              href="https://skillhub.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-primary-600 hover:underline"
            >
              <ExternalLink size={14} />
              {t('settings.visitSkillHub')}
            </a>
            <a
              href="https://github.com/anthropics/skillhub"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-primary-600 hover:underline"
            >
              <ExternalLink size={14} />
              {t('settings.github')}
            </a>
          </div>
        </div>
      </section>

      {/* Keyboard Shortcuts */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('settings.keyboardShortcuts')}</h2>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">{t('settings.searchSkills')}</span>
              <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">⌘ + K</kbd>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t('settings.refreshToolsShortcut')}</span>
              <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">⌘ + R</kbd>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t('settings.settingsShortcut')}</span>
              <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">⌘ + ,</kbd>
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
