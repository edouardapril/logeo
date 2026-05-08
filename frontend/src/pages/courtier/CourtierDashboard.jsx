import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Plus, Building2, ShieldAlert, ShieldCheck, MessageSquare,
  Trophy, Users, ArrowRight, MapPin, Clock,
  FileText, CheckCircle2, DollarSign,
} from 'lucide-react'
import { courtierListDealsEnrichedApi, courtierDashboardApi } from '../../api/courtier'
import { conventionStatusApi } from '../../api/profile'
import Spinner from '../../components/ui/Spinner'
import Badge from '../../components/ui/Badge'
import CountdownBoxes from '../../components/ui/CountdownBoxes'
import { PROPERTY_TYPE_LABELS } from '../../utils/constants'
import { regionLabel } from '../../utils/quebec'

const formatMoney = (n) =>
  n == null ? '—' : new Intl.NumberFormat('fr-CA', {
    style: 'currency', currency: 'CAD', minimumFractionDigits: 0,
  }).format(n)

const TABS = [
  { value: 'active',   label: 'En cours' },
  { value: 'pending',  label: "En attente d'approbation" },
  { value: 'finished', label: 'Terminés' },
]

const ACTIVE_STATUSES   = ['bid', 'intro']
const PENDING_STATUSES  = ['analyse', 'draft']
const FINISHED_STATUSES = ['pa_signed', 'auction_ended', 'nogo']

function KpiCard({ icon: Icon, label, value, color = 'orange', formatFn }) {
  const palettes = {
    orange:  { bg: 'bg-[#FFEDD5]', text: 'text-[#9A3412]', icon: 'text-[#C2410C]' },
    blue:    { bg: 'bg-blue-50',   text: 'text-blue-900',  icon: 'text-blue-600' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-900', icon: 'text-emerald-600' },
    amber:   { bg: 'bg-amber-50',  text: 'text-amber-900',  icon: 'text-amber-600' },
  }
  const p = palettes[color] || palettes.orange
  const display = formatFn ? formatFn(value) : value
  return (
    <div className={`card p-5 ${p.bg} border-transparent`}>
      <div className="flex items-center gap-3">
        <Icon className={`h-5 w-5 ${p.icon}`} />
        <p className="text-xs uppercase tracking-wide text-gray-600 font-semibold">{label}</p>
      </div>
      <p className={`text-2xl font-bold mt-2 ${p.text}`}>{display}</p>
    </div>
  )
}

function MetricBadge({ icon: Icon, value, label, alert = false }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <Icon className={`h-3.5 w-3.5 ${alert ? 'text-red-500' : 'text-gray-400'}`} />
      <span className={`font-semibold ${alert ? 'text-red-700' : 'text-gray-700'}`}>{value}</span>
      <span className="text-gray-500">{label}</span>
    </div>
  )
}

