import { Trophy } from 'lucide-react'

export default function BidRanking({ ranking }) {
  if (!ranking?.length) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        Aucune offre soumise pour le moment. Soyez le premier !
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-3">
        Classement anonyme · Positions seulement
      </p>
      {ranking.map((row) => {
        const isFirst = row.rank === 1
        return (
          <div
            key={row.rank}
            className={`flex items-center justify-between rounded-lg px-4 py-3 border ${
              row.is_mine
                ? 'bg-[#FFEDD5] border-[#FDBA74]'
                : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className="flex items-center gap-3">
              {isFirst && <Trophy className="h-4 w-4 text-amber-500" />}
              <span className={`font-semibold ${isFirst ? 'text-amber-700' : 'text-gray-700'}`}>
                {row.rank === 1 ? '1ère position' : `${row.rank}e position`}
              </span>
              {row.is_mine && (
                <span className="text-xs font-medium text-[#C2410C] bg-[#FED7AA] px-2 py-0.5 rounded-full">
                  Vous
                </span>
              )}
            </div>
            <span className="text-xs text-gray-400">Montant masqué</span>
          </div>
        )
      })}
    </div>
  )
}
