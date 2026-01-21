import { useState, useCallback, useRef } from 'react'
import { fetchAccountOverview, fetchApiKeys, fetchWallet } from '../api/auth'

// Account data types
export interface AccountData {
  tier: string
  credits: number
  dailyUsed: number
  creditsUsedToday?: number
  weeklyUsage?: Array<{ date: string; count: number; credits_used: number }>
  favoritesCount?: number
  subscriptionStatus?: string
  subscriptionEnd?: string
}

export interface WalletData {
  balance: number
  currency: string
}

export interface ApiKeyData {
  id: string
  name: string
  key_prefix: string
  is_active: boolean
  created_at: string
}

// Cache TTL - 5 minutes
const CACHE_TTL = 5 * 60 * 1000

// Simple in-memory cache (shared across hook instances)
interface CacheEntry<T> {
  data: T
  timestamp: number
}

const cache = {
  account: null as CacheEntry<AccountData> | null,
  wallet: null as CacheEntry<WalletData> | null,
  apiKeys: null as CacheEntry<ApiKeyData[]> | null,
}

function isStale(timestamp: number | undefined): boolean {
  if (!timestamp) return true
  return Date.now() - timestamp > CACHE_TTL
}

export function useAccountCache() {
  const [accountData, setAccountData] = useState<AccountData | null>(cache.account?.data ?? null)
  const [walletData, setWalletData] = useState<WalletData | null>(cache.wallet?.data ?? null)
  const [apiKeys, setApiKeys] = useState<ApiKeyData[]>(cache.apiKeys?.data ?? [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Track if we're currently fetching to prevent duplicate requests
  const fetchingRef = useRef<Set<string>>(new Set())

  const loadAccountData = useCallback(async (force = false) => {
    if (!force && !isStale(cache.account?.timestamp)) {
      setAccountData(cache.account!.data)
      return cache.account!.data
    }
    
    if (fetchingRef.current.has('account')) return accountData
    
    fetchingRef.current.add('account')
    setLoading(true)
    setError(null)
    
    try {
      const data = await fetchAccountOverview()
      cache.account = { data, timestamp: Date.now() }
      setAccountData(data)
      return data
    } catch (err) {
      setError((err as Error).message)
      return null
    } finally {
      fetchingRef.current.delete('account')
      setLoading(false)
    }
  }, [accountData])

  const loadWalletData = useCallback(async (force = false) => {
    if (!force && !isStale(cache.wallet?.timestamp)) {
      setWalletData(cache.wallet!.data)
      return cache.wallet!.data
    }
    
    if (fetchingRef.current.has('wallet')) return walletData
    
    fetchingRef.current.add('wallet')
    setLoading(true)
    setError(null)
    
    try {
      const data = await fetchWallet()
      cache.wallet = { data, timestamp: Date.now() }
      setWalletData(data)
      return data
    } catch (err) {
      setError((err as Error).message)
      return null
    } finally {
      fetchingRef.current.delete('wallet')
      setLoading(false)
    }
  }, [walletData])

  const loadApiKeys = useCallback(async (force = false) => {
    if (!force && !isStale(cache.apiKeys?.timestamp)) {
      setApiKeys(cache.apiKeys!.data)
      return cache.apiKeys!.data
    }
    
    if (fetchingRef.current.has('apiKeys')) return apiKeys
    
    fetchingRef.current.add('apiKeys')
    setLoading(true)
    setError(null)
    
    try {
      const data = await fetchApiKeys()
      const keys = data.keys || []
      cache.apiKeys = { data: keys, timestamp: Date.now() }
      setApiKeys(keys)
      return keys
    } catch (err) {
      setError((err as Error).message)
      return []
    } finally {
      fetchingRef.current.delete('apiKeys')
      setLoading(false)
    }
  }, [apiKeys])

  const loadAll = useCallback(async (force = false) => {
    setLoading(true)
    setError(null)
    
    try {
      await Promise.all([
        loadAccountData(force),
        loadWalletData(force),
        loadApiKeys(force),
      ])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [loadAccountData, loadWalletData, loadApiKeys])

  const clearCache = useCallback(() => {
    cache.account = null
    cache.wallet = null
    cache.apiKeys = null
    setAccountData(null)
    setWalletData(null)
    setApiKeys([])
  }, [])

  const invalidateApiKeys = useCallback(() => {
    cache.apiKeys = null
  }, [])

  return {
    accountData,
    walletData,
    apiKeys,
    loading,
    error,
    loadAccountData,
    loadWalletData,
    loadApiKeys,
    loadAll,
    clearCache,
    invalidateApiKeys,
    isAccountStale: isStale(cache.account?.timestamp),
    isWalletStale: isStale(cache.wallet?.timestamp),
    isApiKeysStale: isStale(cache.apiKeys?.timestamp),
  }
}
