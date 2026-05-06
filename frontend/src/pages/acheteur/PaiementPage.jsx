import { useState, useMemo, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  CreditCard, ShieldCheck, Trash2, Loader2, History,
  CheckCircle2, AlertCircle, Clock, ArrowRight,
} from 'lucide-react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements, PaymentElement, useStripe, useElements,
} from '@stripe/react-stripe-js'
import {
  getPaymentMethodApi, createSetupIntentApi,
  confirmPaymentMethodApi, deletePaymentMethodApi,
  myPaymentHistoryApi,
} from '../../api/payments'
import Spinner from '../../components/ui/Spinner'

const formatMoney = (cents) =>
  new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0 })
    .format(Math.round(cents / 100))

const STATE_BADGE = {
  succeeded:       { cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', icon: CheckCircle2, label: 'Reçu' },
  pending:         { cls: 'bg-gray-100 text-gray-700 ring-gray-200', icon: Clock, label: 'En attente' },
  requires_action: { cls: 'bg-amber-50 text-amber-700 ring-amber-200', icon: Clock, label: 'Action requise' },
  failed:          { cls: 'bg-red-50 text-red-700 ring-red-200', icon: AlertCircle, label: 'Échec' },
  refunded:        { cls: 'bg-gray-100 text-gray-700 ring-gray-200', icon: AlertCircle, label: 'Remboursé' },
}

const TYPE_LABEL = { deposit: 'Dépôt 25 %', balance: 'Solde 75 %' }

function StateChip({ state }) {
  const cfg = STATE_BADGE[state] || STATE_BADGE.pending
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cfg.cls}`}>
      <Icon className="h-3 w-3" /> {cfg.label}
    </span>
  )
}

function CardForm({ clientSecret, onSaved }) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  // Lock anti double-confirm : empêche un 2e appel à confirmSetup sur le même intent
  // (double-clic, StrictMode, retry React Query, etc.)
  const lockRef = useRef(false)

  /** Renvoie un setupIntent succeeded ou throw. Tolère le cas "déjà confirmé". */
  const confirmOrRecover = async () => {
    const result = await stripe.confirmSetup({ elements, redirect: 'if_required' })

    // Cas heureux
    if (!result.error) return result.setupIntent

    // Cas particulier : le SetupIntent est déjà dans un état succeeded
    // (ex: l'utilisateur a déjà cliqué une 1re fois et confirmSetup re-tourne).
    // On le récupère plutôt que de planter.
    if (result.error.code === 'setup_intent_unexpected_state' && clientSecret) {
      const retrieved = await stripe.retrieveSetupIntent(clientSecret)
      if (retrieved.setupIntent?.status === 'succeeded') {
        return retrieved.setupIntent
      }
    }

    throw new Error(result.error.message || 'Erreur Stripe')
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!stripe || !elements) return
    if (lockRef.current) return  // déjà en cours
    lockRef.current = true
    setSubmitting(true)

    try {
      const setupIntent = await confirmOrRecover()
      if (!setupIntent || setupIntent.status !== 'succeeded') {
        throw new Error('Configuration de la carte non finalisée')
      }

      const pmId = typeof setupIntent.payment_method === 'string'
        ? setupIntent.payment_method
        : setupIntent.payment_method?.id
      if (!pmId) throw new Error('Aucun moyen de paiement retourné')

      // Attache le PM au customer + sauve les méta (last4/brand) en DB.
      // Si l'utilisateur retape submit après une succès, le lockRef bloque déjà ;
      // côté backend save_payment_method est idempotent (re-attacher le même PM = no-op).
      await confirmPaymentMethodApi(pmId)

      toast.success('Carte enregistrée')
      onSaved()  // déclenche queryClient.invalidateQueries(['payment-method']) côté parent
    } catch (err) {
      toast.error(err.message || 'Erreur')
      lockRef.current = false  // déverrouille pour permettre une nouvelle tentative
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <PaymentElement options={{ layout: 'tabs' }} />
      <button type="submit" disabled={!stripe || submitting} className="btn-primary w-full">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
        {submitting ? 'Enregistrement...' : 'Enregistrer ma carte'}
      </button>
      <p className="text-xs text-gray-500 text-center">
        Carte traitée et stockée par Stripe. Logeo ne voit jamais le numéro complet.
      </p>
    </form>
  )
}

export default function PaiementPage() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [setupIntent, setSetupIntent] = useState(null)

  const { data: pm, isLoading } = useQuery({
    queryKey: ['payment-method'], queryFn: getPaymentMethodApi,
  })
  const { data: history } = useQuery({
    queryKey: ['payment-history'], queryFn: myPaymentHistoryApi,
  })

  const stripePromise = useMemo(() => {
    const key = setupIntent?.publishable_key || import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
    return key ? loadStripe(key) : null
  }, [setupIntent?.publishable_key])

  const startSetup = useMutation({
    mutationFn: createSetupIntentApi,
    onSuccess: (data) => { setSetupIntent(data); setShowForm(true) },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erreur Stripe'),
  })

  const removeCard = useMutation({
    mutationFn: deletePaymentMethodApi,
    onSuccess: () => {
      toast.success('Carte supprimée')
      queryClient.invalidateQueries({ queryKey: ['payment-method'] })
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erreur'),
  })

  useEffect(() => {
    if (!pm?.has_card) return
    setShowForm(false); setSetupIntent(null)
  }, [pm?.has_card])

  if (isLoading) return <Spinner label="Chargement..." />

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Paiement</h1>
      <p className="text-sm text-gray-600 mb-6">
        Carte enregistrée et historique de tes débits Logeo.
      </p>

      {/* Carte actuelle */}
      {pm?.has_card && !showForm && (
        <div className="card p-6 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-[#FFEDD5] text-[#C2410C] flex items-center justify-center">
                <CreditCard className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 capitalize flex items-center gap-2">
                  {pm.brand || 'Carte'}
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full ring-1 ring-inset ring-emerald-200">
                    <ShieldCheck className="h-3 w-3" /> Carte enregistrée
                  </span>
                </p>
                <p className="text-sm text-gray-600">•••• •••• •••• {pm.last4}</p>
                {pm.exp_month && pm.exp_year && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Expire {String(pm.exp_month).padStart(2, '0')}/{pm.exp_year}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => startSetup.mutate()}
                disabled={startSetup.isPending}
                className="btn-secondary text-xs"
              >
                Changer
              </button>
              <button
                onClick={() => removeCard.mutate()}
                disabled={removeCard.isPending}
                className="btn-secondary text-xs text-red-700"
              >
                <Trash2 className="h-3.5 w-3.5" /> Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pas de carte / formulaire */}
      {(!pm?.has_card || showForm) && (
        <div className="card p-6 mb-6">
          {!setupIntent ? (
            <div className="text-center py-6">
              <div className="h-12 w-12 mx-auto rounded-full bg-[#FFEDD5] text-[#C2410C] flex items-center justify-center mb-3">
                <CreditCard className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">
                {pm?.has_card ? 'Remplacer ta carte' : 'Aucune carte enregistrée'}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {pm?.has_card
                  ? 'Ta carte actuelle sera remplacée.'
                  : 'Pour enchérir, ajoute une carte Visa ou Mastercard.'}
              </p>
              <button
                onClick={() => startSetup.mutate()}
                disabled={startSetup.isPending}
                className="btn-primary"
              >
                {startSetup.isPending ? 'Préparation...' : 'Ajouter une carte'}
              </button>
            </div>
          ) : stripePromise ? (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret: setupIntent.client_secret,
                appearance: {
                  theme: 'stripe',
                  variables: { colorPrimary: '#EA580C', fontFamily: 'Inter, system-ui, sans-serif' },
                },
              }}
            >
              <CardForm
                clientSecret={setupIntent.client_secret}
                onSaved={() => {
                  setShowForm(false)
                  setSetupIntent(null)
                  // Auto-refresh : recharger la carte enregistrée + l'historique
                  queryClient.invalidateQueries({ queryKey: ['payment-method'] })
                  queryClient.invalidateQueries({ queryKey: ['payment-history'] })
                }}
              />
            </Elements>
          ) : (
            <p className="text-sm text-red-600">Stripe n'est pas configuré.</p>
          )}
        </div>
      )}

      {/* Historique */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <History className="h-4 w-4 text-[#C2410C]" />
          <h2 className="font-semibold text-gray-900">Historique des transactions</h2>
        </div>
        {!history?.length ? (
          <p className="text-sm text-gray-500 py-8 text-center">Aucune transaction pour le moment.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Deal</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Montant</th>
                <th className="px-4 py-2.5">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {history.map(t => (
                <tr key={t.id}>
                  <td className="px-4 py-2.5 text-xs text-gray-600">
                    {new Date(t.succeeded_at || t.created_at).toLocaleString('fr-CA')}
                  </td>
                  <td className="px-4 py-2.5">
                    <Link to={`/acheteur/deals/${t.deal_id}`} className="font-medium text-gray-900 hover:text-[#EA580C] inline-flex items-center gap-1">
                      {t.deal_city || 'Deal'} <ArrowRight className="h-3 w-3" />
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">{TYPE_LABEL[t.type] || t.type}</td>
                  <td className="px-4 py-2.5 font-medium">{formatMoney(t.amount_cents)}</td>
                  <td className="px-4 py-2.5">
                    <StateChip state={t.state} />
                    {t.failure_message && (
                      <p className="text-[11px] text-red-600 mt-0.5">{t.failure_message}</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
