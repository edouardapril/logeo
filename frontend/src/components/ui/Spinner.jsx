import { Loader2 } from 'lucide-react'

export default function Spinner({ className = 'h-6 w-6', label }) {
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-gray-500">
      <Loader2 className={`animate-spin ${className}`} />
      {label && <span className="text-sm">{label}</span>}
    </div>
  )
}
