import { Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import { Search, Package, RefreshCw, Settings, Heart, Folder, PlusCircle, ExternalLink } from 'lucide-react'
import { open } from '@tauri-apps/plugin-shell'
import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from './store'
import { detectTools } from './api/skillhub'

import Discover from './pages/Discover'
import Installed from './pages/Installed'
import Sync from './pages/Sync'
import SettingsPage from './pages/Settings'
import Favorites from './pages/Favorites'
import Collections from './pages/Collections'
import CreateSkill from './pages/CreateSkill'
import Toast from './components/Toast'
import UserMenu from './components/UserMenu'
import SearchDialog from './components/SearchDialog'

const navItems = [
  { path: '/', icon: Search, label: 'Discover' },
  { path: '/create', icon: PlusCircle, label: 'Create' },
  { path: '/favorites', icon: Heart, label: 'Favorites', authRequired: true },
  { path: '/collections', icon: Folder, label: 'Collections', authRequired: true },
  { path: '/installed', icon: Package, label: 'Skills Manager' },
  { path: '/sync', icon: RefreshCw, label: 'Sync' },
  { path: '/settings', icon: Settings, label: 'Settings' },
]

function App() {
  const { setTools, toastMessage, setToastMessage, isAuthenticated } = useAppStore()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [showSearchDialog, setShowSearchDialog] = useState(false)

  useEffect(() => {
    // Detect tools on startup
    detectTools().then(setTools).catch(console.error)
  }, [setTools])

  // Refresh tools handler
  const handleRefreshTools = useCallback(async () => {
    try {
      const newTools = await detectTools()
      setTools(newTools)
      setToastMessage(t('settings.refreshTools') + ' ✓')
    } catch (error) {
      console.error('Failed to refresh tools:', error)
    }
  }, [setTools, setToastMessage, t])

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for ⌘ (Mac) or Ctrl (Windows/Linux)
      const isMod = e.metaKey || e.ctrlKey

      if (isMod && e.key === 'k') {
        e.preventDefault()
        setShowSearchDialog(true)
      } else if (isMod && e.key === 'r') {
        e.preventDefault()
        handleRefreshTools()
      } else if (isMod && e.key === ',') {
        e.preventDefault()
        navigate('/settings')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate, handleRefreshTools])

  const visibleNavItems = navItems.filter(
    item => !item.authRequired || isAuthenticated
  )

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar - Swiss Design */}
      <aside className="w-56 bg-secondary border-r-2 border-foreground flex flex-col">
        <button
          onClick={() => open('https://www.skillhub.club')}
          className="w-full p-4 border-b-2 border-foreground text-left hover:bg-background transition-colors group"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight group-hover:underline">SKILLHUB</h1>
              <p className="text-xs text-muted-foreground uppercase tracking-widest">Desktop</p>
            </div>
            <ExternalLink size={16} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </button>

        <nav className="flex-1 p-2">
          {visibleNavItems.map(({ path, icon: Icon, label }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 mb-1 transition-all border-2 ${
                  isActive
                    ? 'bg-foreground text-background border-foreground'
                    : 'text-foreground border-transparent hover:bg-background hover:border-foreground'
                }`
              }
            >
              <Icon size={18} />
              <span className="font-semibold text-sm uppercase tracking-wide">{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User Menu */}
        <div className="p-2 border-t-2 border-foreground">
          <UserMenu />
        </div>

        <div className="px-4 py-2 border-t border-border-light">
          <p className="text-xs text-muted-foreground text-center uppercase tracking-widest">v0.1.0</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-background">
        <Routes>
          <Route path="/" element={<Discover />} />
          <Route path="/create" element={<CreateSkill />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/collections" element={<Collections />} />
          <Route path="/installed" element={<Installed />} />
          <Route path="/sync" element={<Sync />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>

      {/* Toast */}
      {toastMessage && (
        <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      )}

      {/* Search Dialog (⌘+K) */}
      <SearchDialog
        open={showSearchDialog}
        onClose={() => setShowSearchDialog(false)}
      />
    </div>
  )
}

export default App
