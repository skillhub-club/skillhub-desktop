import { authenticatedFetch, SKILLHUB_URL } from './auth'
import type {
  PullResponse,
  PushRequest,
  PushResponse,
  RemoteStatus,
  VersionListResponse,
  HistoryResponse,
  DiffResponse,
  SyncFile,
  CompareResult,
} from '../types'

// Pull a skill from the server (optionally at a specific version)
export async function pullSkill(skillId: string, version?: number): Promise<PullResponse> {
  let url = `${SKILLHUB_URL}/api/user/skills/${skillId}/pull`
  if (version !== undefined) {
    url += `?version=${version}`
  }

  const response = await authenticatedFetch(url)
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || `Failed to pull skill (${response.status})`)
  }

  return response.json()
}

// Push local files to the server
export async function pushSkill(request: PushRequest): Promise<PushResponse> {
  const response = await authenticatedFetch(`${SKILLHUB_URL}/api/user/skills/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || `Failed to push skill (${response.status})`)
  }

  return response.json()
}

// Get remote status (current version, file hashes)
export async function getRemoteStatus(skillId: string): Promise<RemoteStatus> {
  const response = await authenticatedFetch(
    `${SKILLHUB_URL}/api/user/skills/${skillId}/status`
  )

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || `Failed to get remote status (${response.status})`)
  }

  return response.json()
}

// Get list of all versions for a skill
export async function getSkillVersions(skillId: string): Promise<VersionListResponse> {
  const response = await authenticatedFetch(
    `${SKILLHUB_URL}/api/user/skills/${skillId}/versions`
  )

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || `Failed to get versions (${response.status})`)
  }

  return response.json()
}

// Get version history with optional diffs
export async function getSkillHistory(
  skillId: string,
  opts?: { limit?: number; offset?: number; include_diff?: boolean }
): Promise<HistoryResponse> {
  const params = new URLSearchParams()
  if (opts?.limit) params.set('limit', String(opts.limit))
  if (opts?.offset) params.set('offset', String(opts.offset))
  if (opts?.include_diff) params.set('include_diff', 'true')

  const qs = params.toString()
  const url = `${SKILLHUB_URL}/api/user/skills/${skillId}/history${qs ? `?${qs}` : ''}`

  const response = await authenticatedFetch(url)
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || `Failed to get history (${response.status})`)
  }

  return response.json()
}

// Get diff between two versions
export async function getSkillDiff(
  skillId: string,
  from: number,
  to: number,
  includeContent: boolean = false
): Promise<DiffResponse> {
  const params = new URLSearchParams({
    from: String(from),
    to: String(to),
  })
  if (includeContent) {
    params.set('include_content', 'true')
  }

  const response = await authenticatedFetch(
    `${SKILLHUB_URL}/api/user/skills/${skillId}/diff?${params.toString()}`
  )

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || `Failed to get diff (${response.status})`)
  }

  return response.json()
}

// Export skill as Git ZIP archive
export async function exportSkillGit(skillId: string): Promise<Blob> {
  const response = await authenticatedFetch(
    `${SKILLHUB_URL}/api/user/skills/${skillId}/export-git`
  )

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || `Failed to export skill (${response.status})`)
  }

  return response.blob()
}

// Compare local files against remote status (pure function, no server call)
export function compareLocalRemote(
  localFiles: SyncFile[],
  remoteStatus: RemoteStatus
): CompareResult {
  const localMap = new Map(localFiles.map(f => [f.filepath, f.content_hash]))
  const remoteMap = new Map(remoteStatus.files.map(f => [f.filepath, f.content_hash]))

  const added: string[] = []
  const modified: string[] = []
  const deleted: string[] = []

  // Files in local but not remote = added
  // Files in both but different hash = modified
  for (const [filepath, hash] of localMap) {
    const remoteHash = remoteMap.get(filepath)
    if (!remoteHash) {
      added.push(filepath)
    } else if (remoteHash !== hash) {
      modified.push(filepath)
    }
  }

  // Files in remote but not local = deleted
  for (const filepath of remoteMap.keys()) {
    if (!localMap.has(filepath)) {
      deleted.push(filepath)
    }
  }

  return {
    has_changes: added.length > 0 || modified.length > 0 || deleted.length > 0,
    added,
    modified,
    deleted,
  }
}
