import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { invoke } from '@tauri-apps/api/core'
import {
  User, CreditCard, BarChart3, Key, Palette,
  Sun, Moon, ExternalLink, LogIn, Plus, Copy,
  Check, Trash2, LogOut, AlertTriangle,
  Crown, Coins, Box, ChevronRight, Settings2, RefreshCw
} from 'lucide-react'
import { open } from '@tauri-apps/plugin-shell'
import { setLanguage, getLanguage } from '../i18n'
import { clearCache } from '../api/skillhub'
import { 
  exchangeCodeForTokens, 
  SKILLHUB_URL, 
  createApiKey,
  deleteApiKey,
} from '../api/auth'
import { useAppStore } from '../store'
import { SettingsSection, SettingsCard, SettingsRow } from '../components/settings'
import { useAccountCache } from '../hooks/useAccountCache'
import WebViewModal from '../components/WebViewModal'


// Types matching Rust backend
interface ClaudeCodeConfigStatus {
  base_url: string | null
  api_key_set: boolean
  api_key_preview: string | null
}

// Quota limits by tier
const QUOTA_LIMITS = { free: 2, pro: 50 }

// Settings subpage types
type SettingsSubpage = 'account' | 'subscription' | 'usage' | 'api-keys' | 'appearance'

interface NavItem {
  id: SettingsSubpage
  label: string
  icon: typeof User
  description: string
}

