import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  CheckCircle, Power, ShieldOff, ShieldAlert, ShieldCheck, CreditCard, X,
} from 'lucide-react'
import {
  qualifyUserApi, toggleUserApi,
  listAcheteursAdminApi, listCourtiersAdminApi, listPendingApi,
  rejectPendingApi, createSanctionApi,
} from '../../api/admin'
import Spinner from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'
import { Textarea, Select } from '../../components/ui/Input'
import RatingStars from '../../components/ui/RatingStars'

const TABS = [
  { value: 'acheteurs', label: 'Acheteurs' },
  { value: 'courtiers', label: 'Courtiers' },
  { value: 'pending',   label: 'En attente d\'approbation' },
]

const SEVERITIES = [
  { value: 'warning',    label: 'Avertissement (sans suspension)' },
  { value: 'suspension', label: 'Suspension (compte désactivé)' },
  { value: 'expulsion',  label: 'Expulsion (permanente)' },
]

function StatusChip({ active, label, tone }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    red:     'bg-red-50 text-red-700 ring-red-200',
    amber:   'bg-amber-50 text-amber-700 ring-amber-200',
    gray:    'bg-gray-100 text-gray-700 ring-gray-200',
  }
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ring-1 ring-inset ${
      tones[active ? tone : 'gray']
    }`}>
      {label}
    </span>
  )
}

export default function AdminUsers() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('acheteurs')
  const [sanctionModal, setSanctionModal] = useState(null)  // { user_id, full_name }
  const [sanctionForm, setSanctionForm] = useState({ reason: '', severity: 'suspension' })

  const acheteurs = useQuery({
    queryKey: ['admin', 'users', 'acheteurs'],
    queryFn: listAcheteursAdminApi,
    enabled: tab === 'acheteurs',
  })
  const courtiers = useQuery({
    queryKey: ['admin', 'users', 'courtiers'],
    queryFn: listCourtiersAdminApi,
    enabled: tab === 'courtiers',
  })
  const pending = useQuery({
    queryKey: ['admin', 'users', 'pending'],
    queryFn: listPendingApi,
    enabled: tab === 'pending',
  })

  const qualify = useMutation({
    mutationFn: ({ userId, isQualified }) => qualifyUserApi(userId, isQualified),
    onSuccess: () => {
      toast.success('Statut mis à jour')
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
    onError: () => toast.error('Erreur'),
  })

  const toggle = useMutation({
    mutationFn: (userId) => toggleUserApi(userId),
    onSuccess: () => {
      toast.success('Compte modifié')
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
    onError: () => toast.error('Erreur'),
  })

  const reject = useMutation({
    mutationFn: rejectPendingApi,
    onSuccess: () => {
      toast.success('Inscription refusée')
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
    onError: () => toast.error('Erreur'),
  })

  const sanction = useMutation({
    mutationFn: () => createSanctionApi({
      user_id: sanctionModal.user_id,
      reason: sanctionForm.reason.trim(),
      severity: sanctionForm.severity,
    }),
    onSuccess: () => {
      toast.success('Sanction enregistrée')
      setSanctionModal(null); setSanctionForm({ reason: '', severity: 'suspension' })
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'sanctions'] })
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erreur'),
  })

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Utilisateurs</h1>
      <p className="text-sm text-gray-600 mb-6">Gérer acheteurs, courtiers et nouvelles inscriptions</p>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4 border-b border-gray-200">
        {TABS.map(t => {
          const counts = {
            acheteurs: acheteurs.data?.length,
            courtiers: courtiers.data?.length,
            pending: pending.data?.length,
          }
          return (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.value
                  ? 'border-[#EA580C] text-[#EA580C]'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {t.label}
              {counts[t.value] != null && (
                <span className="ml-2 text-xs px-1.5 rounded-full bg-gray-100 text-gray-600">
                  {counts[t.value]}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Acheteurs tab */}
      {tab === 'acheteurs' && (
        acheteurs.isLoading ? <Spinner /> : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Nom</th>
                  <th className="px-4 py-3 text-center">Note</th>
                  <th className="px-4 py-3 text-center">Deals</th>
                  <th className="px-4 py-3 text-center">Carte</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {acheteurs.data?.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{u.full_name}</p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {u.average_rating != null ? (
                        <RatingStars value={u.average_rating} count={u.review_count} showNumber size="sm" readonly />
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center font-medium">{u.won_deals}</td>
                    <td className="px-4 py-3 text-center">
                      {u.has_card ? (
                        <CreditCard className="h-4 w-4 text-emerald-600 inline" />
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <StatusChip
                          active={u.is_qualified} tone="emerald"
                          label={u.is_qualified ? 'Qualifié' : 'Non qualifié'}
                        />
                        {!u.is_active && <StatusChip active tone="red" label="Désactivé" />}
                        {u.has_active_sanction && <StatusChip active tone="red" label="Sanction" />}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => qualify.mutate({ userId: u.id, isQualified: !u.is_qualified })}
                          className={`text-xs px-2 py-1 rounded-lg font-medium ${
                            u.is_qualified
                              ? 'bg-red-50 text-red-700 hover:bg-red-100'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          {u.is_qualified ? 'Disqualifier' : 'Qualifier'}
                        </button>
                        <button
                          onClick={() => setSanctionModal({ user_id: u.id, full_name: u.full_name })}
                          title="Sanctionner"
                          className="text-xs p-1.5 rounded-lg text-amber-700 hover:bg-amber-50"
                        >
                          <ShieldAlert className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => toggle.mutate(u.id)}
                          title={u.is_active ? 'Désactiver' : 'Réactiver'}
                          className="text-xs p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
                        >
                          <Power className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {acheteurs.data?.length === 0 && (
              <p className="text-center py-12 text-sm text-gray-500">Aucun acheteur</p>
            )}
          </div>
        )
      )}

      {/* Courtiers tab */}
      {tab === 'courtiers' && (
        courtiers.isLoading ? <Spinner /> : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Nom · Agence</th>
                  <th className="px-4 py-3 text-center">Soumis</th>
                  <th className="px-4 py-3 text-center">Complétés</th>
                  <th className="px-4 py-3 text-center">Note</th>
                  <th className="px-4 py-3">Convention</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {courtiers.data?.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{u.full_name}</p>
                      <p className="text-xs text-gray-500">
                        {u.agency_name || '—'}
                        {u.oaciq_number && ` · OACIQ ${u.oaciq_number}`}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-center font-medium">{u.submitted_deals}</td>
                    <td className="px-4 py-3 text-center font-medium">{u.completed_deals}</td>
                    <td className="px-4 py-3 text-center">
                      {u.average_rating != null ? (
                        <RatingStars value={u.average_rating} count={u.review_count} showNumber size="sm" readonly />
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {u.convention_signed_at ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <ShieldCheck className="h-3 w-3" />
                          {new Date(u.convention_signed_at).toLocaleDateString('fr-CA')}
                        </span>
                      ) : (
                        <span className="text-amber-700">Non signée</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {!u.is_active && <StatusChip active tone="red" label="Désactivé" />}
                        {u.has_active_sanction && <StatusChip active tone="red" label="Sanction" />}
                        {u.is_active && !u.has_active_sanction && (
                          <StatusChip active tone="emerald" label="Actif" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setSanctionModal({ user_id: u.id, full_name: u.full_name })}
                          title="Sanctionner"
                          className="text-xs p-1.5 rounded-lg text-amber-700 hover:bg-amber-50"
                        >
                          <ShieldAlert className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => toggle.mutate(u.id)}
                          title={u.is_active ? 'Désactiver' : 'Réactiver'}
                          className="text-xs p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
                        >
                          <Power className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {courtiers.data?.length === 0 && (
              <p className="text-center py-12 text-sm text-gray-500">Aucun courtier</p>
            )}
          </div>
        )
      )}

      {/* Pending tab */}
      {tab === 'pending' && (
        pending.isLoading ? <Spinner /> : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Nom</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Téléphone</th>
                  <th className="px-4 py-3">Inscrit le</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pending.data?.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{u.full_name}</td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3 text-gray-600">{u.phone || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(u.created_at).toLocaleDateString('fr-CA')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => qualify.mutate({ userId: u.id, isQualified: true })}
                          className="btn-secondary text-xs"
                        >
                          <CheckCircle className="h-3.5 w-3.5" /> Approuver
                        </button>
                        <button
                          onClick={() => reject.mutate(u.id)}
                          className="btn-secondary text-xs text-red-700"
                        >
                          <X className="h-3.5 w-3.5" /> Refuser
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pending.data?.length === 0 && (
              <p className="text-center py-12 text-sm text-gray-500">Aucune inscription en attente</p>
            )}
          </div>
        )
      )}

      {/* Modal sanction */}
      <Modal
        open={!!sanctionModal}
        onClose={() => { setSanctionModal(null); setSanctionForm({ reason: '', severity: 'suspension' }) }}
        title={`Sanctionner ${sanctionModal?.full_name || ''}`}
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm flex items-start gap-2">
            <ShieldOff className="h-4 w-4 text-amber-700 flex-shrink-0 mt-0.5" />
            <p className="text-amber-900">
              Une suspension désactive immédiatement le compte. Une expulsion est permanente.
              L'utilisateur peut être réactivé en levant la sanction depuis l'onglet "Sanctions".
            </p>
          </div>
          <Select
            label="Sévérité"
            value={sanctionForm.severity}
            onChange={(e) => setSanctionForm({ ...sanctionForm, severity: e.target.value })}
            options={SEVERITIES}
          />
          <Textarea
            label="Motif"
            value={sanctionForm.reason}
            onChange={(e) => setSanctionForm({ ...sanctionForm, reason: e.target.value })}
            rows={4}
            placeholder="Détaille la faute, la date, les preuves..."
            required
          />
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setSanctionModal(null)}
              className="btn-secondary"
            >
              Annuler
            </button>
            <button
              onClick={() => {
                if (sanctionForm.reason.trim().length < 3) {
                  toast.error('Motif requis (min 3 caractères)'); return
                }
                sanction.mutate()
              }}
              disabled={sanction.isPending}
              className="btn-danger"
            >
              {sanction.isPending ? '...' : 'Appliquer la sanction'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
