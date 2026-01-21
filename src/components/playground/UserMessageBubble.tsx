/**
 * UserMessageBubble - Right-aligned user message display
 * 
 * Craft Agents style:
 * - Right-aligned
 * - Max 80% width
 * - Subtle background (5% foreground)
 * - Pill-shaped corners (16px)
 */

export interface UserMessageBubbleProps {
  /** Message content */
  content: string
  /** Additional className */
  className?: string
}

export function UserMessageBubble({ content, className = '' }: UserMessageBubbleProps) {
  return (
    <div className={`flex justify-end w-full ${className}`}>
      <div className="max-w-[80%] bg-secondary rounded-[16px] px-5 py-3.5 break-words">
        <p className="text-sm text-foreground whitespace-pre-wrap m-0">
          {content}
        </p>
      </div>
    </div>
  )
}
