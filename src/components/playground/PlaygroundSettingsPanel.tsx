import { Button } from '../ui/button'
import { Input } from '../ui/input'

interface ModeOption {
  value: string
  label: string
}

interface PlaygroundSettingsPanelProps {
  permissionModes: ModeOption[]
  activePermissionMode: string
  onPermissionChange: (value: string) => void
  skillModes: ModeOption[]
  activeSkillMode: string
  onSkillModeChange: (value: string) => void
  workingDirectory: string
  onWorkingDirectoryChange: (value: string) => void
  workingDirectoryLabel: string
  permissionsLabel: string
  skillModeLabel: string
  workingDirectoryPlaceholder: string
}

export function PlaygroundSettingsPanel({
  permissionModes,
  activePermissionMode,
  onPermissionChange,
  skillModes,
  activeSkillMode,
  onSkillModeChange,
  workingDirectory,
  onWorkingDirectoryChange,
  workingDirectoryLabel,
  permissionsLabel,
  skillModeLabel,
  workingDirectoryPlaceholder,
}: PlaygroundSettingsPanelProps) {
  return (
    <div className="px-5 py-3 border-b border-border-light bg-secondary/30">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-3">
          <label className="text-[12px] text-muted-foreground w-24">{permissionsLabel}</label>
          <div className="flex gap-1.5">
            {permissionModes.map((mode) => (
              <Button
                key={mode.value}
                variant={activePermissionMode === mode.value ? 'default' : 'secondary'}
                size="sm"
                onClick={() => onPermissionChange(mode.value)}
                className="h-auto px-2.5 py-1 text-[11px] font-medium shadow-minimal"
              >
                {mode.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-[12px] text-muted-foreground w-24">{skillModeLabel}</label>
          <div className="flex gap-1.5">
            {skillModes.map((mode) => (
              <Button
                key={mode.value}
                variant={activeSkillMode === mode.value ? 'default' : 'secondary'}
                size="sm"
                onClick={() => onSkillModeChange(mode.value)}
                className="h-auto px-2.5 py-1 text-[11px] font-medium shadow-minimal"
              >
                {mode.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-[12px] text-muted-foreground w-24">{workingDirectoryLabel}</label>
          <Input
            value={workingDirectory}
            onChange={(e) => onWorkingDirectoryChange(e.target.value)}
            placeholder={workingDirectoryPlaceholder}
            className="h-7 text-[11px]"
          />
        </div>
      </div>
    </div>
  )
}
