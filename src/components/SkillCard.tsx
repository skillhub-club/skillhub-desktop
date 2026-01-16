import { Star, Download, ExternalLink, Eye, Zap, Loader2 } from 'lucide-react'
import type { SkillHubSkill } from '../types'

interface SkillCardProps {
  skill: SkillHubSkill
  onInstall: (skill: SkillHubSkill) => void
  onView?: (skill: SkillHubSkill) => void
  onQuickInstall?: (skill: SkillHubSkill) => void
  installing?: boolean
}

function getRatingBadge(rating?: string) {
  switch (rating) {
    case 'S': return 'bg-yellow-500 text-black'
    case 'A': return 'bg-purple-500 text-white'
    case 'B': return 'bg-blue-500 text-white'
    default: return 'bg-muted text-muted-foreground'
  }
}

function getCategoryColor(category?: string) {
  switch (category?.toLowerCase()) {
    case 'development': return 'bg-cat-dev'
    case 'design': return 'bg-cat-design'
    case 'writing': return 'bg-cat-writing'
    case 'data': return 'bg-cat-data'
    case 'automation': return 'bg-cat-auto'
    case 'documentation': return 'bg-cat-doc'
    default: return 'bg-cat-meta'
  }
}

export default function SkillCard({ skill, onInstall, onView, onQuickInstall, installing }: SkillCardProps) {
  return (
    <div
      className="card p-4 cursor-pointer"
      onClick={() => onView?.(skill)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-foreground truncate tracking-tight">{skill.name}</h3>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">by {skill.author}</p>
        </div>
        {skill.simple_rating && (
          <span className={`px-2 py-0.5 text-xs font-bold uppercase ${getRatingBadge(skill.simple_rating)}`}>
            {skill.simple_rating}
          </span>
        )}
      </div>

      <p className="text-sm text-muted-foreground line-clamp-2 mb-4 h-10">
        {skill.description}
      </p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          {skill.github_stars !== undefined && skill.github_stars > 0 && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Star size={14} className="text-yellow-500" />
              {skill.github_stars.toLocaleString()}
            </span>
          )}
          <span className={`tag text-white ${getCategoryColor(skill.category)}`}>
            {skill.category}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {onView && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onView(skill)
              }}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
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
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
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
              className="p-1.5 text-foreground hover:bg-secondary disabled:opacity-50 transition-colors"
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
            className="btn btn-primary py-1.5 px-3 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={14} />
            {installing ? 'Installing...' : 'Install'}
          </button>
        </div>
      </div>
    </div>
  )
}
