import { useEffect, useState } from 'react'
import { Heart, ExternalLink, Download, Loader2 } from 'lucide-react'
import { useAppStore } from '../store'
import { fetchFavorites as apiFetchFavorites, SKILLHUB_URL } from '../api/auth'
import SkillDetail from '../components/SkillDetail'
import type { FavoriteSkill, SkillHubSkill } from '../types'

export default function Favorites() {
  const { isAuthenticated, favorites, setFavorites, tools, setToastMessage, logout } = useAppStore()
  const [isLoading, setIsLoading] = useState(false)
  const [installingId, setInstallingId] = useState<string | null>(null)
  const [viewingSkill, setViewingSkill] = useState<SkillHubSkill | null>(null)

  useEffect(() => {
    if (isAuthenticated) {
      loadFavorites()
    }
  }, [isAuthenticated])

  const loadFavorites = async () => {
    setIsLoading(true)
    try {
      const data = await apiFetchFavorites()
      setFavorites(data)
    } catch (error) {
      console.error('Failed to fetch favorites:', error)
      if ((error as Error).message === 'Not authenticated' || (error as Error).message === 'Authentication failed') {
        setToastMessage('Session expired. Please sign in again.')
        logout()
      } else {
        setToastMessage('Failed to load favorites')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleInstall = async (favorite: FavoriteSkill) => {
    const installedTools = tools.filter(t => t.installed)
    if (installedTools.length === 0) {
      setToastMessage('No AI tools detected. Please install one first.')
      return
    }

    setInstallingId(favorite.skill_id)
    try {
      // Install to all detected tools
      const { invoke } = await import('@tauri-apps/api/core')

      for (const tool of installedTools) {
        await invoke('install_skill', {
          toolId: tool.id,
          skillName: favorite.skill.slug,
          skillContent: favorite.skill.skill_md_raw || `# ${favorite.skill.name}\n\n${favorite.skill.description}`,
        })
      }

      setToastMessage(`Installed "${favorite.skill.name}" to ${installedTools.length} tool(s)`)
    } catch (error) {
      console.error('Install failed:', error)
      setToastMessage('Failed to install skill')
    } finally {
      setInstallingId(null)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="p-6">
        <div className="text-center py-16">
          <Heart size={48} className="mx-auto text-gray-300 mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Sign in to view favorites</h2>
          <p className="text-gray-500">
            Sign in with your SkillHub account to sync and manage your favorite skills.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Favorites</h1>
          <p className="text-gray-500 mt-1">Skills you've saved on SkillHub</p>
        </div>
        <button
          onClick={loadFavorites}
          disabled={isLoading}
          className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          {isLoading ? 'Syncing...' : 'Sync'}
        </button>
      </div>

      {isLoading && favorites.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-gray-400" size={32} />
        </div>
      ) : favorites.length === 0 ? (
        <div className="text-center py-16">
          <Heart size={48} className="mx-auto text-gray-300 mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No favorites yet</h2>
          <p className="text-gray-500">
            Visit{' '}
            <a
              href={`${SKILLHUB_URL}/skills`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:underline"
            >
              SkillHub
            </a>{' '}
            to discover and save skills.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {favorites.map((favorite) => (
            <div
              key={favorite.id}
              className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setViewingSkill(favorite.skill)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {favorite.skill.name}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    by {favorite.skill.author}
                  </p>
                  <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                    {favorite.skill.description}
                  </p>
                  {favorite.skill.tags && favorite.skill.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {favorite.skill.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <a
                    href={`${SKILLHUB_URL}/skills/${favorite.skill.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                    title="View on SkillHub"
                  >
                    <ExternalLink size={18} />
                  </a>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleInstall(favorite)
                    }}
                    disabled={installingId === favorite.skill_id}
                    className="flex items-center gap-2 px-3 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50"
                  >
                    {installingId === favorite.skill_id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Download size={16} />
                    )}
                    Install
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Skill Detail Modal */}
      {viewingSkill && (
        <SkillDetail
          skill={viewingSkill}
          onClose={() => setViewingSkill(null)}
        />
      )}
    </div>
  )
}
