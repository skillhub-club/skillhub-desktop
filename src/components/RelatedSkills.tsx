import { useState, useEffect } from 'react'
import { Loader2, ChevronRight, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getCatalog } from '../api/skillhub'
import type { SkillHubSkill } from '../types'

interface RelatedSkillsProps {
  currentSkill: SkillHubSkill
  onViewSkill: (skill: SkillHubSkill) => void
  onInstallSkill: (skill: SkillHubSkill) => void
  maxItems?: number
}

export default function RelatedSkills({
  currentSkill,
  onViewSkill,
  onInstallSkill,
  maxItems = 4,
}: RelatedSkillsProps) {
  const { t, i18n } = useTranslation()
  const [relatedSkills, setRelatedSkills] = useState<SkillHubSkill[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchRelated = async () => {
      setLoading(true)
      try {
        // Fetch skills from the same category
        const data = await getCatalog(1, 20, currentSkill.category, 'popular')
        
        // Filter out current skill and score by relevance
        const filtered = (data.skills || [])
          .filter(s => s.id !== currentSkill.id && s.slug !== currentSkill.slug)
          .map(skill => {
            // Calculate relevance score based on shared tags
            let score = 0
            const currentTags = new Set(currentSkill.tags?.map(t => t.toLowerCase()) || [])
            const skillTags = skill.tags?.map(t => t.toLowerCase()) || []
            
            skillTags.forEach(tag => {
              if (currentTags.has(tag)) score += 10
            })
            
            // Bonus for same author
            if (skill.author === currentSkill.author) score += 5
            
            // Bonus for similar rating
            if (skill.simple_rating === currentSkill.simple_rating) score += 3
            
            // Add some weight for popularity
            score += Math.min((skill.github_stars || 0) / 100, 5)
            
            return { ...skill, _relevanceScore: score }
          })
          .sort((a, b) => (b._relevanceScore || 0) - (a._relevanceScore || 0))
          .slice(0, maxItems)
        
        setRelatedSkills(filtered)
      } catch (error) {
        console.error('Failed to fetch related skills:', error)
      } finally {
        setLoading(false)
      }
    }

    if (currentSkill.category) {
      fetchRelated()
    }
  }, [currentSkill.id, currentSkill.category, currentSkill.slug, maxItems])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="animate-spin text-muted-foreground" size={20} />
      </div>
    )
  }

  if (relatedSkills.length === 0) {
    return null
  }

  return (
    <div className="mt-6 pt-6 border-t border-border">
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
        <Sparkles size={14} className="text-purple-500" />
        {t('relatedSkills.title')}
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {relatedSkills.map(skill => {
          const description = i18n.language === 'zh' && skill.description_zh
            ? skill.description_zh
            : skill.description
          
          return (
            <div
              key={skill.id}
              className="group border border-border rounded-lg p-3 hover:border-foreground cursor-pointer transition-all"
              onClick={() => onViewSkill(skill)}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <h4 className="font-semibold text-foreground text-sm truncate flex-1">
                  {skill.name}
                </h4>
                {skill.simple_rating && (
                  <span className={`px-1.5 py-0.5 text-[10px] font-bold flex-shrink-0 ${
                    skill.simple_rating === 'S' ? 'bg-yellow-500 text-black' :
                    skill.simple_rating === 'A' ? 'bg-purple-500 text-white' :
                    'bg-blue-500 text-white'
                  }`}>
                    {skill.simple_rating}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                {description}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">
                  {t('relatedSkills.by', { name: skill.author })}
                </span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onInstallSkill(skill)
                    }}
                    className="text-[10px] px-2 py-0.5 bg-foreground text-background font-semibold hover:opacity-90 transition-colors"
                  >
                    {t('relatedSkills.install')}
                  </button>
                  <ChevronRight size={14} className="text-muted-foreground" />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
