import { useState } from 'react'
import { LogIn, LogOut, User, Heart, ChevronDown } from 'lucide-react'
import { open } from '@tauri-apps/plugin-shell'
import { useAppStore } from '../store'
import { exchangeCodeForTokens, SKILLHUB_URL } from '../api/auth'

export default function UserMenu() {
  const { isAuthenticated, user, login, logout, setToastMessage, setFavorites, setCollections } = useAppStore()
  const [showMenu, setShowMenu] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [loginCode, setLoginCode] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  const handleLoginClick = async () => {
    // Open browser for GitHub OAuth
    const authUrl = `${SKILLHUB_URL}/web/auth/signin?callback=desktop`
    try {
      await open(authUrl)
      setShowLoginModal(true)
    } catch (error) {
      console.error('Failed to open browser:', error)
      setToastMessage('Failed to open browser for login')
    }
  }

  const handleCodeSubmit = async () => {
    if (!loginCode.trim()) return

    setIsLoggingIn(true)
    try {
      // Exchange code for tokens
      const tokens = await exchangeCodeForTokens(loginCode.trim())

      // Calculate expiry timestamp
      const expiresAt = Date.now() + tokens.expiresIn * 1000

      // Get user info (using token directly since we're not logged in yet)
      const userResponse = await fetch(`${SKILLHUB_URL}/api/v1/oauth/userinfo`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      })

      if (!userResponse.ok) {
        throw new Error('Failed to get user info')
      }

      const userData = await userResponse.json()

      // Login with tokens (including refresh token)
      login(userData, {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt,
      })

      // Fetch favorites and collections in parallel
      const [favoritesRes, collectionsRes] = await Promise.all([
        fetch(`${SKILLHUB_URL}/api/v1/oauth/favorites`, {
          headers: { Authorization: `Bearer ${tokens.accessToken}` },
        }),
        fetch(`${SKILLHUB_URL}/api/v1/oauth/collections`, {
          headers: { Authorization: `Bearer ${tokens.accessToken}` },
        }),
      ])

      if (favoritesRes.ok) {
        const favData = await favoritesRes.json()
        setFavorites(favData.favorites || [])
      }

      if (collectionsRes.ok) {
        const collData = await collectionsRes.json()
        setCollections(collData.collections || [])
      }

      setShowLoginModal(false)
      setLoginCode('')
      setToastMessage(`Welcome, ${userData.name || userData.github_username}!`)
    } catch (error) {
      console.error('Login failed:', error)
      setToastMessage('Login failed. Please try again.')
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handleLogout = () => {
    logout()
    setShowMenu(false)
    setToastMessage('Logged out successfully')
  }

  if (!isAuthenticated) {
    return (
      <>
        <button
          onClick={handleLoginClick}
          className="flex items-center gap-2 w-full px-3 py-2.5 text-sm font-semibold uppercase tracking-wider text-foreground hover:bg-background border-2 border-transparent hover:border-foreground transition-all"
        >
          <LogIn size={18} />
          <span>Sign in</span>
        </button>

        {/* Login Modal */}
        {showLoginModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-background border-2 border-foreground p-6 w-full max-w-sm mx-4">
              <h2 className="text-xl font-bold mb-2 tracking-tight">SIGN IN</h2>
              <p className="text-muted-foreground text-sm mb-4">
                A browser window has opened. After signing in, enter the code shown:
              </p>

              <input
                type="text"
                placeholder="Enter code"
                value={loginCode}
                onChange={(e) => setLoginCode(e.target.value)}
                className="input text-center text-2xl font-mono tracking-widest mb-4"
                maxLength={8}
              />

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowLoginModal(false)
                    setLoginCode('')
                  }}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCodeSubmit}
                  disabled={isLoggingIn || !loginCode.trim()}
                  className="btn btn-primary flex-1 disabled:opacity-50"
                >
                  {isLoggingIn ? 'Signing in...' : 'Sign in'}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 w-full px-3 py-2 hover:bg-background border-2 border-transparent hover:border-foreground transition-all"
      >
        {user?.avatar_url ? (
          <img src={user.avatar_url} alt="" className="w-8 h-8" />
        ) : (
          <div className="w-8 h-8 bg-foreground flex items-center justify-center">
            <User size={16} className="text-background" />
          </div>
        )}
        <div className="flex-1 text-left">
          <p className="text-sm font-bold text-foreground truncate">
            {user?.name || user?.github_username || 'User'}
          </p>
        </div>
        <ChevronDown size={16} className="text-muted-foreground" />
      </button>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute bottom-full left-0 right-0 mb-1 bg-background border-2 border-foreground z-50">
            <a
              href={`${SKILLHUB_URL}/app/favorites`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 text-sm font-semibold uppercase tracking-wider text-foreground hover:bg-secondary"
              onClick={() => setShowMenu(false)}
            >
              <Heart size={16} />
              My Favorites
            </a>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm font-semibold uppercase tracking-wider text-red-600 hover:bg-red-50"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  )
}
