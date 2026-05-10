import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Network, UserPlus, Pause, XCircle, ArrowLeft, MapPin } from 'lucide-react'
import {
  adminListPartnersApi, adminGetPartnerApi, adminCreatePartnerApi,
  adminSuspendPartnerApi, adminTerminatePartnerApi, adminListTerritoriesApi,
} from '../../api/admin'
import Spinner from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'
import Input, { Select, Textarea } from '../../components/ui/Input'

const formatMoney = (n) =>
  n == null ? '—' : new Intl.NumberFormat('fr-CA', {
    style: 'currency', currency: 'CAD', minimumFractionDigits: 0,
  }).format(n)

const STATUS_LABEL = {
  active: { label: 'Actif', tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  on_hold: { label: 'Suspendu', tone: 'bg-amber-50 text-amber-700 ring-amber-200' },
  quit_voluntary: { label: 'Cessé · volontaire', tone: 'bg-gray-100 text-gray-700 ring-gray-200' },
  terminated_for_cause: { label: 'Cessé · pour cause', tone: 'bg-red-50 text-red-700 ring-red-200' },
  terminated_without_cause: { label: 'Cessé · sans cause', tone: 'bg-gray-100 text-gray-700 ring-gray-200' },
  deceased: { label: 'Cessé · décès', tone: 'bg-gray-100 text-gray-700 ring-gray-200' },
}

const TERMINATE_CLAUSES = [
  { value: 'voluntary', label: 'Volontaire (départ du partenaire)' },
  { value: 'for_cause', label: 'Pour cause (faute)' },
  { value: 'without_cause', label: 'Sans cause (décision Logeo)' },
  { value: 'deceased', label: 'Décès' },
]

function StatusChip({ status }) {
  const cfg = STATUS_LABEL[status] || { label: status, tone: 'bg-gray-100 text-gray-700 ring-gray-200' }
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ring-1 ring-inset ${cfg.tone}`}>
      {cfg.label}
    </span>
  )
}

export default function AdminPartners() {
  const queryClient = useQueryClient()
  const [drilldownId, setDrilldownId] = useState(null)
  const [createModal, setCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({
    user_email: '', territory_id: '', commission_rate: 0.25, contract_signed_at: '', notes: '',
  })
  const [terminateModal, setTerminateModal] = useState(null) // { profile_id, full_name }
  const [terminateForm, setTerminateForm] = useState({ clause: 'voluntary', reason: '' })

  const partners = useQuery({
    queryKey: ['admin', 'partners'],
    queryFn: adminListPartnersApi,
  })
  const territories = useQuery({
    queryKey: ['admin', 'territories'],
    queryFn: adminListTerritoriesApi,
  })
  const detail = useQuery({
    queryKey: ['admin', 'partners', drilldownId],
    queryFn: () => adminGetPartnerApi(drilldownId),
    enabled: !!drilldownId,
  })

  const createMut = useMutation({
    mutationFn: () => adminCreatePartnerApi({
      user_email: createForm.user_email.trim(),
      territory_id: createForm.territory_id || null,
      commission_rate: parseFloat(createForm.commission_rate) || 0.25,
      contract_signed_at: createForm.contract_signed_at
        ? new Date(createForm.contract_signed_at).toISOString()
        : null,
      notes: createForm.notes.trim() || null,
    }),
    onSuccess: () => {
      toast.success('Partenaire créé')
      setCreateModal(false)
      setCreateForm({ user_email: '', territory_id: '', commission_rate: 0.25, contract_signed_at: '', notes: '' })
      queryClient.invalidateQueries({ queryKey: ['admin', 'partners'] })
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erreur'),
  })

  const suspendMut = useMutation({
    mutationFn: (profileId) => adminSuspendPartnerApi(profileId),
    onSuccess: () => {
      toast.success('Partenaire suspendu')
      queryClient.invalidateQueries({ queryKey: ['admin', 'partners'] })
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erreur'),
  })

  const terminateMut = useMutation({
    mutationFn: () => adminTerminatePartnerApi(
      terminateModal.profile_id, terminateForm.clause, terminateForm.reason.trim() || null,
    ),
    onSuccess: () => {
      toast.success('Partenariat cessé')
      setTerminateModal(null); setTerminateForm({ clause: 'voluntary', reason: '' })
      queryClient.invalidateQueries({ queryKey: ['admin', 'partners'] })
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erreur'),
  })

  const territoryOptions = useMemo(() => {
    const list = territories.data || []
    return [{ value: '', label: '— Aucun (à attribuer plus tard) —' }, ...list.map(t => ({
      value: t.id, label: `${t.code} — ${t.name}`,
    }))]
  }, [territories.data])

  // ── Vue détail ─────────────────────────────────────────────────────────────
  if (drilldownId) {
    return (
      <div>
        <button
          onClick={() => setDrilldownId(null)}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Retour à la liste
        </button>

        {detail.isLoading ? <Spinner /> : !detail.data ? (
          <p className="text-gray-500">Partenaire introuvable.</p>
        ) : (
          <div className="space-y-6">
            <div className="card p-6">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{detail.data.full_name}</h1>
                  <p className="text-sm text-gray-600">{detail.data.email}</p>
                  {detail.data.territory_code && (
                    <p className="text-sm text-gray-700 mt-1 inline-flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      {detail.data.territory_code} — {detail.data.territory_name}
                    </p>
                  )}
                </div>
                <StatusChip status={detail.data.status} />
              </div>
              <dl className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <dt className="text-xs text-gray-500">Commission</dt>
                  <dd className="font-semibold">{(detail.data.commission_rate * 100).toFixed(2)} %</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Courtiers recrutés</dt>
                  <dd className="font-semibold">{detail.data.recruited_courtiers_count}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Deals fermés</dt>
                  <dd className="font-semibold">{detail.data.closed_deals_count}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Cut cumulée</dt>
                  <dd className="font-semibold text-[#9A3412]">{formatMoney(detail.data.total_commission_cad)}</dd>
                </div>
              </dl>
              {detail.data.contract_terminated_at && (
                <p className="mt-4 text-xs text-gray-500">
                  Cessé le {new Date(detail.data.contract_terminated_at).toLocaleDateString('fr-CA')}
                  {detail.data.termination_reason && ` — ${detail.data.termination_reason}`}
                </p>
              )}
              {(detail.data.status === 'active' || detail.data.status === 'on_hold') && (
                <div className="mt-5 flex gap-2 flex-wrap">
                  {detail.data.status === 'active' && (
                    <button
                      onClick={() => suspendMut.mutate(detail.data.profile_id)}
                      className="btn-secondary text-sm inline-flex items-center gap-1.5"
                    >
                      <Pause className="h-4 w-4" /> Suspendre
                    </button>
                  )}
                  <button
                    onClick={() => setTerminateModal({ profile_id: detail.data.profile_id, full_name: detail.data.full_name })}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
                  >
                    <XCircle className="h-4 w-4" /> Cesser le partenariat
                  </button>
                </div>
              )}
            </div>

            <div className="card overflow-hidden">
              <h2 className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-100">
                Courtiers recrutés ({detail.data.recruited_courtiers.length})
              </h2>
              {detail.data.recruited_courtiers.length === 0 ? (
                <p className="p-6 text-sm text-gray-500">Aucun courtier recruté.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-6 py-3">Nom</th>
                      <th className="px-6 py-3">Agence</th>
                      <th className="px-6 py-3">Recruté le</th>
                      <th className="px-6 py-3 text-center">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {detail.data.recruited_courtiers.map(c => (
                      <tr key={c.user_id}>
                        <td className="px-6 py-3">
                          <p className="font-medium text-gray-900">{c.full_name}</p>
                          <p className="text-xs text-gray-500">{c.email}</p>
                        </td>
                        <td className="px-6 py-3 text-gray-700">{c.agency_name || '—'}</td>
                        <td className="px-6 py-3 text-xs text-gray-500">
                          {c.recruited_at ? new Date(c.recruited_at).toLocaleDateString('fr-CA') : '—'}
                        </td>
                        <td className="px-6 py-3 text-center">
                          {c.is_active ? (
                            <span className="text-xs text-emerald-700">Actif</span>
                          ) : (
                            <span className="text-xs text-gray-500">Inactif</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="card overflow-hidden">
              <h2 className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-100">
                Deals fermés générant une cut ({detail.data.closed_deals.length})
              </h2>
              {detail.data.closed_deals.length === 0 ? (
                <p className="p-6 text-sm text-gray-500">Aucun deal fermé pour ce partenaire.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-6 py-3">Deal</th>
                      <th className="px-6 py-3 text-right">Prix final</th>
                      <th className="px-6 py-3 text-right">Frais Logeo (1 %)</th>
                      <th className="px-6 py-3 text-right">Cut partenaire</th>
                      <th className="px-6 py-3">Payé le</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {detail.data.closed_deals.map(d => (
                      <tr key={d.deal_id}>
                        <td className="px-6 py-3">{d.city}</td>
                        <td className="px-6 py-3 text-right font-medium">{formatMoney(d.winning_price)}</td>
                        <td className="px-6 py-3 text-right">{formatMoney(d.logeo_fee)}</td>
                        <td className="px-6 py-3 text-right font-semibold text-[#9A3412]">{formatMoney(d.partner_commission)}</td>
                        <td className="px-6 py-3 text-xs text-gray-500">
                          {d.paid_at ? new Date(d.paid_at).toLocaleDateString('fr-CA') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Modal cesser partenariat */}
        <Modal open={!!terminateModal} onClose={() => setTerminateModal(null)} title="Cesser le partenariat" size="md">
          {terminateModal && (
            <div className="space-y-4 text-sm">
              <p className="text-gray-600">
                Vous êtes sur le point de cesser le partenariat avec <strong>{terminateModal.full_name}</strong>.
                Action irréversible — la rangée historique reste en base.
              </p>
              <Select
                label="Clause de cessation"
                value={terminateForm.clause}
                onChange={(e) => setTerminateForm({ ...terminateForm, clause: e.target.value })}
                options={TERMINATE_CLAUSES}
              />
              <Textarea
                label="Motif / contexte (optionnel)"
                value={terminateForm.reason}
                onChange={(e) => setTerminateForm({ ...terminateForm, reason: e.target.value })}
                rows={3}
              />
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setTerminateModal(null)} className="btn-secondary">Annuler</button>
                <button
                  onClick={() => terminateMut.mutate()}
                  disabled={terminateMut.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
                >
                  {terminateMut.isPending ? '...' : 'Confirmer la cessation'}
                </button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    )
  }

  // ── Vue liste ──────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Network className="h-5 w-5 text-[#C2410C]" /> Partenaires régionaux
          </h1>
          <p className="text-sm text-gray-600">
            Liste des partenaires régionaux et de leur performance.
          </p>
        </div>
        <button
          onClick={() => setCreateModal(true)}
          className="btn-primary text-sm inline-flex items-center gap-1.5"
        >
          <UserPlus className="h-4 w-4" /> Nouveau partenaire
        </button>
      </div>

      {partners.isLoading ? <Spinner /> : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Territoire</th>
                <th className="px-4 py-3">Nomination</th>
                <th className="px-4 py-3 text-center">Courtiers</th>
                <th className="px-4 py-3 text-center">Deals fermés</th>
                <th className="px-4 py-3 text-right">Cut cumulée</th>
                <th className="px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(partners.data || []).map(p => (
                <tr
                  key={p.profile_id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setDrilldownId(p.profile_id)}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{p.full_name}</p>
                    <p className="text-xs text-gray-500">{p.email}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {p.territory_code ? `${p.territory_code} — ${p.territory_name}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {p.contract_signed_at ? new Date(p.contract_signed_at).toLocaleDateString('fr-CA') : '—'}
                  </td>
                  <td className="px-4 py-3 text-center font-medium">{p.recruited_courtiers_count}</td>
                  <td className="px-4 py-3 text-center font-medium">{p.closed_deals_count}</td>
                  <td className="px-4 py-3 text-right font-semibold text-[#9A3412]">{formatMoney(p.total_commission_cad)}</td>
                  <td className="px-4 py-3"><StatusChip status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {(partners.data || []).length === 0 && (
            <p className="text-center py-12 text-sm text-gray-500">Aucun partenaire enregistré pour l'instant.</p>
          )}
        </div>
      )}

      {/* Modal création partenaire */}
      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Nouveau partenaire régional" size="md">
        <div className="space-y-4 text-sm">
          <p className="text-gray-600">
            Le user doit déjà être inscrit. On bascule son rôle vers <strong>regional_partner</strong>
            et on lui attribue un territoire (modifiable plus tard).
          </p>
          <Input
            label="Email du user"
            type="email"
            value={createForm.user_email}
            onChange={(e) => setCreateForm({ ...createForm, user_email: e.target.value })}
            placeholder="ex: partenaire@email.com"
            required
          />
          <Select
            label="Territoire"
            value={createForm.territory_id}
            onChange={(e) => setCreateForm({ ...createForm, territory_id: e.target.value })}
            options={territoryOptions}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Commission (0 à 1)"
              type="number" step="0.01" min="0" max="1"
              value={createForm.commission_rate}
              onChange={(e) => setCreateForm({ ...createForm, commission_rate: e.target.value })}
              hint="0.25 = 25 %"
            />
            <Input
              label="Date de nomination"
              type="date"
              value={createForm.contract_signed_at}
              onChange={(e) => setCreateForm({ ...createForm, contract_signed_at: e.target.value })}
            />
          </div>
          <Textarea
            label="Notes (optionnel)"
            value={createForm.notes}
            onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
            rows={2}
          />
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setCreateModal(false)} className="btn-secondary">Annuler</button>
            <button
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending || !createForm.user_email.trim()}
              className="btn-primary"
            >
              {createMut.isPending ? '...' : 'Créer le partenaire'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
