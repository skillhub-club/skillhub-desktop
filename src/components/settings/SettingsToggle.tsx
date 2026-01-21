/**
 * SettingsToggle - A row with a toggle switch
 */

export interface SettingsToggleProps {
  label: string
  description?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
}

export function SettingsToggle({ 
  label, 
  description, 
  checked, 
  onCheckedChange,
  disabled = false 
}: SettingsToggleProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <div className="flex-1 min-w-0 pr-4">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {description && (
          <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors
                    ${checked ? 'bg-foreground' : 'bg-muted'}
                    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                    focus:outline-none focus:ring-2 focus:ring-foreground focus:ring-offset-2 focus:ring-offset-background`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full shadow-lg transition-transform
                      ${checked ? 'translate-x-4 bg-background' : 'translate-x-0.5 bg-foreground'}
                      mt-0.5`}
        />
      </button>
    </div>
  )
}
