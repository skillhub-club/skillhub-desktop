import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Users, Star, ExternalLink, Loader2 } from 'lucide-react'
import { open } from '@tauri-apps/plugin-shell'
import { getKolDetail, type KolUser, type KolDetailResponse } from '../api/skillhub'
import { useAppStore } from '../store'
import SkillCard from './SkillCard'
import type { SkillHubSkill } from '../types'

interface KolDetailProps {
  kol: KolUser
  onClose: () => void
  onInstallSkill: (skill: SkillHubSkill) => void
  onViewSkill: (skill: SkillHubSkill) => void
}

const SKILLHUB_URL = import.meta.env.VITE_SKILLHUB_API_URL || 'https://www.skillhub.club'

export default function KolDetail({ kol, onClose, onInstallSkill, onViewSkill }: KolDetailProps) {
  const { t } = useTranslation()
  const [detail, setDetail] = useState<KolDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { showToast } = useAppStore()

  useEffect(() => {
    setLoading(true)
    setError(null)

    getKolDetail(kol.githubUsername)
      .then(data => {
        setDetail(data)
      })
      .catch(err => {
        console.error('Failed to load KOL detail:', err)
        const message = t('kolDetail.failedToLoad')
        setError(message)
        showToast(message, 'error')
      })
      .finally(() => setLoading(false))
  }, [kol.githubUsername, showToast])

  const openProfile = async () => {
    try {
      await open(`${SKILLHUB_URL}/u/${kol.githubUsername}`)
    } catch (error) {
      console.error('Failed to open browser:', error)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-background border-2 border-foreground w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b-2 border-border-light">
          <div className="flex items-center gap-4">
            {kol.avatarUrl ? (
              <img
                src={kol.avatarUrl}
                alt={kol.displayName}
                className="w-16 h-16 border-2 border-foreground"
              />
            ) : (
              <div className="w-16 h-16 border-2 border-foreground flex items-center justify-center bg-secondary">
                <Users size={32} className="text-muted-foreground" />
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold tracking-tight">{kol.displayName}</h2>
              <p className="text-sm text-muted-foreground">@{kol.githubUsername}</p>
              <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground uppercase tracking-wider">
                <span className="flex items-center gap-1">
                  <Users size={12} />
                  {t('kolDetail.followersCount', { count: kol.githubFollowers })}
                </span>
                <span className="flex items-center gap-1">
                  <Star size={12} />
                  {t('kolDetail.starsCount', { count: detail?.user?.stats?.totalStars || kol.skillCount })}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openProfile}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title={t('kolDetail.viewOnSkillHub')}
            >
              <ExternalLink size={20} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Bio */}
        {kol.bio && (
          <div className="px-4 py-3 border-b border-border-light">
            <p className="text-sm text-muted-foreground">{kol.bio}</p>
          </div>
        )}

        {/* Skills */}
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
            {t('kolDetail.skillsBy', { name: kol.displayName })}
          </h3>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-foreground" size={32} />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-muted-foreground">
              {error}
            </div>
          ) : detail?.skills && detail.skills.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {detail.skills.map(skill => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  onInstall={onInstallSkill}
                  onView={onViewSkill}
                  installing={false}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              {t('kolDetail.noSkillsFound')}
            </div>
          )}

          {detail?.pagination?.hasMore && (
            <div className="mt-6 text-center">
              <button
                onClick={openProfile}
                className="btn btn-secondary"
              >
                <ExternalLink size={18} />
                {t('kolDetail.viewAllSkills')}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t-2 border-border-light">
          <p className="text-xs text-muted-foreground text-center uppercase tracking-wider">
            {t('kolDetail.skillsTotal', { count: detail?.pagination?.total || kol.skillCount })}
          </p>
        </div>
      </div>
    </div>
  )
}
