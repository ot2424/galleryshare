// Use the file modification date, falling back to upload time for older uploads.
export function sortGalleryFiles(files, order = 'date-asc') {
  const name = file => file.originalname || file.filename || ''
  const date = file => {
    for (const value of [file.lastModified, file.uploadedAt, file.createdAt, file.timestamp]) {
      if (value == null || value === '') continue
      const parsed = typeof value === 'number' ? value : (/^\d+$/.test(value) ? Number(value) : Date.parse(value))
      if (Number.isFinite(parsed) && parsed > 0) return parsed
    }
    return null
  }
  const compareName = (a, b) => name(a).localeCompare(name(b), 'de', { numeric: true, sensitivity: 'base' })
  return [...files].sort((a, b) => {
    if (order.startsWith('name-')) return (order === 'name-desc' ? -1 : 1) * compareName(a, b)
    const aDate = date(a), bDate = date(b)
    // Undated legacy media retain upload order, after dated media.
    if (aDate === null || bDate === null) {
      if (aDate !== bDate) return aDate === null ? 1 : -1
      return (order === 'date-desc' ? -1 : 1) * ((Number(a.id) || 0) - (Number(b.id) || 0)) || compareName(a, b)
    }
    return (order === 'date-desc' ? -1 : 1) * (aDate - bDate) || compareName(a, b)
  })
}
