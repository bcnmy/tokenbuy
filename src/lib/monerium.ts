import crypto from 'crypto'

const CREDENTIALS_CLIENT_ID = process.env.MONERIUM_CLIENT_ID!
const CLIENT_SECRET = process.env.MONERIUM_CLIENT_SECRET!
const OAUTH_CLIENT_ID = process.env.MONERIUM_OAUTH_CLIENT_ID!
const BASE_URL = process.env.MONERIUM_API_URL || 'https://api.monerium.dev'
const REDIRECT_URI = process.env.MONERIUM_REDIRECT_URI || 'http://localhost:3000/api/monerium/callback'

const IS_SANDBOX = BASE_URL.includes('monerium.dev')
export const MONERIUM_CHAIN = IS_SANDBOX ? 'chiado' : 'gnosis'

const V2_ACCEPT = 'application/vnd.monerium.api-v2+json'

// --- PKCE Helpers ---

export function generateCodeVerifier(): string {
  return crypto.randomBytes(64).toString('base64url')
}

export function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url')
}

export function generateState(): string {
  return crypto.randomBytes(16).toString('hex')
}

// --- Auth Code Flow ---

export function buildAuthUrl(params: {
  codeChallenge: string
  state: string
  walletAddress?: string
  email?: string
  chain?: string
}): string {
  const url = new URL(`${BASE_URL}/auth`)
  url.searchParams.set('client_id', OAUTH_CLIENT_ID)
  url.searchParams.set('code_challenge', params.codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('redirect_uri', REDIRECT_URI)
  url.searchParams.set('state', params.state)
  if (params.walletAddress) url.searchParams.set('address', params.walletAddress)
  if (params.email) url.searchParams.set('email', params.email)
  if (params.chain) url.searchParams.set('chain', params.chain)
  return url.toString()
}

export type TokenResponse = {
  access_token: string
  expires_in: number
  refresh_token: string
  token_type: string
}

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
): Promise<TokenResponse> {
  const res = await fetch(`${BASE_URL}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: OAUTH_CLIENT_ID,
      code,
      code_verifier: codeVerifier,
      redirect_uri: REDIRECT_URI,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Monerium token exchange failed ${res.status}: ${text}`)
  }

  return res.json()
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch(`${BASE_URL}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: OAUTH_CLIENT_ID,
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Monerium token refresh failed ${res.status}: ${text}`)
  }

  return res.json()
}

// --- User-scoped API requests (with user's access token) ---

async function userApiRequest<T = unknown>(
  accessToken: string,
  method: string,
  path: string,
  body?: object,
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Accept: V2_ACCEPT,
  }
  if (body) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

  if (res.status === 204 || res.status === 202) return {} as T

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Monerium API ${res.status} ${method} ${path}: ${text}`)
  }

  const ct = res.headers.get('content-type') || ''
  if (ct.includes('json')) return res.json()
  return {} as T
}

// --- Auth context ---

export type AuthContext = {
  userId: string
  email: string
  name: string
  defaultProfile: string
  profiles: Array<{
    id: string
    kind: string
    name: string
    perms: string[]
  }>
}

export async function getAuthContext(accessToken: string): Promise<AuthContext> {
  return userApiRequest(accessToken, 'GET', '/auth/context')
}

// --- Profile ---

export type ProfileState = 'created' | 'pending' | 'approved' | 'rejected' | 'blocked'

export type ProfileInfo = {
  id: string
  kind: string
  name: string
  state: ProfileState
}

export async function getProfile(accessToken: string, profileId: string): Promise<ProfileInfo> {
  return userApiRequest(accessToken, 'GET', `/profiles/${profileId}`)
}

// --- IBANs ---

export type MoneriumIBAN = {
  iban: string
  bic: string
  name: string
  address: string
  chain: string
  profile: string
  state: string
  emailNotifications: boolean
}

export async function requestIBAN(
  accessToken: string,
  params: { address: string; chain: string; emailNotifications?: boolean },
): Promise<MoneriumIBAN> {
  return userApiRequest(accessToken, 'POST', '/ibans', {
    address: params.address,
    chain: params.chain,
    emailNotifications: params.emailNotifications ?? true,
  })
}

export async function getIBANs(accessToken: string): Promise<MoneriumIBAN[]> {
  const res = await userApiRequest<{ ibans: MoneriumIBAN[]; total: number } | MoneriumIBAN[]>(
    accessToken, 'GET', '/ibans',
  )
  if (Array.isArray(res)) return res
  return res.ibans ?? []
}

// --- Client Credentials (app-level, used for non-privileged calls) ---

let cachedAppToken: { accessToken: string; expiresAt: number } | null = null

export async function getAppAccessToken(): Promise<string> {
  if (cachedAppToken && Date.now() < cachedAppToken.expiresAt) {
    return cachedAppToken.accessToken
  }

  const res = await fetch(`${BASE_URL}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CREDENTIALS_CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Monerium app auth failed ${res.status}: ${text}`)
  }

  const data = await res.json()
  cachedAppToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  }
  return data.access_token
}
