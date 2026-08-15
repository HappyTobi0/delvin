import type { Vendor, VendorCreate } from './types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

async function parseError(response: Response): Promise<string> {
  try {
    const body = await response.json()
    if (typeof body.detail === 'string') return body.detail
    if (Array.isArray(body.detail) && body.detail.length > 0) {
      return body.detail.map((item: { msg?: string }) => item.msg ?? '').join(', ')
    }
  } catch {
    // fall through to generic message
  }
  return `Request failed with status ${response.status}`
}

export async function fetchVendors(): Promise<Vendor[]> {
  const response = await fetch(`${API_BASE_URL}/vendors`)
  if (!response.ok) throw new Error(await parseError(response))
  return response.json()
}

export async function createVendor(payload: VendorCreate): Promise<Vendor> {
  const response = await fetch(`${API_BASE_URL}/vendors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json()
}
