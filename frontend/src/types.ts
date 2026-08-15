export const VENDOR_CATEGORIES = [
  'Staffing Agency',
  'Freelance Platform',
  'Consultant',
] as const

export type VendorCategory = (typeof VENDOR_CATEGORIES)[number]

export interface Vendor {
  id: number
  name: string
  category: VendorCategory
  contact_email: string
  status: string
}

export interface VendorCreate {
  name: string
  category: VendorCategory
  contact_email: string
}
