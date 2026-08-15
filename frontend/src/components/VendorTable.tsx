import type { Vendor } from '../types'

interface VendorTableProps {
  vendors: Vendor[]
}

export function VendorTable({ vendors }: VendorTableProps) {
  if (vendors.length === 0) {
    return <p className="empty">No vendors registered yet.</p>
  }

  return (
    <table className="vendor-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Category</th>
          <th>Contact email</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {vendors.map((vendor) => (
          <tr key={vendor.id}>
            <td>{vendor.name}</td>
            <td>{vendor.category}</td>
            <td>{vendor.contact_email}</td>
            <td>
              <span className="status">{vendor.status}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
