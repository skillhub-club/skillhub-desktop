import { useState, useEffect } from 'react'
import { X, Star, Download, ExternalLink, Github, Tag, FileText, Loader2 } from 'lucide-react'
import { open } from '@tauri-apps/plugin-shell'
import type { SkillHubSkill } from '../types'
import { getSkillDetail, fetchSkillContent, installSkill } from '../api/skillhub'
import { useAppStore } from '../store'
import ToolSelector from './ToolSelector'

interface SkillDetailProps {
  skill: SkillHubSkill
  onClose: () => void
}

function getRatingColor(rating?: string) {
  switch (rating) {
    case 'A': return 'rating-a rating-bg-a'
    case 'B': return 'rating-b rating-bg-b'
    case 'C': return 'rating-c rating-bg-c'
    case 'D': return 'rating-d rating-bg-d'
    case 'E': return 'rating-e rating-bg-e'
    default: return 'text-gray-500 bg-gray-100'
  }
}

export default function SkillDetail({ skill: initialSkill, onClose }: SkillDetailProps) {
  const { selectedToolIds, setToastMessage } = useAppStore()

  const [skill, setSkill] = useState<SkillHubSkill>(initialSkill)
  const [loading, setLoading] = useState(true)
  const [installing, setInstalling] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'content'>('overview')

  // Fetch full skill details
  useEffect(() => {
    setLoading(true)
    getSkillDetail(initialSkill.slug)
      .then(setSkill)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [initialSkill.slug])

  const handleInstall = async () => {
    if (selectedToolIds.length === 0) {
      setToastMessage('Please select at least one tool')
      return
    }

    setInstalling(true)
    try {
      const content = await fetchSkillContent(skill.slug)
      if (!content) {
        throw new Error('Failed to fetch skill content')
      }
      await installSkill(content, skill.name, selectedToolIds)
      setToastMessage(`Installed "${skill.name}" to ${selectedToolIds.length} tool(s)`)
      onClose()
    } catch (error) {
      console.error('Install failed:', error)
      setToastMessage('Installation failed. Please try again.')
    } finally {
      setInstalling(false)
    }
  }

  const openGitHub = async () => {
    try {
      await open(skill.repo_url)
    } catch (error) {
      console.error('Failed to open browser:', error)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-xl font-bold text-gray-900 truncate">{skill.name}</h2>
              {skill.simple_rating && (
                <span className={`px-2 py-0.5 rounded text-sm font-bold ${getRatingColor(skill.simple_rating)}`}>
                  {skill.simple_rating}
                </span>
              )}
            </div>
            <p className="text-gray-500">by {skill.author}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('content')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'content'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText size={14} className="inline mr-1.5" />
            SKILL.md
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-primary-600" size={32} />
            </div>
          ) : activeTab === 'overview' ? (
            <div className="space-y-6">
              {/* Stats */}
              <div className="flex items-center gap-4 text-sm">
                {skill.github_stars !== undefined && skill.github_stars > 0 && (
                  <div className="flex items-center gap-1.5 text-gray-600">
                    <Star size={16} className="text-yellow-500" />
                    <span>{skill.github_stars.toLocaleString()} stars</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-gray-600">
                  <Tag size={16} />
                  <span className="px-2 py-0.5 bg-gray-100 rounded">{skill.category}</span>
                </div>
                {skill.simple_score && (
                  <div className="text-gray-600">
                    Score: <span className="font-medium">{skill.simple_score.toFixed(1)}</span>
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Description</h3>
                <p className="text-gray-600 leading-relaxed">
                  {skill.description}
                </p>
                {skill.description_zh && (
                  <p className="text-gray-500 mt-2 text-sm">
                    {skill.description_zh}
                  </p>
                )}
              </div>

              {/* Tags */}
              {skill.tags && skill.tags.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {skill.tags.map(tag => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* GitHub Link */}
              <div>
                <button
                  onClick={openGitHub}
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm"
                >
                  <Github size={16} />
                  View on GitHub
                  <ExternalLink size={14} />
                </button>
              </div>
            </div>
          ) : (
            <div className="skill-content">
              {skill.skill_md_raw ? (
                <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono bg-gray-50 p-4 rounded-lg overflow-auto max-h-96">
                  {skill.skill_md_raw}
                </pre>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <FileText size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>SKILL.md content not available</p>
                  <button
                    onClick={openGitHub}
                    className="mt-2 text-primary-600 hover:underline text-sm"
                  >
                    View on GitHub
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer - Install Section */}
        <div className="border-t border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Install to Tools</h3>
          <ToolSelector />

          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleInstall}
              disabled={installing || selectedToolIds.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {installing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Installing...
                </>
              ) : (
                <>
                  <Download size={16} />
                  Install
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
