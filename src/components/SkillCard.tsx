import { Star, Download, ExternalLink, Eye, Zap, Loader2 } from 'lucide-react'
import type { SkillHubSkill } from '../types'

interface SkillCardProps {
  skill: SkillHubSkill
  onInstall: (skill: SkillHubSkill) => void
  onView?: (skill: SkillHubSkill) => void
  onQuickInstall?: (skill: SkillHubSkill) => void
  installing?: boolean
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

export default function SkillCard({ skill, onInstall, onView, onQuickInstall, installing }: SkillCardProps) {
  return (
    <div
      className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onView?.(skill)}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{skill.name}</h3>
          <p className="text-sm text-gray-500">by {skill.author}</p>
        </div>
        {skill.simple_rating && (
          <span className={`px-2 py-0.5 rounded text-sm font-bold ${getRatingColor(skill.simple_rating)}`}>
            {skill.simple_rating}
          </span>
        )}
      </div>

      <p className="text-sm text-gray-600 line-clamp-2 mb-3 h-10">
        {skill.description}
      </p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm text-gray-500">
          {skill.github_stars !== undefined && skill.github_stars > 0 && (
            <span className="flex items-center gap-1">
              <Star size={14} className="text-yellow-500" />
              {skill.github_stars.toLocaleString()}
            </span>
          )}
          <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
            {skill.category}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onView && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onView(skill)
              }}
              className="p-1.5 text-gray-400 hover:text-primary-600"
              title="View Details"
            >
              <Eye size={16} />
            </button>
          )}
          <a
            href={skill.repo_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 text-gray-400 hover:text-gray-600"
            title="View on GitHub"
          >
            <ExternalLink size={16} />
          </a>
          {onQuickInstall && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onQuickInstall(skill)
              }}
              disabled={installing}
              className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg disabled:opacity-50"
              title="Quick install to all tools"
            >
              {installing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Zap size={16} />
              )}
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onInstall(skill)
            }}
            disabled={installing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={14} />
            {installing ? 'Installing...' : 'Install'}
          </button>
        </div>
      </div>
    </div>
  )
}
