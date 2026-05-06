import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ShieldOff, ShieldCheck, AlertTriangle, RotateCcw } from 'lucide-react'
import { listSanctionsApi, liftSanctionApi } from '../../api/admin'
import Spinner from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'
import { Textarea } from '../../components/ui/Input'

const SEVERITY_BADGES = {
  warning:    { cls: 'bg-amber-50 text-amber-800 ring-amber-200', label: 'Avertissement' },
  suspension: { cls: 'bg-red-50 text-red-700 ring-red-200',       label: 'Suspension' },
  expulsion:  { cls: 'bg-red-100 text-red-900 ring-red-300',      label: 'Expulsion' },
}

const formatMoney = (n) =>
  n == null ? '—' : new Intl.NumberFormat('fr-CA', {
    style: 'currency', currency: 'CAD', minimumFractionDigits: 0,
  }).format(n)

export default function AdminSanctions() {
  const queryClient = useQueryClient()
  const [activeOnly, setActiveOnly] = useState(true)
  const [liftModal, setLiftModal] = useState(null)  // sanction id
  const [liftReason, setLiftReason] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'sanctions', activeOnly],
    queryFn: () => listSanctionsApi(activeOnly),
  })

  const lift = useMutation({
    mutationFn: ({ id, reason }) => liftSanctionApi(id, reason),
    onSuccess: () => {
      toast.success('Sanction levée')
      setLiftModal(null); setLiftReason('')
      queryClient.invalidateQueries({ queryKey: ['admin', 'sanctions'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erreur'),
  })

  const totalDepositsKept = (data || []).reduce(
    (s, x) => s + (x.deposit_kept_cad || 0), 0,
  )

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Sanctions</h1>
          <p className="text-sm text-gray-600">
            Comptes suspendus, expulsions, dépôts conservés en cas de désistement.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              className="rounded border-gray-300 text-[#EA580C]"
            />
            Actives seulement
          </label>
        </div>
      </div>

      {totalDepositsKept > 0 && (
        <div className="card p-4 mb-6 bg-[#FFEDD5] border-[#FDBA74]">
          <p className="text-xs text-[#9A3412]">Total dépôts conservés (sanctions actuellement listées)</p>
          <p className="text-2xl font-bold text-[#9A3412]">{formatMoney(totalDepositsKept)}</p>
        </div>
      )}

      {isLoading ? <Spinner /> : !data?.length ? (
        <div className="card p-12 text-center">
          <ShieldCheck className="h-12 w-12 mx-auto text-emerald-500 mb-3" />
          <p className="text-sm text-gray-600">
            {activeOnly ? 'Aucune sanction active.' : 'Aucune sanction enregistrée.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map(s => {
            const sev = SEVERITY_BADGES[s.severity] || SEVERITY_BADGES.warning
            const isActive = !s.lifted_at
            return (
              <div
                key={s.id}
                className={`card p-5 ${isActive ? 'border-l-4 border-l-red-400' : 'opacity-70'}`}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="font-semibold text-gray-900">{s.user_full_name || '—'}</p>
                      <span className="text-xs text-gray-500">{s.user_email}</span>
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ring-1 ring-inset ${sev.cls}`}>
                        <ShieldOff className="h-3 w-3" /> {sev.label}
                      </span>
                      {!isActive && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ring-1 ring-inset bg-emerald-50 text-emerald-700 ring-emerald-200">
                          Levée
                        </span>
                      )}
                    </div>
                    <div className="flex items-start gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-gray-700 whitespace-pre-line">{s.reason}</p>
                    </div>
                    <div className="text-xs text-gray-500 space-y-0.5">
                      <p>Imposée le {new Date(s.created_at).toLocaleString('fr-CA')}</p>
                      {s.deposit_kept_cad != null && (
                        <p>
                          Dépôt conservé : <strong>{formatMoney(s.deposit_kept_cad)}</strong>
                          {s.related_deal_id && (
                            <> · deal <code className="text-[10px]">{String(s.related_deal_id).slice(0, 8)}</code></>
                          )}
                        </p>
                      )}
                      {s.lifted_at && (
                        <p className="text-emerald-700">
                          Levée le {new Date(s.lifted_at).toLocaleString('fr-CA')}
                          {s.lifted_reason && ` — ${s.lifted_reason}`}
                        </p>
                      )}
                    </div>
                  </div>
                  {isActive && (
                    <button
                      onClick={() => { setLiftModal(s.id); setLiftReason('') }}
                      className="btn-secondary text-xs"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Lever la sanction
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal lever */}
      <Modal
        open={!!liftModal}
        onClose={() => { setLiftModal(null); setLiftReason('') }}
        title="Lever la sanction"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Si plus aucune sanction n'est active sur ce compte après cette levée, il sera réactivé automatiquement.
          </p>
          <Textarea
            label="Motif de la levée"
            value={liftReason}
            onChange={(e) => setLiftReason(e.target.value)}
            rows={3}
            placeholder="Décision admin, audit complété, etc."
          />
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setLiftModal(null)} className="btn-secondary">Annuler</button>
            <button
              onClick={() => {
                if (liftReason.trim().length < 3) { toast.error('Motif requis'); return }
                lift.mutate({ id: liftModal, reason: liftReason.trim() })
              }}
              disabled={lift.isPending}
              className="btn-primary"
            >
              {lift.isPending ? '...' : 'Lever la sanction'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
