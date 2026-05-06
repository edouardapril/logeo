const STATUS_STYLES = {
  draft:     'bg-gray-100 text-gray-700 ring-gray-200',
  analyse:   'bg-amber-50 text-amber-700 ring-amber-200',
  bid:       'bg-[#FFEDD5] text-[#C2410C] ring-[#FDBA74]',
  intro:     'bg-emerald-50 text-emerald-700 ring-emerald-200',
  pa_signed: 'bg-green-50 text-green-700 ring-green-200',
  nogo:      'bg-red-50 text-red-700 ring-red-200',
}

const STATUS_LABELS = {
  draft:     'Brouillon',
  analyse:   'En analyse',
  bid:       'Enchère active',
  intro:     'Intro confirmée',
  pa_signed: 'PA signée',
  nogo:      'Refusé',
}

export default function Badge({ status, children, className = '' }) {
  if (status) {
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status] || STATUS_STYLES.draft} ${className}`}>
        {STATUS_LABELS[status] || status}
      </span>
    )
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset bg-gray-100 text-gray-700 ring-gray-200 ${className}`}>
      {children}
    </span>
  )
}
