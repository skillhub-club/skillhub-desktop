import { FileText } from 'lucide-react'

import FilePreview from '../FilePreview'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Spinner } from './Spinner'

interface ArtifactItem {
  path: string
  toolName: string
}

interface PlaygroundArtifactsPanelProps {
  artifacts: ArtifactItem[]
  selectedArtifactPath: string | null
  onSelectArtifact: (path: string) => void
  artifactLoading: boolean
  artifactError: string | null
  artifactContent: string
  title: string
  emptyLabel: string
  loadingLabel: string
}

export function PlaygroundArtifactsPanel({
  artifacts,
  selectedArtifactPath,
  onSelectArtifact,
  artifactLoading,
  artifactError,
  artifactContent,
  title,
  emptyLabel,
  loadingLabel,
}: PlaygroundArtifactsPanelProps) {
  return (
    <div className="w-80 border-l border-border-light flex flex-col bg-secondary/30">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-light">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-muted-foreground" />
          <h3 className="text-[13px] font-medium text-foreground">{title}</h3>
        </div>
        <Badge variant="secondary" className="text-[11px] px-1.5 py-0.5">
          {artifacts.length}
        </Badge>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {artifacts.length === 0 ? (
          <div className="text-[12px] text-muted-foreground/60 text-center py-8">
            {emptyLabel}
          </div>
        ) : (
          <div className="space-y-1.5">
            {artifacts.map((item) => (
              <Button
                key={item.path}
                onClick={() => onSelectArtifact(item.path)}
                variant="ghost"
                size="sm"
                className={`w-full h-auto justify-start text-left px-3 py-2 rounded-[6px] transition-colors ${
                  selectedArtifactPath === item.path
                    ? 'bg-foreground text-background'
                    : 'bg-background hover:bg-secondary'
                }`}
              >
                <div
                  className={`text-[12px] font-medium truncate ${
                    selectedArtifactPath === item.path ? '' : 'text-foreground'
                  }`}
                >
                  {item.path.split('/').pop() || item.path}
                </div>
                <div
                  className={`text-[10px] truncate ${
                    selectedArtifactPath === item.path ? 'opacity-70' : 'text-muted-foreground'
                  }`}
                >
                  {item.toolName}
                </div>
              </Button>
            ))}
          </div>
        )}

        {selectedArtifactPath && (
          <div className="mt-4">
            {artifactLoading && (
              <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Spinner className="text-[8px]" />
                {loadingLabel}
              </div>
            )}
            {artifactError && (
              <div className="text-[11px] text-[var(--destructive)]">{artifactError}</div>
            )}
            {!artifactLoading && !artifactError && (
              <FilePreview
                filename={selectedArtifactPath.split('/').pop() || selectedArtifactPath}
                content={artifactContent}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
