import { ensureValidToken, SKILLHUB_URL } from './auth'

export type PlaygroundStreamEvent =
  | { type: 'content'; content: string }
  | { type: 'quota'; quota: { dailyUsed: number; dailyLimit: number; dailyRemaining: number; credits: number; usedCredits: boolean } }
  | { type: 'error'; error: string }
  | { type: 'done' }

export interface PlaygroundRunPayload {
  message: string
  skillContent?: string
  skillSlug?: string
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
}

function parseSseChunk(chunk: string): PlaygroundStreamEvent[] {
  const events: PlaygroundStreamEvent[] = []
  const blocks = chunk.split('\n\n')
  for (const block of blocks) {
    const line = block.trim()
    if (!line.startsWith('data:')) continue
    const data = line.replace(/^data:\s*/, '')
    try {
      const parsed = JSON.parse(data) as PlaygroundStreamEvent
      events.push(parsed)
    } catch {
      // ignore malformed chunk
    }
  }
  return events
}

export async function streamPlaygroundRun(
  payload: PlaygroundRunPayload,
  onEvent: (event: PlaygroundStreamEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const token = await ensureValidToken()
  if (!token) {
    throw new Error('AUTH_REQUIRED')
  }

  const response = await fetch(`${SKILLHUB_URL}/api/playground/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Accept: 'text/event-stream',
    },
    signal,
    body: JSON.stringify(payload),
  })

  if (!response.ok || !response.body) {
    const errorText = await response.text()
    throw new Error(errorText || 'Failed to start playground run')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lastSeparator = buffer.lastIndexOf('\n\n')
    if (lastSeparator !== -1) {
      const chunk = buffer.slice(0, lastSeparator)
      buffer = buffer.slice(lastSeparator + 2)
      for (const event of parseSseChunk(chunk)) {
        onEvent(event)
      }
    }
  }

  if (buffer.trim()) {
    for (const event of parseSseChunk(buffer)) {
      onEvent(event)
    }
  }
}
