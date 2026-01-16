import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X, Loader2, ArrowRight, Settings, RefreshCw, Heart, Folder, PlusCircle, Package } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store'
import { searchSkills } from '../api/skillhub'
import type { SkillHubSkill } from '../types'

interface SearchDialogProps {
  open: boolean
  onClose: () => void
}

const QUICK_ACTIONS = [
  { id: 'discover', path: '/', icon: Search, labelKey: 'nav.discover' },
  { id: 'create', path: '/create', icon: PlusCircle, labelKey: 'nav.create' },
  { id: 'favorites', path: '/favorites', icon: Heart, labelKey: 'nav.favorites', authRequired: true },
  { id: 'collections', path: '/collections', icon: Folder, labelKey: 'nav.collections', authRequired: true },
  { id: 'installed', path: '/installed', icon: Package, labelKey: 'nav.installed' },
  { id: 'sync', path: '/sync', icon: RefreshCw, labelKey: 'nav.sync' },
  { id: 'settings', path: '/settings', icon: Settings, labelKey: 'nav.settings' },
]

export default function SearchDialog({ open, onClose }: SearchDialogProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isAuthenticated, setSearchQuery } = useAppStore()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SkillHubSkill[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Search when query changes
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setSelectedIndex(0)
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const skills = await searchSkills(query, 5)
        setResults(skills)
        setSelectedIndex(0)
      } catch (error) {
        console.error('Search failed:', error)
      } finally {
        setLoading(false)
      }
    }, 200)

    return () => clearTimeout(timer)
  }, [query])

  // Filter quick actions based on auth
  const visibleActions = QUICK_ACTIONS.filter(
    action => !action.authRequired || isAuthenticated
  )

  // Combined items for keyboard navigation
  const allItems = query.trim()
    ? results.map(skill => ({ type: 'skill' as const, skill }))
    : visibleActions.map(action => ({ type: 'action' as const, action }))

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, allItems.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (allItems[selectedIndex]) {
          const item = allItems[selectedIndex]
          if (item.type === 'action') {
            navigate(item.action.path)
            onClose()
          } else if (item.type === 'skill') {
            // Navigate to discover with search query
            setSearchQuery(query)
            navigate('/')
            onClose()
          }
        } else if (query.trim()) {
          // Just search
          setSearchQuery(query)
          navigate('/')
          onClose()
        }
        break
      case 'Escape':
        onClose()
        break
    }
  }, [allItems, selectedIndex, navigate, onClose, query, setSearchQuery])

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[15vh] z-50">
      <div
        className="bg-background border-2 border-foreground w-full max-w-xl mx-4 overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b-2 border-foreground">
          <Search className="text-muted-foreground" size={20} />
          <input
            ref={inputRef}
            type="text"
            placeholder={t('common.search') + '...'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 outline-none text-lg bg-transparent"
          />
          {loading && <Loader2 className="animate-spin text-muted-foreground" size={18} />}
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {query.trim() ? (
            // Skill Search Results
            <div className="py-2">
              {results.length === 0 && !loading ? (
                <div className="px-4 py-8 text-center text-muted-foreground">
                  {t('common.search')} "{query}"
                  <p className="text-sm mt-1">{t('searchDialog.pressEnter')}</p>
                </div>
              ) : (
                results.map((skill, index) => (
                  <button
                    key={skill.id}
                    onClick={() => {
                      setSearchQuery(query)
                      navigate('/')
                      onClose()
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all border-l-4 ${
                      index === selectedIndex ? 'bg-secondary border-foreground' : 'border-transparent hover:bg-secondary'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="font-bold text-foreground">{skill.name}</div>
                      <div className="text-sm text-muted-foreground line-clamp-1">
                        {skill.description}
                      </div>
                    </div>
                    <ArrowRight size={16} className="text-muted-foreground" />
                  </button>
                ))
              )}
            </div>
          ) : (
            // Quick Actions
            <div className="py-2">
              <div className="px-4 py-2 swiss-label">
                {t('searchDialog.quickActions')}
              </div>
              {visibleActions.map((action, index) => {
                const Icon = action.icon
                return (
                  <button
                    key={action.id}
                    onClick={() => {
                      navigate(action.path)
                      onClose()
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all border-l-4 ${
                      index === selectedIndex ? 'bg-secondary border-foreground' : 'border-transparent hover:bg-secondary'
                    }`}
                  >
                    <Icon size={18} className="text-muted-foreground" />
                    <span className="flex-1 font-semibold text-foreground uppercase tracking-wide text-sm">
                      {t(action.labelKey)}
                    </span>
                    <ArrowRight size={16} className="text-muted-foreground" />
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer with keyboard hints */}
        <div className="px-4 py-2 border-t-2 border-foreground bg-secondary flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>
              <kbd className="px-1.5 py-0.5 bg-foreground text-background text-[10px] font-bold">↑↓</kbd> {t('searchDialog.navigate')}
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-foreground text-background text-[10px] font-bold">↵</kbd> {t('searchDialog.select')}
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-foreground text-background text-[10px] font-bold">esc</kbd> {t('searchDialog.close')}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