function DealCard360({ d }) {
  const hasUnanswered = d.unanswered_questions_count > 0

  return (
    <div className="card p-5 hover:shadow-md hover:border-[#FDBA74] transition-all">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Link to={`/courtier/deals/${d.id}`} className="font-semibold text-gray-900 hover:text-[#EA580C]">
              {PROPERTY_TYPE_LABELS[d.property_type] || d.property_type}
            </Link>
            <Badge status={d.status} />
          </div>
          {d.address_private && (
            <p className="text-sm font-medium text-gray-800 flex items-start gap-1.5 mt-1">
              <MapPin className="h-3.5 w-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
              <span className="break-words">{d.address_private}</span>
            </p>
          )}
          <p className="text-xs text-gray-500 mt-0.5 ml-5">
            {d.city}{d.region && <span> · {regionLabel(d.region)}</span>}
          </p>
        </div>
        {d.bid_close_at && d.status === 'bid' && (
          <CountdownBoxes closeAt={d.bid_close_at} size="compact" />
        )}
      </div>

      {/* Métriques 360 */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <MetricBadge icon={Users} value={d.ndas_count} label="NDAs signés" />
        <MetricBadge icon={Trophy} value={d.bidders_count} label="bidders" />
        <MetricBadge
          icon={MessageSquare}
          value={d.unanswered_questions_count}
          label="Q&R en attente"
          alert={hasUnanswered}
        />
        <MetricBadge
          icon={Clock}
          value={d.bid_close_at && d.status === 'bid'
            ? new Date(d.bid_close_at).toLocaleDateString('fr-CA')
            : '—'}
          label="fin"
        />
      </div>

      {/* Prix actuel (uniquement si en bid actif) */}
      {d.status === 'bid' && d.displayed_price != null && (
        <div className="rounded-lg bg-[#FFEDD5] border border-[#FDBA74] p-2.5 mb-3 flex items-center justify-between">
          <span className="text-xs text-[#9A3412]">Prix actuel anonyme</span>
          <span className="font-bold text-[#9A3412]">{formatMoney(d.displayed_price)}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-100">
        <p className="text-xs text-gray-500">
          Plancher : {formatMoney(d.floor_price)}
        </p>
        <div className="flex gap-2">
          {hasUnanswered && (
            <Link
              to={`/courtier/deals/${d.id}`}
              className="text-xs font-semibold inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200"
            >
              <MessageSquare className="h-3 w-3" />
              Répondre ({d.unanswered_questions_count})
            </Link>
          )}
          <Link
            to={`/courtier/deals/${d.id}`}
            className="text-xs font-semibold inline-flex items-center gap-1 link-brand"
          >
            Voir le deal <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function CourtierDashboard() {
  const [tab, setTab] = useState('active')

  const { data: deals, isLoading } = useQuery({
    queryKey: ['courtier', 'deals-enriched'],
    queryFn: courtierListDealsEnrichedApi,
    refetchInterval: 30_000,
  })
  const { data: conv } = useQuery({
    queryKey: ['convention-status'],
    queryFn: conventionStatusApi,
  })
  const { data: dashboard } = useQuery({
    queryKey: ['courtier', 'dashboard'],
    queryFn: courtierDashboardApi,
    refetchInterval: 60_000,
  })
  const kpis = dashboard?.kpis

  const counts = useMemo(() => {
    const c = { active: 0, pending: 0, finished: 0 }
    if (deals) {
      for (const d of deals) {
        if (ACTIVE_STATUSES.includes(d.status)) c.active++
        else if (PENDING_STATUSES.includes(d.status)) c.pending++
        else if (FINISHED_STATUSES.includes(d.status)) c.finished++
      }
    }
    return c
  }, [deals])

  const filtered = useMemo(() => {
    if (!deals) return []
    const set = tab === 'active' ? ACTIVE_STATUSES :
                tab === 'pending' ? PENDING_STATUSES :
                FINISHED_STATUSES
    return deals.filter(d => set.includes(d.status))
  }, [deals, tab])

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Mes deals</h1>
          <p className="text-sm text-gray-600">Vue 360 — temps réel · refresh 30s</p>
        </div>
        <Link to="/courtier/submit" className="btn-primary">
          <Plus className="h-4 w-4" /> Soumettre un deal
        </Link>
      </div>

      {/* KPIs */}
      {kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <KpiCard icon={FileText} label="Deals soumis" value={kpis.total_submitted} color="blue" />
          <KpiCard icon={Building2} label="Deals actifs" value={kpis.active_count} color="orange" />
          <KpiCard icon={CheckCircle2} label="Deals fermés" value={kpis.closed_count} color="emerald" />
          <KpiCard
            icon={DollarSign}
            label="Valeur fermée"
            value={kpis.total_closed_value}
            color="amber"
            formatFn={formatMoney}
          />
        </div>
      )}

      {/* Bandeau convention */}
      {conv?.needs_resign ? (
        <div className="card p-4 mb-6 bg-amber-50 border-amber-200 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-amber-900 text-sm">Convention courtier à signer</p>
            <p className="text-xs text-amber-800 mt-1">
              Vous devez accepter explicitement les clauses (prix plancher, non-contournement, exactitude des données, pénalités) pour pouvoir soumettre des deals.
            </p>
          </div>
          <Link to="/courtier/convention" className="btn-primary text-xs whitespace-nowrap">
            Signer maintenant
          </Link>
        </div>
      ) : conv?.signed && (
        <div className="card p-3 mb-6 bg-emerald-50 border-emerald-200 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <p className="text-xs text-emerald-900">
            Convention {conv.version} signée le {new Date(conv.signed_at).toLocaleDateString('fr-CA')}
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
        {TABS.map(t => {
          const c = counts[t.value]
          const active = tab === t.value
          return (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                active
                  ? 'border-[#EA580C] text-[#EA580C]'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {t.label}
              <span className={`text-xs px-1.5 rounded-full ${
                active ? 'bg-[#FFEDD5] text-[#C2410C]' : 'bg-gray-100 text-gray-600'
              }`}>{c}</span>
            </button>
          )
        })}
      </div>

      {isLoading ? <Spinner /> : !filtered.length ? (
        <div className="card p-12 text-center">
          <Building2 className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <h3 className="font-semibold text-gray-900 mb-1">
            {tab === 'active'   && "Aucune enchère active pour le moment"}
            {tab === 'pending'  && "Aucun deal en attente d'approbation"}
            {tab === 'finished' && "Aucun deal terminé"}
          </h3>
          {tab === 'active' && (
            <Link to="/courtier/submit" className="btn-primary inline-flex mt-2">
              <Plus className="h-4 w-4" /> Soumettre un deal
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(d => <DealCard360 key={d.id} d={d} />)}
        </div>
      )}
    </div>
  )
}
