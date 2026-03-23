import crypto from 'crypto'

const APP_TOKEN = process.env.SUMSUB_APP_TOKEN!
const SECRET_KEY = process.env.SUMSUB_SECRET_KEY!
const BASE_URL = 'https://api.sumsub.com'

export const LEVEL_NAME = process.env.SUMSUB_LEVEL_NAME || 'id-and-liveness'

function sign(method: string, path: string, body?: string) {
  const ts = Math.floor(Date.now() / 1000).toString()
  const hmac = crypto.createHmac('sha256', SECRET_KEY)
  hmac.update(ts + method.toUpperCase() + path + (body || ''))
  return { ts, sig: hmac.digest('hex') }
}

async function apiRequest<T = unknown>(
  method: string,
  path: string,
  body?: object,
): Promise<T> {
  const bodyStr = body ? JSON.stringify(body) : undefined
  const { ts, sig } = sign(method, path, bodyStr)

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'X-App-Token': APP_TOKEN,
      'X-App-Access-Sig': sig,
      'X-App-Access-Ts': ts,
      ...(bodyStr ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(bodyStr ? { body: bodyStr } : {}),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`SumSub API ${res.status}: ${text}`)
  }

  return res.json()
}

export async function createApplicant(
  externalUserId: string,
): Promise<{ id: string }> {
  return apiRequest('POST', `/resources/applicants?levelName=${LEVEL_NAME}`, {
    externalUserId,
  })
}

export async function generateAccessToken(
  externalUserId: string,
): Promise<{ token: string; userId: string }> {
  return apiRequest(
    'POST',
    `/resources/accessTokens?userId=${encodeURIComponent(externalUserId)}&levelName=${LEVEL_NAME}&ttlInSecs=1200`,
  )
}

type ApplicantInfo = {
  id: string
  email?: string
  info?: ApplicantPersonalInfo
  fixedInfo?: ApplicantPersonalInfo
  review?: {
    reviewStatus?: string
    reviewResult?: { reviewAnswer?: string }
  }
}

type ApplicantPersonalInfo = {
  firstName?: string
  firstNameEn?: string
  lastName?: string
  lastNameEn?: string
  middleName?: string
  dob?: string
  country?: string
  nationality?: string
  addresses?: Array<{
    street?: string
    buildingNumber?: string
    flatNumber?: string
    town?: string
    postCode?: string
    country?: string
    state?: string
  }>
  idDocs?: Array<{
    idDocType?: string
    number?: string
    country?: string
    firstName?: string
    lastName?: string
    dob?: string
    validUntil?: string
  }>
}

export async function getApplicantByExternalId(
  externalUserId: string,
): Promise<ApplicantInfo | null> {
  try {
    return await apiRequest(
      'GET',
      `/resources/applicants/-;externalUserId=${encodeURIComponent(externalUserId)}/one`,
    )
  } catch {
    return null
  }
}

export type SumsubApplicantData = {
  applicantId: string
  email: string | null
  firstName: string
  lastName: string
  dob: string
  nationality: string
  country: string
  city: string
  street: string
  postalCode: string
  countryState: string
  idDocNumber: string
  idDocType: string
}

export async function getFullApplicantData(
  externalUserId: string,
): Promise<SumsubApplicantData | null> {
  const applicant = await getApplicantByExternalId(externalUserId)
  if (!applicant) return null

  const info = applicant.info || applicant.fixedInfo || {}
  const addr = info.addresses?.[0]
  const doc = info.idDocs?.[0]

  return {
    applicantId: applicant.id,
    email: applicant.email || null,
    firstName: info.firstNameEn || info.firstName || '',
    lastName: info.lastNameEn || info.lastName || '',
    dob: info.dob || '',
    nationality: info.nationality || info.country || '',
    country: addr?.country || info.country || '',
    city: addr?.town || '',
    street: [addr?.street, addr?.buildingNumber, addr?.flatNumber]
      .filter(Boolean)
      .join(' ') || '',
    postalCode: addr?.postCode || '',
    countryState: addr?.state || '',
    idDocNumber: doc?.number || '',
    idDocType: doc?.idDocType || 'PASSPORT',
  }
}

export function verifyWebhookSignature(
  rawBody: string,
  digest: string,
  secret: string,
): boolean {
  const computed = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')
  try {
    return crypto.timingSafeEqual(
      Buffer.from(computed, 'hex'),
      Buffer.from(digest, 'hex'),
    )
  } catch {
    return false
  }
}
