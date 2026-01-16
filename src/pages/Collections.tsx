import { useEffect, useState } from 'react'
import { Folder, ExternalLink, Download, Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import { useAppStore } from '../store'
import { fetchCollections as apiFetchCollections, SKILLHUB_URL } from '../api/auth'
import type { SkillCollection, SkillHubSkill } from '../types'

export default function Collections() {
  const { isAuthenticated, collections, setCollections, tools, setToastMessage, logout } = useAppStore()
  const [isLoading, setIsLoading] = useState(false)
  const [installingId, setInstallingId] = useState<string | null>(null)
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (isAuthenticated) {
      loadCollections()
    }
  }, [isAuthenticated])

  const loadCollections = async () => {
    setIsLoading(true)
    try {
      const data = await apiFetchCollections()
      setCollections(data)
    } catch (error) {
      console.error('Failed to fetch collections:', error)
      if ((error as Error).message === 'Not authenticated' || (error as Error).message === 'Authentication failed') {
        setToastMessage('Session expired. Please sign in again.')
        logout()
      } else {
        setToastMessage('Failed to load collections')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const toggleCollection = (collectionId: string) => {
    setExpandedCollections(prev => {
      const next = new Set(prev)
      if (next.has(collectionId)) {
        next.delete(collectionId)
      } else {
        next.add(collectionId)
      }
      return next
    })
  }

  const handleInstallSkill = async (skill: SkillHubSkill) => {
    const installedTools = tools.filter(t => t.installed)
    if (installedTools.length === 0) {
      setToastMessage('No AI tools detected. Please install one first.')
      return
    }

    setInstallingId(skill.id)
    try {
      const { invoke } = await import('@tauri-apps/api/core')

      for (const tool of installedTools) {
        await invoke('install_skill', {
          toolId: tool.id,
          skillName: skill.slug,
          skillContent: skill.skill_md_raw || `# ${skill.name}\n\n${skill.description}`,
        })
      }

      setToastMessage(`Installed "${skill.name}" to ${installedTools.length} tool(s)`)
    } catch (error) {
      console.error('Install failed:', error)
      setToastMessage('Failed to install skill')
    } finally {
      setInstallingId(null)
    }
  }

  const handleInstallCollection = async (collection: SkillCollection) => {
    const installedTools = tools.filter(t => t.installed)
    if (installedTools.length === 0) {
      setToastMessage('No AI tools detected. Please install one first.')
      return
    }

    if (collection.skills.length === 0) {
      setToastMessage('This collection has no skills to install.')
      return
    }

    setInstallingId(collection.id)
    try {
      const { invoke } = await import('@tauri-apps/api/core')

      for (const skill of collection.skills) {
        for (const tool of installedTools) {
          await invoke('install_skill', {
            toolId: tool.id,
            skillName: skill.slug,
            skillContent: skill.skill_md_raw || `# ${skill.name}\n\n${skill.description}`,
          })
        }
      }

      setToastMessage(`Installed ${collection.skills.length} skill(s) from "${collection.name}"`)
    } catch (error) {
      console.error('Install failed:', error)
      setToastMessage('Failed to install collection')
    } finally {
      setInstallingId(null)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="p-6">
        <div className="text-center py-16">
          <Folder size={48} className="mx-auto text-gray-300 mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Sign in to view collections</h2>
          <p className="text-gray-500">
            Sign in with your SkillHub account to sync and manage your skill collections.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Collections</h1>
          <p className="text-gray-500 mt-1">Your curated skill collections from SkillHub</p>
        </div>
        <button
          onClick={loadCollections}
          disabled={isLoading}
          className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          {isLoading ? 'Syncing...' : 'Sync'}
        </button>
      </div>

      {isLoading && collections.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-gray-400" size={32} />
        </div>
      ) : collections.length === 0 ? (
        <div className="text-center py-16">
          <Folder size={48} className="mx-auto text-gray-300 mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No collections yet</h2>
          <p className="text-gray-500">
            Visit{' '}
            <a
              href={`${SKILLHUB_URL}/app/collections`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:underline"
            >
              SkillHub
            </a>{' '}
            to create skill collections.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {collections.map((collection) => (
            <div
              key={collection.id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              {/* Collection Header */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => toggleCollection(collection.id)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {expandedCollections.has(collection.id) ? (
                    <ChevronDown size={20} className="text-gray-400 shrink-0" />
                  ) : (
                    <ChevronRight size={20} className="text-gray-400 shrink-0" />
                  )}
                  <Folder size={20} className="text-primary-500 shrink-0" />
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {collection.name}
                    </h3>
                    {collection.description && (
                      <p className="text-sm text-gray-500 truncate">
                        {collection.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {collection.skills.length} skill{collection.skills.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleInstallCollection(collection)
                  }}
                  disabled={installingId === collection.id || collection.skills.length === 0}
                  className="flex items-center gap-2 px-3 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50 ml-4"
                >
                  {installingId === collection.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Download size={16} />
                  )}
                  Install All
                </button>
              </div>

              {/* Collection Skills */}
              {expandedCollections.has(collection.id) && collection.skills.length > 0 && (
                <div className="border-t border-gray-100 divide-y divide-gray-100">
                  {collection.skills.map((skill) => (
                    <div key={skill.id} className="p-4 pl-12 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 truncate">
                            {skill.name}
                          </h4>
                          <p className="text-sm text-gray-500">
                            by {skill.author}
                          </p>
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                            {skill.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <a
                            href={`${SKILLHUB_URL}/skills/${skill.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                            title="View on SkillHub"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink size={16} />
                          </a>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleInstallSkill(skill)
                            }}
                            disabled={installingId === skill.id}
                            className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 disabled:opacity-50"
                          >
                            {installingId === skill.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Download size={14} />
                            )}
                            Install
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
