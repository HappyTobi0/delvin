import { useState } from 'react'
import { VENDOR_CATEGORIES } from '../types'
import type { VendorCategory, VendorCreate } from '../types'

interface VendorFormProps {
  onSubmit: (payload: VendorCreate) => Promise<void>
}

export function VendorForm({ onSubmit }: VendorFormProps) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<VendorCategory>(VENDOR_CATEGORIES[0])
  const [contactEmail, setContactEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    try {
      await onSubmit({ name: name.trim(), category, contact_email: contactEmail.trim() })
      setName('')
      setCategory(VENDOR_CATEGORIES[0])
      setContactEmail('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="vendor-form" onSubmit={handleSubmit}>
      <h2>Register a vendor</h2>
      <label htmlFor="name">Name</label>
      <input
        id="name"
        required
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Acme Staffing"
      />

      <label htmlFor="category">Category</label>
      <select
        id="category"
        value={category}
        onChange={(event) => setCategory(event.target.value as VendorCategory)}
      >
        {VENDOR_CATEGORIES.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      <label htmlFor="contact_email">Contact email</label>
      <input
        id="contact_email"
        type="email"
        required
        value={contactEmail}
        onChange={(event) => setContactEmail(event.target.value)}
        placeholder="hiring@acme.com"
      />

      <button type="submit" disabled={submitting}>
        {submitting ? 'Registering…' : 'Register vendor'}
      </button>
    </form>
  )
}
