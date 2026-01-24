import { Star, Download, ExternalLink, Eye, Loader2, Library, CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { open } from '@tauri-apps/plugin-shell'
import type { SkillHubSkill } from '../types'

interface SkillCardProps {
  skill: SkillHubSkill
  onInstall: (skill: SkillHubSkill) => void
  onView?: (skill: SkillHubSkill) => void
  installing?: boolean
  showPreviewButton?: boolean
  customUrl?: string
  meta?: {
    coverUrl?: string
    views?: number
    downloads?: number
    ownerName?: string
  }
  // Multi-select support
  selectionMode?: boolean
  selected?: boolean
  onSelect?: (skill: SkillHubSkill) => void
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

export default function SkillCard({ 
  skill, 
  onInstall, 
  onView, 
  installing, 
  showPreviewButton = false, 
  customUrl, 
  meta,
  selectionMode = false,
  selected = false,
  onSelect,
}: SkillCardProps) {
  const { t, i18n } = useTranslation()
  
  // Select description based on current language
  const description = i18n.language === 'zh' && skill.description_zh 
    ? skill.description_zh 
    : skill.description

  const handleCardClick = () => {
    if (selectionMode && onSelect) {
      onSelect(skill)
    } else {
      onView?.(skill)
    }
  }

  return (
    <div
      className={`card p-0 cursor-pointer flex flex-col overflow-hidden relative transition-all ${
        selected ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background' : ''
      }`}
      onClick={handleCardClick}
    >
      {/* Selection indicator */}
      {selectionMode && (
        <div 
          className={`absolute top-3 left-3 z-10 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
            selected 
              ? 'bg-foreground text-background' 
              : 'bg-background/80 text-muted-foreground border-2 border-muted-foreground'
          }`}
        >
          {selected && <CheckCircle2 size={16} />}
        </div>
      )}
      <div className="relative h-32 w-full overflow-hidden border-b border-border-light bg-secondary">
        {meta?.coverUrl ? (
          <img
            src={meta.coverUrl}
            alt={skill.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-foreground/10 via-secondary to-background flex items-center justify-center text-[11px] uppercase tracking-wider text-muted-foreground">
            {t('skillCard.noCover')}
          </div>
        )}
        {showPreviewButton && onView && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onView(skill)
            }}
            className="absolute bottom-2 right-2 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider bg-background/90 border border-border-light hover:border-foreground hover:bg-background transition-colors"
          >
            {t('skillCard.preview')}
          </button>
        )}
      </div>
      <div className="p-4 flex flex-col flex-1">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-foreground truncate tracking-tight">{skill.name}</h3>
            {skill.is_aggregator && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded flex-shrink-0">
                <Library size={10} />
                {t('skillCard.collection')}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider truncate">
            {meta?.ownerName
              ? t('skillCard.by', { name: meta.ownerName })
              : t('skillCard.by', { name: skill.author })}
          </p>
        </div>
        {skill.simple_rating && (
          <span className={`px-2 py-0.5 text-xs font-bold uppercase flex-shrink-0 ${getRatingBadge(skill.simple_rating)}`}>
            {skill.simple_rating}
          </span>
        )}
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground line-clamp-2 mb-3 min-h-[2.5rem]">
        {description}
      </p>

      {/* Meta info */}
      <div className="flex items-center gap-2 text-sm mb-3 min-w-0 flex-wrap">
        {skill.github_stars !== undefined && skill.github_stars > 0 && (
          <span className="flex items-center gap-1 text-muted-foreground flex-shrink-0">
            <Star size={14} className="text-yellow-500" />
            {skill.github_stars.toLocaleString()}
          </span>
        )}
        <span className={`tag text-white truncate max-w-[120px] ${getCategoryColor(skill.category)}`}>
          {skill.category}
        </span>
        {meta?.views !== undefined && (
          <span className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted-foreground">
            <Eye size={12} />
            {t('skillCard.views', { count: meta.views })}
          </span>
        )}
        {meta?.downloads !== undefined && (
          <span className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted-foreground">
            <Download size={12} />
            {t('skillCard.installs', { count: meta.downloads })}
          </span>
        )}
      </div>

      {/* Actions - 使用 mt-auto 推到底部 */}
      <div className="flex items-center justify-between gap-2 mt-auto pt-2 border-t border-border-light">
        <div className="flex items-center gap-1">
          {onView && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onView(skill)
                }}
                className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                title={t('skillCard.viewDetails')}
              >
                <Eye size={16} />
              </button>
              {showPreviewButton && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onView(skill)
                  }}
                  className="btn btn-secondary px-3 py-1.5 text-xs uppercase tracking-wider"
                >
                  {t('skillCard.preview')}
                </button>
              )}
            </>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              const skillhubUrl = import.meta.env.VITE_SKILLHUB_API_URL || 'https://www.skillhub.club'
              const path = customUrl || `/skills/${skill.slug}`
              open(`${skillhubUrl}${path.startsWith('/') ? '' : '/'}${path}`).catch(console.error)
            }}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            title={t('skillCard.viewOnSkillHub')}
          >
            <ExternalLink size={16} />
          </button>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onInstall(skill)
          }}
          disabled={installing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider bg-foreground text-background border-2 border-foreground hover:bg-background hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-all flex-shrink-0"
        >
          {installing ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Download size={14} />
          )}
          <span>{installing ? t('skillCard.installing') : t('skillCard.install')}</span>
        </button>
      </div>
      </div>
    </div>
  )
}
