import { Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import { Search, Package, RefreshCw, Settings, Heart, Folder, PlusCircle, ExternalLink, Store, Play, PanelLeftClose } from 'lucide-react'
import { open } from '@tauri-apps/plugin-shell'
import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from './store'
import { detectTools } from './api/skillhub'


import Discover from './pages/Discover'
import Installed from './pages/Installed'
import Playground from './pages/Playground'
import Sync from './pages/Sync'
import SettingsPage from './pages/Settings'
import Favorites from './pages/Favorites'
import Collections from './pages/Collections'
import CreateSkill from './pages/CreateSkill'
import Marketplace from './pages/Marketplace'
import Toast from './components/Toast'
import UserMenu from './components/UserMenu'
import SearchDialog from './components/SearchDialog'
import { UpdateChecker } from './components/UpdateChecker'
import Logo from './components/Logo'

const getNavItems = (t: (key: string) => string) => [
  { path: '/', icon: Search, label: t('nav.discover') },
  { path: '/marketplace', icon: Store, label: t('nav.marketplace') },
  { path: '/create', icon: PlusCircle, label: t('nav.create') },
  { path: '/favorites', icon: Heart, label: t('nav.favorites'), authRequired: true },
  { path: '/collections', icon: Folder, label: t('nav.collections'), authRequired: true },
  { path: '/installed', icon: Package, label: t('nav.skillsManager') },
  { path: '/playground', icon: Play, label: t('nav.playground') },
  { path: '/sync', icon: RefreshCw, label: t('nav.sync') },
  { path: '/settings', icon: Settings, label: t('nav.settings') },
]

function App() {
  const { setTools, toast, hideToast, toastMessage, setToastMessage, isAuthenticated } = useAppStore()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [showSearchDialog, setShowSearchDialog] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    // Persist sidebar state in localStorage
    const saved = localStorage.getItem('skillhub_sidebar_collapsed')
    return saved === 'true'
  })

  // Save sidebar state to localStorage
  useEffect(() => {
    localStorage.setItem('skillhub_sidebar_collapsed', String(sidebarCollapsed))
  }, [sidebarCollapsed])

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

  const navItems = getNavItems(t)
  const visibleNavItems = navItems.filter(
    item => !item.authRequired || isAuthenticated
  )

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar - Swiss Design with collapse support */}
      <aside className={`${sidebarCollapsed ? 'w-14' : 'w-56'} bg-secondary border-r-2 border-foreground flex flex-col transition-all duration-200`}>
        {/* Header */}
        <div className="border-b-2 border-foreground">
          {sidebarCollapsed ? (
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="w-full p-3 flex items-center justify-center hover:bg-background transition-colors"
              title={t('nav.expandSidebar')}
            >
              <Logo size="sm" />
            </button>
          ) : (
            <div className="flex items-center">
              <button
                onClick={() => open('https://www.skillhub.club')}
                className="flex-1 p-4 text-left hover:bg-background transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <Logo size="md" />
                  <div className="flex items-center gap-2">
                    <div>
                      <h1 className="text-xl font-bold text-foreground tracking-tight group-hover:underline">SKILLHUB</h1>
                      <p className="text-xs text-muted-foreground uppercase tracking-widest">Desktop</p>
                    </div>
                    <ExternalLink size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </button>
              <button
              onClick={() => setSidebarCollapsed(true)}
              className="p-3 text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
              title={t('nav.collapseSidebar')}
            >
                <PanelLeftClose size={18} />
              </button>
            </div>
          )}
        </div>

        <nav className={`flex-1 ${sidebarCollapsed ? 'p-1' : 'p-2'}`}>
          {visibleNavItems.map(({ path, icon: Icon, label }) => (
            <NavLink
              key={path}
              to={path}
              title={sidebarCollapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center ${sidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5'} mb-1 transition-all border-2 ${
                  isActive
                    ? 'bg-foreground text-background border-foreground'
                    : 'text-foreground border-transparent hover:bg-background hover:border-foreground'
                }`
              }
            >
              <Icon size={18} />
              {!sidebarCollapsed && (
                <span className="font-semibold text-sm uppercase tracking-wide">{label}</span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User Menu */}
        <div className={`${sidebarCollapsed ? 'p-1' : 'p-2'} border-t-2 border-foreground`}>
          <UserMenu collapsed={sidebarCollapsed} />
        </div>

        {!sidebarCollapsed && (
          <div className="px-4 py-2 border-t border-border-light">
            <p className="text-xs text-muted-foreground text-center uppercase tracking-widest">v{__APP_VERSION__}</p>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-background">
        <Routes>
          <Route path="/" element={<Discover />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/create" element={<CreateSkill />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/collections" element={<Collections />} />
          <Route path="/installed" element={<Installed />} />
          <Route path="/playground" element={<Playground />} />
          <Route path="/sync" element={<Sync />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          actionLabel={toast.actionLabel}
          onAction={toast.onAction}
          duration={toast.duration}
          onClose={hideToast}
        />
      )}
      {toastMessage && (
        <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      )}

      {/* Search Dialog (⌘+K) */}
      <SearchDialog
        open={showSearchDialog}
        onClose={() => setShowSearchDialog(false)}
      />

      {/* Auto Update Checker */}
      <UpdateChecker />
    </div>
  )
}

export default App
