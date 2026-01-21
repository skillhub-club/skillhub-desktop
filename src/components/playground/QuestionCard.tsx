/**
 * QuestionCard - Craft Agents style question UI
 * 
 * Shows questions from Claude with selectable options
 * Uses shadow-minimal style instead of colored borders
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { HelpCircle, Check } from 'lucide-react'

export interface QuestionOption {
  label: string
  description?: string
}

export interface Question {
  question: string
  header: string
  options: QuestionOption[]
  multiSelect: boolean
}

export interface QuestionCardProps {
  questions: Question[]
  onSubmit: (answers: Record<number, string[]>) => void
  onSkip: () => void
}

export function QuestionCard({ questions, onSubmit, onSkip }: QuestionCardProps) {
  const { t } = useTranslation()
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string[]>>({})

  const handleAnswerSelect = (questionIndex: number, optionLabel: string, multiSelect: boolean) => {
    setSelectedAnswers(prev => {
      const current = prev[questionIndex] || []
      if (multiSelect) {
        if (current.includes(optionLabel)) {
          return { ...prev, [questionIndex]: current.filter(a => a !== optionLabel) }
        } else {
          return { ...prev, [questionIndex]: [...current, optionLabel] }
        }
      } else {
        return { ...prev, [questionIndex]: [optionLabel] }
      }
    })
  }

  const handleSubmit = () => {
    onSubmit(selectedAnswers)
  }

  const hasAnswers = Object.keys(selectedAnswers).length > 0

  return (
    <div className="bg-background shadow-minimal rounded-[8px] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/30 flex items-center gap-2">
        <HelpCircle className="w-4 h-4 text-muted-foreground" />
        <span className="text-foreground font-medium text-sm">Claude needs your input</span>
      </div>

      {/* Questions */}
      <div className="p-4 space-y-4">
        {questions.map((q, qIdx) => (
          <div key={qIdx} className="space-y-2">
            <p className="text-foreground font-medium text-sm">{q.question}</p>
            <div className="space-y-1.5">
              {q.options.map((opt, optIdx) => {
                const isSelected = (selectedAnswers[qIdx] || []).includes(opt.label)
                return (
                  <button
                    key={optIdx}
                    onClick={() => handleAnswerSelect(qIdx, opt.label, q.multiSelect)}
                    className={`w-full text-left px-3 py-2.5 rounded-[6px] transition-all text-sm
                                ${isSelected
                                  ? 'bg-foreground text-background shadow-minimal'
                                  : 'bg-secondary/50 text-foreground hover:bg-secondary shadow-minimal'
                                }`}
                  >
                    <div className="flex items-center gap-2">
                      {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                      <span className="font-medium">{opt.label}</span>
                    </div>
                    {opt.description && (
                      <span className={`text-xs mt-0.5 block ${isSelected ? 'opacity-70' : 'text-muted-foreground'}`}>
                        {opt.description}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSubmit}
            disabled={!hasAnswers}
            className="px-4 py-2 bg-foreground hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground
                       text-background font-medium text-sm rounded-[6px] transition-colors"
          >
            {t('questionCard.submit')}
          </button>
          <button
            onClick={onSkip}
            className="px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-secondary
                       font-medium text-sm rounded-[6px] transition-colors shadow-minimal"
          >
            {t('questionCard.skip')}
          </button>
        </div>
      </div>
    </div>
  )
}
