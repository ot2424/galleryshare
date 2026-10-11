// Camera/phone names often retain the capture date even when older uploads have
// no stored timestamps or copying the originals changed their modification date.
export function dateFromFilename(filename = '') {
  const match = filename.match(/(?:^|[^\d])((?:19|20)\d{2})[-_]?([01]\d)[-_]?([0-3]\d)(?:[T _-]([0-2]\d)[-_:]?([0-5]\d)[-_:]?([0-5]\d))?(?=[^\d]|$)/)
  if (!match) return null
  const [, year, month, day, hour = '00', minute = '00', second = '00'] = match
  const date = new Date(Date.UTC(+year, +month - 1, +day, +hour, +minute, +second))
  // Reject impossible dates rather than allowing JS to roll them into a new month.
  if (date.getUTCFullYear() !== +year || date.getUTCMonth() !== +month - 1 ||
      date.getUTCDate() !== +day || date.getUTCHours() !== +hour) return null
  return date.getTime()
}

export function sortGalleryFiles(files, order = 'date-asc') {
  const name = file => file.originalname || file.filename || ''
  const date = file => {
    for (const value of [file.capturedAt, dateFromFilename(name(file)), file.lastModified, file.uploadedAt, file.createdAt, file.timestamp]) {
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
    // For undated originals, natural names preserve camera sequences more
    // reliably than database IDs assigned by parallel uploads.
    if (aDate === null || bDate === null) {
      if (aDate !== bDate) return aDate === null ? 1 : -1
      return (order === 'date-desc' ? -1 : 1) * (compareName(a, b) || ((Number(a.id) || 0) - (Number(b.id) || 0)))
    }
    return (order === 'date-desc' ? -1 : 1) * (aDate - bDate) || compareName(a, b)
  })
}
