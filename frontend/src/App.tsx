import { useCallback, useEffect, useState } from 'react'
import './App.css'
import { createVendor, fetchVendors } from './api'
import { VendorForm } from './components/VendorForm'
import { VendorTable } from './components/VendorTable'
import type { Vendor, VendorCreate } from './types'

function App() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadVendors = useCallback(async () => {
    try {
      setVendors(await fetchVendors())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load vendors')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadVendors()
  }, [loadVendors])

  const handleCreate = async (payload: VendorCreate) => {
    try {
      await createVendor(payload)
      await loadVendors()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register vendor')
    }
  }

  return (
    <main className="page">
      <h1>Vendor Onboarding Portal</h1>
      {error && <p className="error">{error}</p>}
      <VendorForm onSubmit={handleCreate} />
      <section>
        <h2>Registered vendors</h2>
        {loading ? <p>Loading…</p> : <VendorTable vendors={vendors} />}
      </section>
    </main>
  )
}

export default App
