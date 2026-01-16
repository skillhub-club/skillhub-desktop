import { Routes, Route, NavLink } from 'react-router-dom'
import { Search, Package, RefreshCw, Settings, Heart, Folder, PlusCircle } from 'lucide-react'
import { useEffect } from 'react'
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

const navItems = [
  { path: '/', icon: Search, label: 'Discover' },
  { path: '/create', icon: PlusCircle, label: 'Create' },
  { path: '/favorites', icon: Heart, label: 'Favorites', authRequired: true },
  { path: '/collections', icon: Folder, label: 'Collections', authRequired: true },
  { path: '/installed', icon: Package, label: 'Installed' },
  { path: '/sync', icon: RefreshCw, label: 'Sync' },
  { path: '/settings', icon: Settings, label: 'Settings' },
]

function App() {
  const { setTools, toastMessage, setToastMessage, isAuthenticated } = useAppStore()

  useEffect(() => {
    // Detect tools on startup
    detectTools().then(setTools).catch(console.error)
  }, [setTools])

  const visibleNavItems = navItems.filter(
    item => !item.authRequired || isAuthenticated
  )

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-primary-600">SkillHub</h1>
          <p className="text-xs text-gray-500">Desktop Manager</p>
        </div>

        <nav className="flex-1 p-2">
          {visibleNavItems.map(({ path, icon: Icon, label }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg mb-1 transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              <Icon size={18} />
              <span className="font-medium">{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User Menu */}
        <div className="p-2 border-t border-gray-200">
          <UserMenu />
        </div>

        <div className="px-4 py-2">
          <p className="text-xs text-gray-400 text-center">v0.1.0</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
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
    </div>
  )
}

export default App