export default function Settings() {
  const { t } = useTranslation()
  const [currentLang, setCurrentLang] = useState(getLanguage())
  const [selectedPage, setSelectedPage] = useState<SettingsSubpage>('account')
  const { showToast, theme, setTheme, user, isAuthenticated, logout } = useAppStore()



  const navItems: NavItem[] = [
    { id: 'account', label: t('settingsNav.account'), icon: User, description: t('settingsNav.accountDesc') },
    { id: 'subscription', label: t('settingsNav.subscription'), icon: CreditCard, description: t('settingsNav.subscriptionDesc') },
    { id: 'usage', label: t('settingsNav.usage'), icon: BarChart3, description: t('settingsNav.usageDesc') },
    { id: 'api-keys', label: t('settingsNav.apiKeys'), icon: Key, description: t('settingsNav.apiKeysDesc') },
    { id: 'appearance', label: t('settingsNav.appearance'), icon: Palette, description: t('settingsNav.appearanceDesc') },
  ]

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang)
    setCurrentLang(lang)
  }

  const handleClearCache = () => {
    clearCache()
    showToast(t('settings.cacheCleared'), 'success')
  }

  const handleLogout = () => {
    logout()
    showToast(t('settings.loggedOut'), 'info')
  }



  const renderContent = () => {
    switch (selectedPage) {
      case 'account':
        return <AccountPage user={user} isAuthenticated={isAuthenticated} onLogout={handleLogout} t={t} />
      case 'subscription':
        return <SubscriptionPage t={t} />
      case 'usage':
        return <UsagePage t={t} />
      case 'api-keys':
        return <ApiKeysPage t={t} />
      case 'appearance':
        return (
          <AppearancePage
            theme={theme}
            setTheme={setTheme}
            currentLang={currentLang}
            onLanguageChange={handleLanguageChange}
            onClearCache={handleClearCache}
            t={t}
          />
        )
    }
  }

  return (
    <div className="flex h-full">
      {/* Left Navigation */}
      <div className="w-56 border-r-2 border-foreground flex flex-col bg-secondary">
        <div className="p-4 border-b-2 border-foreground">
          <h1 className="text-xl font-bold text-foreground tracking-tight">{t('settings.title')}</h1>
        </div>
        <nav className="flex-1 p-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            const isSelected = selectedPage === item.id
            return (
              <button
                key={item.id}
                onClick={() => setSelectedPage(item.id)}
                className={`w-full text-left px-3 py-2.5 mb-1 transition-all border-2 ${
                  isSelected
                    ? 'bg-foreground text-background border-foreground'
                    : 'text-foreground border-transparent hover:bg-background hover:border-foreground'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} />
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-sm uppercase tracking-wide">
                      {item.label}
                    </span>
                    <div className={`text-xs truncate ${isSelected ? 'text-background/70' : 'text-muted-foreground'}`}>
                      {item.description}
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </nav>
        
        {/* Version info at bottom */}
        <div className="p-4 border-t-2 border-foreground">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">
            v{__APP_VERSION__}
          </div>
        </div>
      </div>

      {/* Right Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-2xl">
          {renderContent()}
        </div>
      </div>
    </div>
  )
}

// ============================================
// Account Page
// ============================================

interface AccountPageProps {
  user: { name?: string; email?: string; github_username?: string; avatar_url?: string } | null
  isAuthenticated: boolean
  onLogout: () => void
  t: (key: string) => string
}

function AccountPage({ user, isAuthenticated, onLogout, t }: AccountPageProps) {
  const { login, showToast, setFavorites, setCollections } = useAppStore()
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [loginCode, setLoginCode] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  const handleLoginClick = async () => {
    const authUrl = `${SKILLHUB_URL}/web/auth/signin?callback=desktop`
    try {
      await open(authUrl)
      setShowLoginModal(true)
    } catch (error) {
      console.error('Failed to open browser:', error)
      showToast(t('settings.browserOpenFailed'), 'error')
    }
  }

  const handleCodeSubmit = async () => {
    if (!loginCode.trim()) return

    setIsLoggingIn(true)
    try {
      const tokens = await exchangeCodeForTokens(loginCode.trim())
      const expiresAt = Date.now() + tokens.expiresIn * 1000

      const userResponse = await fetch(`${SKILLHUB_URL}/api/v1/oauth/userinfo`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      })

      if (!userResponse.ok) {
        throw new Error('Failed to get user info')
      }

      const userData = await userResponse.json()

      login(userData, {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt,
      })

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
      showToast(`${t('settings.welcome')}, ${userData.name || userData.github_username}!`, 'success')
    } catch (error) {
      console.error('Login failed:', error)
      showToast(t('settings.loginFailed'), 'error')
    } finally {
      setIsLoggingIn(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground mb-2">{t('settingsNav.account')}</h2>
          <p className="text-sm text-muted-foreground">{t('settings.accountNotSignedIn')}</p>
        </div>
        
        <SettingsCard>
          <div className="p-6 text-center">
            <User size={48} className="mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold text-foreground mb-2">{t('settings.signInTitle')}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t('settings.signInDesc')}</p>
            <button
              onClick={handleLoginClick}
              className="inline-flex items-center gap-2 px-4 py-2 bg-foreground text-background font-semibold text-sm uppercase tracking-wide hover:opacity-90 transition-opacity border-2 border-foreground"
            >
              <LogIn size={16} />
              {t('common.login')}
            </button>
          </div>
        </SettingsCard>

        {/* Login Modal */}
        {showLoginModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-background border-2 border-foreground p-6 w-full max-w-sm mx-4">
              <h2 className="text-xl font-bold mb-2 tracking-tight uppercase">{t('settings.signInTitle')}</h2>
              <p className="text-muted-foreground text-sm mb-4">
                {t('settings.enterCodeDesc')}
              </p>

              <input
                type="text"
                placeholder={t('settings.enterCode')}
                value={loginCode}
                onChange={(e) => setLoginCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCodeSubmit()}
                className="w-full bg-background text-foreground text-center text-2xl font-mono tracking-widest px-4 py-3 border-2 border-foreground mb-4 focus:outline-none"
                maxLength={8}
                autoFocus
              />

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowLoginModal(false)
                    setLoginCode('')
                  }}
                  className="flex-1 px-4 py-2 border-2 border-foreground text-foreground font-semibold text-sm uppercase tracking-wide hover:bg-secondary transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleCodeSubmit}
                  disabled={isLoggingIn || !loginCode.trim()}
                  className="flex-1 px-4 py-2 bg-foreground text-background font-semibold text-sm uppercase tracking-wide hover:opacity-90 transition-opacity disabled:opacity-50 border-2 border-foreground"
                >
                  {isLoggingIn ? t('settings.signingIn') : t('common.login')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-2">{t('settingsNav.account')}</h2>
        <p className="text-sm text-muted-foreground">{t('settings.accountDesc')}</p>
      </div>

      <SettingsSection title={t('settings.profile')}>
        <SettingsCard>
          <div className="p-4 flex items-center gap-4">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-16 h-16 rounded-full" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
                <User size={24} className="text-muted-foreground" />
              </div>
            )}
            <div>
              <div className="text-lg font-semibold text-foreground">
                {user?.name || user?.github_username || 'User'}
              </div>
              <div className="text-sm text-muted-foreground">{user?.email}</div>
              {user?.github_username && (
                <div className="text-xs text-muted-foreground mt-1">@{user.github_username}</div>
              )}
            </div>
          </div>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title={t('settings.accountActions')}>
        <SettingsCard>
          <SettingsRow
            label={t('settings.viewOnSkillHub')}
            description={t('settings.viewOnSkillHubDesc')}
            action={
              <a
                href="https://skillhub.club/account"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
              >
                <ExternalLink size={16} />
              </a>
            }
          />
          <SettingsRow
            label={t('settings.signOut')}
            description={t('settings.signOutDesc')}
            onClick={onLogout}
            action={<LogOut size={16} className="text-muted-foreground" />}
          />
        </SettingsCard>
      </SettingsSection>
    </div>
  )
}

// ============================================
// Subscription Page (matches web billing page)
// ============================================

interface SubscriptionPageProps {
  t: (key: string) => string
}

function SubscriptionPage({ t }: SubscriptionPageProps) {
  const { isAuthenticated } = useAppStore()
  const { accountData, loading, loadAccountData } = useAccountCache()

  useEffect(() => {
    if (isAuthenticated) {
      loadAccountData()
    }
  }, [isAuthenticated, loadAccountData])

  const tier = accountData?.tier || 'free'
  const credits = accountData?.credits || 0
  const isPro = tier === 'pro'
  const dailyLimit = QUOTA_LIMITS[tier as keyof typeof QUOTA_LIMITS] || 2
  const dailyUsed = accountData?.dailyUsed || 0
  const dailyRemaining = Math.max(0, dailyLimit - dailyUsed)

  const PRO_FEATURES = [
    t('settings.proFeature1'),
    t('settings.proFeature2'),
    t('settings.proFeature3'),
    t('settings.proFeature4'),
  ]

  const handleUpgrade = async () => {
    // Open billing page in browser
    await open(`${SKILLHUB_URL}/web/account/billing`)
  }

  const handleManageSubscription = async () => {
    await open(`${SKILLHUB_URL}/web/account/billing`)
  }

  if (!isAuthenticated) {
    return (
      <div className="space-y-6">
        <div className="border-b-2 border-foreground pb-4">
          <h2 className="text-xl font-bold text-foreground">{t('settingsNav.subscription')}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t('settings.subscriptionDesc')}</p>
        </div>
        <div className="border-2 border-foreground p-6 text-center">
          <User size={48} className="mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground">{t('settings.signInToView')}</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="border-b-2 border-foreground pb-4">
          <h2 className="text-xl font-bold text-foreground">{t('settingsNav.subscription')}</h2>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-secondary" />
          <div className="h-24 bg-secondary" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b-2 border-foreground pb-4">
        <h2 className="text-xl font-bold text-foreground">{t('settingsNav.subscription')}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t('settings.subscriptionDesc')}</p>
      </div>

      {/* Quota Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Daily Quota */}
        <div className="border-2 border-foreground p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-500 flex items-center justify-center">
              <Box size={20} className="text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{t('settings.dailyQuota')}</p>
              <p className="text-xl font-bold text-foreground">{dailyRemaining}/{dailyLimit}</p>
            </div>
          </div>
          <div className="h-2 bg-secondary border border-foreground">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${(dailyUsed / dailyLimit) * 100}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">{t('settings.resetsDaily')}</p>
        </div>

        {/* Credits */}
        <div className="border-2 border-foreground p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-green-500 flex items-center justify-center">
              <Coins size={20} className="text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{t('settings.credits')}</p>
              <p className="text-xl font-bold text-foreground">{credits}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-2">{t('settings.neverExpire')}</p>
          <button
            onClick={() => open(`${SKILLHUB_URL}/web/account/billing`)}
            className="text-xs font-semibold uppercase tracking-wider text-foreground hover:underline flex items-center gap-1"
          >
            {t('settings.buyMore')} <ChevronRight size={12} />
          </button>
        </div>

        {/* Current Plan */}
        <div className="border-2 border-foreground p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 flex items-center justify-center ${isPro ? 'bg-amber-500' : 'bg-secondary'}`}>
              <Crown size={20} className={isPro ? 'text-white' : 'text-muted-foreground'} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{t('settings.plan')}</p>
              <p className="text-xl font-bold text-foreground uppercase">{tier}</p>
            </div>
          </div>
          {isPro ? (
            <p className="text-xs text-muted-foreground">
              {accountData?.subscriptionEnd
                ? `${t('settings.renewsOn')} ${new Date(accountData.subscriptionEnd).toLocaleDateString()}`
                : t('settings.activeSubscription')}
            </p>
          ) : (
            <button
              onClick={handleUpgrade}
              className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-1"
            >
              {t('settings.upgradeToProBtn')} <ChevronRight size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Current Plan Details */}
      <div className="border-2 border-foreground p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 flex items-center justify-center ${isPro ? 'bg-amber-500' : 'bg-secondary'}`}>
              <Crown size={24} className={isPro ? 'text-white' : 'text-muted-foreground'} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground uppercase">{isPro ? 'Pro' : 'Free'}</h3>
              {isPro ? (
                <p className="text-sm text-muted-foreground">{t('settings.activeSubscription')}</p>
              ) : (
                <p className="text-sm text-muted-foreground">{t('settings.freeQueries')}</p>
              )}
            </div>
          </div>
          {isPro ? (
            <button
              onClick={handleManageSubscription}
              className="px-6 py-3 border-2 border-foreground text-foreground font-semibold uppercase tracking-wider hover:bg-secondary transition flex items-center gap-2"
            >
              {t('settings.manageSubscription')}
              <ExternalLink size={14} />
            </button>
          ) : (
            <button
              onClick={handleUpgrade}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-white font-bold uppercase tracking-wider transition flex items-center gap-2"
            >
              {t('settings.upgradeToProBtn')} - $9.99/mo
              <ChevronRight size={14} />
            </button>
          )}
        </div>

        {/* Pro Features (for free users) */}
        {!isPro && (
          <div className="mt-6 pt-6 border-t border-foreground/20">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              {t('settings.proIncludes')}
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
              {PRO_FEATURES.map((feature, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm text-foreground">
                  <Check size={14} className="text-green-500" />
                  {feature}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================
// Usage Page (matches web account overview)
// ============================================

interface UsagePageProps {
  t: (key: string) => string
}

function UsagePage({ t }: UsagePageProps) {
  const { isAuthenticated } = useAppStore()
  const { accountData, loading, loadAccountData } = useAccountCache()

  useEffect(() => {
    if (isAuthenticated) {
      loadAccountData()
    }
  }, [isAuthenticated, loadAccountData])

  if (!isAuthenticated) {
    return (
      <div className="space-y-6">
        <div className="border-b-2 border-foreground pb-4">
          <h2 className="text-xl font-bold text-foreground">{t('settingsNav.usage')}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t('settings.usageDesc')}</p>
        </div>
        <div className="border-2 border-foreground p-6 text-center">
          <User size={48} className="mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground">{t('settings.signInToView')}</p>
        </div>
      </div>
    )
  }

  if (loading && !accountData) {
    return (
      <div className="space-y-6">
        <div className="border-b-2 border-foreground pb-4">
          <h2 className="text-xl font-bold text-foreground">{t('settingsNav.usage')}</h2>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-secondary" />
          <div className="h-48 bg-secondary" />
        </div>
      </div>
    )
  }

  const tier = accountData?.tier || 'free'
  const credits = accountData?.credits || 0
  const dailyLimit = QUOTA_LIMITS[tier as keyof typeof QUOTA_LIMITS] || 2
  const dailyUsed = accountData?.dailyUsed || 0
  const dailyRemaining = Math.max(0, dailyLimit - dailyUsed)
  const creditsUsedToday = accountData?.creditsUsedToday || 0
  const weeklyUsage = accountData?.weeklyUsage || []
  const weeklyTotal = weeklyUsage.reduce((sum, d) => sum + (d.count || 0) + (d.credits_used || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b-2 border-foreground pb-4">
        <h2 className="text-xl font-bold text-foreground">{t('settingsNav.usage')}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t('settings.usageDesc')}</p>
      </div>

      {/* Quota Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Daily Quota */}
        <div className="border-2 border-foreground p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-500 flex items-center justify-center">
              <Box size={20} className="text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{t('settings.dailyQuota')}</p>
              <p className="text-xl font-bold text-foreground">{dailyRemaining}/{dailyLimit}</p>
            </div>
          </div>
          <div className="h-2 bg-secondary border border-foreground">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${(dailyUsed / dailyLimit) * 100}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">{t('settings.resetsDaily')}</p>
        </div>

        {/* Credits */}
        <div className="border-2 border-foreground p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-green-500 flex items-center justify-center">
              <Coins size={20} className="text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{t('settings.credits')}</p>
              <p className="text-xl font-bold text-foreground">{credits}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {creditsUsedToday > 0 ? `${t('settings.usedToday')}: ${creditsUsedToday}` : t('settings.neverExpire')}
          </p>
        </div>

        {/* Weekly Total */}
        <div className="border-2 border-foreground p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-purple-500 flex items-center justify-center">
              <BarChart3 size={20} className="text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{t('settings.thisWeek')}</p>
              <p className="text-xl font-bold text-foreground">{weeklyTotal}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t('settings.totalQueries')}</p>
        </div>
      </div>

      {/* Weekly Usage Chart */}
      <div className="border-2 border-foreground p-6">
        <h3 className="text-sm font-bold uppercase tracking-wider text-foreground mb-4 flex items-center gap-2">
          <BarChart3 size={16} />
          {t('settings.weeklyUsage')}
        </h3>
        <div className="flex items-end gap-1 h-24">
          {Array.from({ length: 7 }, (_, i) => {
            const d = new Date()
            d.setDate(d.getDate() - (6 - i))
            const dateStr = d.toISOString().split('T')[0]
            const dayData = weeklyUsage.find(u => u.date === dateStr)
            const count = (dayData?.count || 0) + (dayData?.credits_used || 0)
            const maxCount = Math.max(...weeklyUsage.map(u => (u.count || 0) + (u.credits_used || 0)), 1)
            const height = count > 0 ? Math.max((count / maxCount) * 100, 10) : 5

            return (
              <div key={dateStr} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={`w-full transition-all ${count > 0 ? 'bg-foreground' : 'bg-secondary'}`}
                  style={{ height: `${height}%` }}
                />
                <span className="text-[10px] text-muted-foreground">
                  {d.toLocaleDateString('en', { weekday: 'narrow' })}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* View Full Usage */}
      <button
        onClick={() => open(`${SKILLHUB_URL}/web/account/usage`)}
        className="w-full py-3 border-2 border-foreground text-foreground font-semibold uppercase tracking-wider hover:bg-secondary transition flex items-center justify-center gap-2"
      >
        {t('settings.viewFullUsage')}
        <ExternalLink size={14} />
      </button>
    </div>
  )
}

// ============================================
// API Keys Page (matches web developer page)
// ============================================

interface ApiKeysPageProps {
  t: (key: string) => string
}

function ApiKeysPage({ t }: ApiKeysPageProps) {
  const { isAuthenticated, showToast } = useAppStore()
  const { 
    walletData: wallet, 
    apiKeys, 
    loading, 
    error: loadError,
    loadWalletData, 
    loadApiKeys,
    invalidateApiKeys 
  } = useAccountCache()
  
  const [isCreating, setIsCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [isCopied, setIsCopied] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  
  // Claude Code configuration state
  const [claudeConfig, setClaudeConfig] = useState<ClaudeCodeConfigStatus | null>(null)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [configApiKey, setConfigApiKey] = useState('')
  const [configLoading, setConfigLoading] = useState(false)
  
  // WebView modal for top-up
  const [showTopUpModal, setShowTopUpModal] = useState(false)

  const loadData = async () => {
    await Promise.all([loadWalletData(), loadApiKeys()])
    await loadClaudeConfig()
  }
  
  const loadClaudeConfig = async () => {
    try {
      const status = await invoke<{ config: ClaudeCodeConfigStatus }>('check_dependencies')
      setClaudeConfig(status.config)
    } catch (error) {
      console.error('Failed to load Claude config:', error)
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      loadData()
    } else {
      // Still try to load Claude config even when not authenticated
      loadClaudeConfig()
    }
  }, [isAuthenticated])
  
  const handleConfigureClaudeCode = async () => {
    if (!configApiKey.trim()) return
    
    setConfigLoading(true)
    try {
      await invoke('configure_claude_code', { apiKey: configApiKey.trim() })
      showToast(t('settings.apiConfigured'), 'success')
      setShowConfigModal(false)
      setConfigApiKey('')
      await loadClaudeConfig()
    } catch (error) {
      showToast(String(error), 'error')
    } finally {
      setConfigLoading(false)
    }
  }
  
  const handleRemoveClaudeConfig = async () => {
    if (!confirm(t('settings.confirmRemoveConfig'))) return
    
    try {
      await invoke('remove_claude_code_config')
      showToast(t('settings.apiConfigRemoved'), 'success')
      await loadClaudeConfig()
    } catch (error) {
      showToast(String(error), 'error')
    }
  }

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return
    setActionLoading(true)
    try {
      const result = await createApiKey(newKeyName)
      if (result.key) {
        setCreatedKey(result.key)
        setNewKeyName('')
        setIsCreating(false)
        // Refresh keys list (force refresh)
        invalidateApiKeys()
        await loadApiKeys(true)
      }
    } catch (error) {
      showToast((error as Error).message || t('settings.createKeyFailed'), 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteKey = async (id: string) => {
    if (!confirm(t('settings.confirmDeleteKey'))) return
    try {
      await deleteApiKey(id)
      // Refresh keys list (force refresh)
      invalidateApiKeys()
      await loadApiKeys(true)
      showToast(t('settings.keyDeleted'), 'success')
    } catch (error) {
      showToast(t('settings.deleteKeyFailed'), 'error')
    }
  }

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  if (!isAuthenticated) {
    return (
      <div className="space-y-6">
        <div className="border-b-2 border-foreground pb-4">
          <h2 className="text-xl font-bold text-foreground">{t('settingsNav.apiKeys')}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t('settings.apiKeysDesc')}</p>
        </div>
        <div className="border-2 border-foreground p-6 text-center">
          <User size={48} className="mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground">{t('settings.signInToView')}</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="border-b-2 border-foreground pb-4">
          <h2 className="text-xl font-bold text-foreground">{t('settingsNav.apiKeys')}</h2>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-secondary" />
          <div className="h-48 bg-secondary" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b-2 border-foreground pb-4">
        <h2 className="text-xl font-bold text-foreground">{t('settingsNav.apiKeys')}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t('settings.apiKeysDesc')}</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Wallet */}
        <div className="border-2 border-foreground p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-green-500 flex items-center justify-center">
              <span className="text-white font-bold text-lg">$</span>
            </div>
            <h3 className="text-sm font-bold text-foreground uppercase">{t('settings.wallet')}</h3>
          </div>
          <div className="mb-4">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-foreground">
                ${wallet?.balance?.toFixed(4) || '0.0000'}
              </span>
              <span className="text-sm text-muted-foreground font-bold">{wallet?.currency || 'USD'}</span>
            </div>
          </div>
          <button
            onClick={() => setShowTopUpModal(true)}
            className="w-full py-2 border-2 border-foreground text-foreground font-semibold uppercase tracking-wider hover:bg-secondary transition text-sm flex items-center justify-center gap-2"
          >
            {t('settings.topUp')}
          </button>
        </div>

        {/* API Keys */}
        <div className="border-2 border-foreground p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-purple-600 flex items-center justify-center">
                <Key size={16} className="text-white" />
              </div>
              <h3 className="text-sm font-bold text-foreground uppercase">{t('settings.apiKeysTitle')}</h3>
            </div>
            {!createdKey && (
              <button
                onClick={() => setIsCreating(!isCreating)}
                className="flex items-center gap-1 text-xs font-bold uppercase text-foreground hover:text-purple-600 transition-colors"
              >
                <Plus size={14} /> {t('settings.newKey')}
              </button>
            )}
          </div>

          {/* New Key Display */}
          {createdKey && (
            <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border-2 border-green-500">
              <div className="flex items-start gap-2 mb-2">
                <AlertTriangle size={16} className="text-green-600 shrink-0 mt-0.5" />
                <p className="text-xs text-green-800 dark:text-green-200 font-bold">
                  {t('settings.saveKeyWarning')}
                </p>
              </div>
              <div className="flex items-center gap-2 bg-white dark:bg-black border border-green-200 p-2 font-mono text-xs break-all">
                <span className="flex-1">{createdKey}</span>
                <button onClick={() => copyToClipboard(createdKey)} className="hover:text-green-600 shrink-0">
                  {isCopied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              <button
                onClick={() => setCreatedKey(null)}
                className="mt-3 text-xs font-bold uppercase text-green-700 hover:underline w-full text-right"
              >
                {t('settings.iHaveSavedIt')}
              </button>
            </div>
          )}

          {/* Create Form */}
          {isCreating && !createdKey && (
            <div className="mb-4 flex gap-2">
              <input
                type="text"
                placeholder={t('settings.keyNamePlaceholder')}
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border-2 border-foreground focus:outline-none bg-background"
                autoFocus
              />
              <button
                onClick={handleCreateKey}
                disabled={actionLoading || !newKeyName}
                className="px-4 py-2 bg-purple-600 text-white text-xs font-bold uppercase hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {actionLoading ? '...' : t('settings.create')}
              </button>
            </div>
          )}

          {/* Key List */}
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {/* Error state */}
            {loadError && (
              <div className="text-center py-4 bg-red-500/10 border-2 border-dashed border-red-500/30">
                <p className="text-xs text-red-500 mb-2">{loadError}</p>
                <button
                  onClick={loadData}
                  className="text-xs font-bold text-red-500 hover:underline"
                >
                  {t('common.refresh')}
                </button>
              </div>
            )}
            {/* Empty state */}
            {!loadError && apiKeys.length === 0 && !createdKey && (
              <div className="text-center py-6 bg-secondary/20 border-2 border-dashed border-border">
                <p className="text-xs text-muted-foreground italic">{t('settings.noKeys')}</p>
              </div>
            )}
            {/* Key list */}
            {apiKeys.map((key) => (
              <div key={key.id} className="flex items-center justify-between p-3 border border-border bg-background hover:bg-secondary/30 transition-colors group">
                <div>
                  <p className="text-xs font-bold text-foreground">{key.name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{key.key_prefix}</p>
                </div>
                <button
                  onClick={() => handleDeleteKey(key.id)}
                  className="text-muted-foreground hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Claude Code Configuration */}
      <div className="border-2 border-foreground p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-500 flex items-center justify-center">
              <Settings2 size={16} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground uppercase">{t('settings.claudeCodeConfig')}</h3>
              <p className="text-xs text-muted-foreground">{t('settings.claudeCodeConfigDesc')}</p>
            </div>
          </div>
        </div>
        
        {/* Current config status */}
        <div className="bg-secondary/30 border border-border p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold mb-1">{t('settings.configuredApiKey')}</p>
              {claudeConfig?.api_key_set ? (
                <p className="font-mono text-sm text-foreground">{claudeConfig.api_key_preview}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">{t('settings.notConfigured')}</p>
              )}
            </div>
            <div className={`w-3 h-3 rounded-full ${claudeConfig?.api_key_set ? 'bg-green-500' : 'bg-gray-400'}`} />
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowConfigModal(true)}
            className="flex-1 py-2 border-2 border-foreground text-foreground font-semibold uppercase tracking-wider hover:bg-secondary transition text-sm flex items-center justify-center gap-2"
          >
            <RefreshCw size={14} />
            {claudeConfig?.api_key_set ? t('settings.reconfigureApiKey') : t('setup.configure')}
          </button>
          {claudeConfig?.api_key_set && (
            <button
              onClick={handleRemoveClaudeConfig}
              className="py-2 px-4 border-2 border-red-500 text-red-500 font-semibold uppercase tracking-wider hover:bg-red-500/10 transition text-sm flex items-center justify-center gap-2"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Configure Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border-2 border-foreground p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-2 tracking-tight uppercase">{t('settings.claudeCodeConfig')}</h2>
            <p className="text-muted-foreground text-sm mb-4">
              {t('settings.claudeCodeConfigDesc')}
            </p>

            <input
              type="text"
              placeholder="sk-skillhubs-..."
              value={configApiKey}
              onChange={(e) => setConfigApiKey(e.target.value)}
              className="w-full bg-background text-foreground font-mono px-4 py-3 border-2 border-foreground mb-4 focus:outline-none text-sm"
              autoFocus
            />

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowConfigModal(false)
                  setConfigApiKey('')
                }}
                className="flex-1 px-4 py-2 border-2 border-foreground text-foreground font-semibold text-sm uppercase tracking-wide hover:bg-secondary transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleConfigureClaudeCode}
                disabled={configLoading || !configApiKey.trim()}
                className="flex-1 px-4 py-2 bg-foreground text-background font-semibold text-sm uppercase tracking-wide hover:opacity-90 transition-opacity disabled:opacity-50 border-2 border-foreground"
              >
                {configLoading ? '...' : t('setup.configure')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Start */}
      <div className="border-2 border-foreground p-6">
        <h4 className="text-sm font-bold text-foreground uppercase mb-4 flex items-center gap-2">
          <Key size={16} /> {t('settings.quickStart')}
        </h4>
        <div className="bg-secondary/30 border border-border p-4">
          <p className="text-xs font-bold text-foreground uppercase mb-3">{t('settings.anthropicProxy')}</p>
          <div className="space-y-2">
            <div className="bg-background border border-border p-3 font-mono text-xs text-muted-foreground">
              <div className="text-[9px] text-muted-foreground/50 uppercase font-bold mb-1">1. Set Base URL</div>
              <code>export ANTHROPIC_BASE_URL=https://www.skillhub.club/api/v1/anthropic</code>
            </div>
            <div className="bg-background border border-border p-3 font-mono text-xs text-muted-foreground">
              <div className="text-[9px] text-muted-foreground/50 uppercase font-bold mb-1">2. Set API Key</div>
              <code>export ANTHROPIC_API_KEY=YOUR_KEY</code>
            </div>
          </div>
        </div>
      </div>

      {/* View Full Developer Page */}
      <button
        onClick={() => open(`${SKILLHUB_URL}/web/account/developer`)}
        className="w-full py-3 border-2 border-foreground text-foreground font-semibold uppercase tracking-wider hover:bg-secondary transition flex items-center justify-center gap-2"
      >
        {t('settings.viewDeveloperPage')}
        <ExternalLink size={14} />
      </button>

      {/* Top Up WebView Modal */}
      <WebViewModal
        isOpen={showTopUpModal}
        onClose={() => {
          setShowTopUpModal(false)
          // Refresh wallet balance after closing
          loadWalletData(true)
        }}
        url={`${SKILLHUB_URL}/web/account/developer?embed=1`}
        title={t('webview.topUp')}
      />
    </div>
  )
}

// ============================================
// Appearance Page
// ============================================

interface AppearancePageProps {
  theme: 'light' | 'dark'
  setTheme: (theme: 'light' | 'dark') => void
  currentLang: string
  onLanguageChange: (lang: string) => void
  onClearCache: () => void
  t: (key: string) => string
}

function AppearancePage({ theme, setTheme, currentLang, onLanguageChange, onClearCache, t }: AppearancePageProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-2">{t('settingsNav.appearance')}</h2>
        <p className="text-sm text-muted-foreground">{t('settings.appearanceDesc')}</p>
      </div>

      <SettingsSection title={t('settings.theme')}>
        <SettingsCard>
          <div className="p-4">
            <div className="flex gap-3">
              <button
                onClick={() => setTheme('light')}
                className={`flex-1 p-4 rounded-[8px] border-2 transition-all ${
                  theme === 'light'
                    ? 'border-foreground bg-secondary/50'
                    : 'border-border-light hover:border-foreground/50'
                }`}
              >
                <Sun size={24} className="mx-auto mb-2" />
                <div className="text-sm font-medium">{t('settings.lightMode')}</div>
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`flex-1 p-4 rounded-[8px] border-2 transition-all ${
                  theme === 'dark'
                    ? 'border-foreground bg-secondary/50'
                    : 'border-border-light hover:border-foreground/50'
                }`}
              >
                <Moon size={24} className="mx-auto mb-2" />
                <div className="text-sm font-medium">{t('settings.darkMode')}</div>
              </button>
            </div>
          </div>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title={t('settings.language')}>
        <SettingsCard>
          <div className="p-4">
            <div className="flex gap-3">
              <button
                onClick={() => onLanguageChange('en')}
                className={`flex-1 p-3 rounded-[8px] border-2 transition-all ${
                  currentLang === 'en'
                    ? 'border-foreground bg-secondary/50'
                    : 'border-border-light hover:border-foreground/50'
                }`}
              >
                <div className="text-sm font-medium">English</div>
              </button>
              <button
                onClick={() => onLanguageChange('zh')}
                className={`flex-1 p-3 rounded-[8px] border-2 transition-all ${
                  currentLang === 'zh'
                    ? 'border-foreground bg-secondary/50'
                    : 'border-border-light hover:border-foreground/50'
                }`}
              >
                <div className="text-sm font-medium">中文</div>
              </button>
            </div>
          </div>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title={t('settings.cacheTitle')}>
        <SettingsCard>
          <SettingsRow
            label={t('settings.clearCache')}
            description={t('settings.clearCacheDesc')}
            action={
              <button
                onClick={onClearCache}
                className="px-3 py-1.5 text-sm font-medium text-foreground bg-secondary rounded-[6px] hover:bg-secondary/80 transition-colors"
              >
                {t('settings.clear')}
              </button>
            }
          />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title={t('settings.about')}>
        <SettingsCard>
          <SettingsRow
            label="SkillHub Desktop"
            description={`${t('settings.version')} ${__APP_VERSION__}`}
          />
          <SettingsRow
            label={t('settings.visitSkillHub')}
            action={
              <a
                href="https://skillhub.club"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
              >
                <ExternalLink size={16} />
              </a>
            }
          />
          <SettingsRow
            label="GitHub"
            action={
              <a
                href="https://github.com/anthropics/skillhub"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
              >
                <ExternalLink size={16} />
              </a>
            }
          />
        </SettingsCard>
      </SettingsSection>
    </div>
  )
}
