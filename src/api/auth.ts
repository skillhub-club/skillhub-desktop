import { useAppStore } from '../store'

// Get the API base URL from environment or default to production
const SKILLHUB_URL = import.meta.env.VITE_SKILLHUB_API_URL || 'https://www.skillhub.club'
const OAUTH_CLIENT_ID = 'skillhub-desktop'

// Buffer time before token expiry to trigger refresh (5 minutes)
const TOKEN_REFRESH_BUFFER = 5 * 60 * 1000

interface RefreshResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token: string
  scope: string
}

// Check if token needs refresh
export function isTokenExpiringSoon(): boolean {
  const { tokenExpiresAt } = useAppStore.getState()
  if (!tokenExpiresAt) return true
  return Date.now() > tokenExpiresAt - TOKEN_REFRESH_BUFFER
}

// Check if token is completely expired
export function isTokenExpired(): boolean {
  const { tokenExpiresAt } = useAppStore.getState()
  if (!tokenExpiresAt) return true
  return Date.now() > tokenExpiresAt
}

// Refresh the access token using refresh token
export async function refreshAccessToken(): Promise<boolean> {
  const { refreshToken, updateTokens, logout } = useAppStore.getState()

  if (!refreshToken) {
    console.error('No refresh token available')
    logout()
    return false
  }

  try {
    const response = await fetch(`${SKILLHUB_URL}/api/v1/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: OAUTH_CLIENT_ID,
      }),
    })

    if (!response.ok) {
      console.error('Token refresh failed:', response.status)
      logout()
      return false
    }

    const data: RefreshResponse = await response.json()

    // Calculate new expiry time
    const expiresAt = Date.now() + data.expires_in * 1000

    // Update store with new tokens
    updateTokens(data.access_token, expiresAt)

    console.log('Token refreshed successfully')
    return true
  } catch (error) {
    console.error('Token refresh error:', error)
    logout()
    return false
  }
}

// Ensure we have a valid token, refreshing if necessary
export async function ensureValidToken(): Promise<string | null> {
  const { accessToken, isAuthenticated } = useAppStore.getState()

  if (!isAuthenticated || !accessToken) {
    return null
  }

  // Check if token is expiring soon
  if (isTokenExpiringSoon()) {
    const refreshed = await refreshAccessToken()
    if (!refreshed) {
      return null
    }
    // Return the new token from store
    return useAppStore.getState().accessToken
  }

  return accessToken
}

// Make an authenticated API request with automatic token refresh
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await ensureValidToken()

  if (!token) {
    throw new Error('Not authenticated')
  }

  // Clone the body for potential retry (body can only be consumed once)
  // If body is a string, we can reuse it; otherwise clone the options
  const bodyForRetry = options.body

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  })

  // If we get 401, try to refresh token and retry once
  if (response.status === 401) {
    console.log('Got 401, attempting token refresh...')
    const refreshed = await refreshAccessToken()

    if (refreshed) {
      const newToken = useAppStore.getState().accessToken
      return fetch(url, {
        ...options,
        body: bodyForRetry, // Use the saved body for retry
        headers: {
          ...options.headers,
          Authorization: `Bearer ${newToken}`,
        },
      })
    }

    throw new Error('Authentication failed')
  }

  return response
}

// Fetch user's favorites with auto token refresh
export async function fetchFavorites() {
  const response = await authenticatedFetch(`${SKILLHUB_URL}/api/v1/oauth/favorites`)

  if (!response.ok) {
    throw new Error('Failed to fetch favorites')
  }

  const data = await response.json()
  return data.favorites || []
}

// Fetch user's collections with auto token refresh
export async function fetchCollections() {
  const response = await authenticatedFetch(`${SKILLHUB_URL}/api/v1/oauth/collections`)

  if (!response.ok) {
    throw new Error('Failed to fetch collections')
  }

  const data = await response.json()
  return data.collections || []
}

// Fetch user info with auto token refresh
export async function fetchUserInfo() {
  const response = await authenticatedFetch(`${SKILLHUB_URL}/api/v1/oauth/userinfo`)

  if (!response.ok) {
    throw new Error('Failed to fetch user info')
  }

  return response.json()
}

// Exchange authorization code for tokens (initial login)
export async function exchangeCodeForTokens(code: string) {
  const response = await fetch(`${SKILLHUB_URL}/api/v1/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      client_id: OAUTH_CLIENT_ID,
      redirect_uri: 'desktop://callback',
    }),
  })

  if (!response.ok) {
    throw new Error('Invalid code')
  }

  const data = await response.json()

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    scope: data.scope,
  }
}

// Fetch account overview (quota, credits, tier)
export async function fetchAccountOverview() {
  const response = await authenticatedFetch(`${SKILLHUB_URL}/api/v1/oauth/account`)

  if (!response.ok) {
    throw new Error('Failed to fetch account info')
  }

  return response.json()
}

// Fetch usage stats
export async function fetchUsageStats() {
  const response = await authenticatedFetch(`${SKILLHUB_URL}/api/v1/oauth/usage`)

  if (!response.ok) {
    throw new Error('Failed to fetch usage stats')
  }

  return response.json()
}

// Fetch API keys
export async function fetchApiKeys() {
  const response = await authenticatedFetch(`${SKILLHUB_URL}/api/v1/oauth/api-keys`)

  if (!response.ok) {
    // Try to get error message from response
    try {
      const data = await response.json()
      throw new Error(data.error || `Failed to fetch API keys (${response.status})`)
    } catch {
      throw new Error(`Failed to fetch API keys (${response.status})`)
    }
  }

  return response.json()
}

// Create API key
export async function createApiKey(name: string) {
  const response = await authenticatedFetch(`${SKILLHUB_URL}/api/v1/oauth/api-keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })

  if (!response.ok) {
    const data = await response.json()
    throw new Error(data.error || 'Failed to create API key')
  }

  return response.json()
}

// Delete API key
export async function deleteApiKey(id: string) {
  const response = await authenticatedFetch(`${SKILLHUB_URL}/api/v1/oauth/api-keys/${id}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    throw new Error('Failed to delete API key')
  }

  return response.json()
}

// Fetch wallet balance
export async function fetchWallet() {
  const response = await authenticatedFetch(`${SKILLHUB_URL}/api/v1/oauth/wallet`)

  if (!response.ok) {
    throw new Error('Failed to fetch wallet')
  }

  return response.json()
}

export { SKILLHUB_URL, OAUTH_CLIENT_ID }
