import { Check } from 'lucide-react'

// LOTPLOT 23 — Barre de progression du walkthrough.
// Desktop : stepper horizontal compact avec labels tronqués.
// Mobile : "Étape X / Y · <label-courant>" + barre fill.

export default function ProgressTracker({ steps, currentIndex }) {
  const total = steps.length
  const pct = Math.round(((currentIndex + 1) / total) * 100)

  return (
    <div className="bg-white border-b border-gray-200">
      {/* Mobile */}
      <div className="md:hidden px-4 py-2.5">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="font-semibold text-gray-700">
            Étape {currentIndex + 1} / {total}
          </span>
          <span className="text-gray-500 truncate max-w-[60%]">
            {steps[currentIndex]?.label || ''}
          </span>
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#EA580C] transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Desktop */}
      <div className="hidden md:block px-6 py-3 lg:pr-[376px]">
        <ol className="flex items-center gap-1 text-xs">
          {steps.map((s, i) => {
            const done = i < currentIndex
            const active = i === currentIndex
            return (
              <li key={s.id} className="flex items-center flex-1 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold flex-shrink-0 ${
                      done
                        ? 'bg-emerald-500 text-white'
                        : active
                        ? 'bg-[#EA580C] text-white ring-4 ring-[#FED7AA]'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {done ? <Check className="h-3 w-3" /> : i + 1}
                  </span>
                  <span
                    className={`truncate ${
                      active ? 'font-semibold text-gray-900' : done ? 'text-gray-600' : 'text-gray-400'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {i < total - 1 && (
                  <div
                    className={`flex-1 h-px mx-2 ${done ? 'bg-emerald-500' : 'bg-gray-200'}`}
                  />
                )}
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
