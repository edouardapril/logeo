import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Upload, FileText, AlertTriangle, Clock, MessageSquare, Send, RotateCcw,
} from 'lucide-react'
import {
  courtierGetDealApi, uploadPaApi,
  courtierListQuestionsApi, answerQuestionApi, restartRoundApi,
} from '../../api/courtier'
import Spinner from '../../components/ui/Spinner'
import Badge from '../../components/ui/Badge'
import Timer from '../../components/ui/Timer'
import { Textarea } from '../../components/ui/Input'
import ReviewSection from '../../components/deal/ReviewSection'
import { useAuth } from '../../contexts/AuthContext'
import { listReviewsForDealApi } from '../../api/reviews'

const formatMoney = (n) =>
  new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0 }).format(n)

export default function CourtierDealDetail() {
  const { dealId } = useParams()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [paFile, setPaFile] = useState(null)
  const [answerDraft, setAnswerDraft] = useState({})

  const { data: deal, isLoading } = useQuery({
    queryKey: ['courtier', 'deal', dealId],
    queryFn: () => courtierGetDealApi(dealId),
  })

  const { data: questions } = useQuery({
    queryKey: ['courtier', 'questions', dealId],
    queryFn: () => courtierListQuestionsApi(dealId),
    refetchInterval: 30_000,
  })

  const { data: reviews } = useQuery({
    queryKey: ['reviews', dealId],
    queryFn: () => listReviewsForDealApi(dealId),
    enabled: !!deal && deal.status === 'pa_signed',
  })

  const uploadPa = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      fd.append('pa_file', paFile)
      return uploadPaApi(dealId, fd)
    },
    onSuccess: () => {
      toast.success('Promesse d\'achat enregistrée')
      queryClient.invalidateQueries({ queryKey: ['courtier'] })
      setPaFile(null)
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erreur'),
  })

  const answerMut = useMutation({
    mutationFn: ({ qid, answer }) => answerQuestionApi(dealId, qid, answer),
    onSuccess: (_, vars) => {
      toast.success('Réponse publiée')
      setAnswerDraft({ ...answerDraft, [vars.qid]: '' })
      queryClient.invalidateQueries({ queryKey: ['courtier', 'questions', dealId] })
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erreur'),
  })

  const restartMut = useMutation({
    mutationFn: () => restartRoundApi(dealId),
    onSuccess: () => {
      toast.success('Deal soumis à nouvelle analyse admin')
      queryClient.invalidateQueries({ queryKey: ['courtier', 'deal', dealId] })
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erreur'),
  })

  if (isLoading) return <Spinner />
  if (!deal) return null

  return (
    <div className="max-w-3xl">
      <Link to="/courtier" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> Retour
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">{deal.city} · {deal.property_type}</h1>
            <Badge status={deal.status} />
          </div>
          <p className="text-sm text-gray-600">Soumis le {new Date(deal.created_at).toLocaleDateString('fr-CA')}</p>
        </div>
      </div>

      {/* État du deal selon le statut */}
      {deal.status === 'analyse' && (
        <div className="card p-6 mb-6 bg-amber-50 border-amber-200">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-900">Analyse en cours</h3>
              <p className="text-sm text-amber-800 mt-1">
                L'équipe Logeo examine votre soumission. Vous recevrez un email avec le verdict GO ou NO GO.
              </p>
            </div>
          </div>
        </div>
      )}

      {deal.status === 'bid' && deal.bid_close_at && (
        <div className="card p-6 mb-6 bg-[#FFEDD5] border-[#FDBA74]">
          <h3 className="font-semibold text-[#C2410C] mb-2">Enchère en cours</h3>
          <p className="text-sm text-[#1A1A1A] mb-3">
            Votre deal est en ligne. Les acheteurs qualifiés peuvent maintenant signer le NDA et enchérir.
          </p>
          <Timer closeAt={deal.bid_close_at} size="lg" showLabel />
        </div>
      )}

      {deal.status === 'intro' && (
        <div className="card p-6 mb-6 bg-emerald-50 border-emerald-200">
          <h3 className="font-semibold text-emerald-900">Acheteur confirmé</h3>
          <p className="text-sm text-emerald-800 mt-1">
            Un acheteur a remporté l'enchère et payé son dépôt. Vous avez reçu son introduction par email.
            Une fois la PA signée avec votre acheteur, uploadez-la ci-dessous.
          </p>
        </div>
      )}

      {deal.status === 'pa_signed' && (
        <div className="card p-6 mb-6 bg-green-50 border-green-200">
          <h3 className="font-semibold text-green-900">Deal finalisé · Promesse d'achat enregistrée</h3>
          <p className="text-sm text-green-800 mt-1">
            Votre commission Logeo (1 500 $) sera déclenchée à la confirmation du paiement final par l'admin.
          </p>
        </div>
      )}

      {deal.status === 'nogo' && deal.nogo_reason && (
        <div className="card p-6 mb-6 bg-red-50 border-red-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900">Deal non retenu</h3>
              <p className="text-sm text-red-800 mt-1">{deal.nogo_reason}</p>
            </div>
          </div>
        </div>
      )}

      {/* Item 4 : enchère terminée sans gagnant → bouton relancer */}
      {deal.status === 'auction_ended' && (
        <div className="card p-6 mb-6 bg-gray-50 border-gray-200">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <Clock className="h-5 w-5 text-gray-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-gray-900">
                  Enchère terminée — Plancher non atteint
                </h3>
                <p className="text-sm text-gray-700 mt-1">
                  Aucune offre n'a été reçue avant la fermeture. Vous pouvez relancer
                  une nouvelle ronde de 10 jours. Le deal repassera en analyse pour
                  validation admin avant publication.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                if (window.confirm('Relancer une nouvelle ronde de 10 jours ? Le deal repassera en analyse.')) {
                  restartMut.mutate()
                }
              }}
              disabled={restartMut.isPending}
              className="btn-primary text-sm"
            >
              <RotateCcw className="h-4 w-4" />
              {restartMut.isPending ? '...' : 'Relancer une nouvelle ronde'}
            </button>
          </div>
        </div>
      )}

      {/* Infos propriété */}
      <div className="card p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Informations</h2>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-gray-500 text-xs">Adresse</dt>
            <dd className="font-medium">{deal.address_private}</dd>
          </div>
          <div>
            <dt className="text-gray-500 text-xs">Prix demandé</dt>
            <dd className="font-medium">{formatMoney(deal.asking_price)}</dd>
          </div>
          {deal.gross_revenue && (
            <div>
              <dt className="text-gray-500 text-xs">Revenus bruts</dt>
              <dd className="font-medium">{formatMoney(deal.gross_revenue)}</dd>
            </div>
          )}
          {deal.yield_pct != null && (
            <div>
              <dt className="text-gray-500 text-xs">Rendement</dt>
              <dd className="font-medium text-emerald-600">{deal.yield_pct.toFixed(2)}%</dd>
            </div>
          )}
          {deal.num_units && (
            <div>
              <dt className="text-gray-500 text-xs">Logements</dt>
              <dd className="font-medium">{deal.num_units}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Q&A — répondre aux questions des acheteurs */}
      <div className="card p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-[#C2410C]" />
          Questions des acheteurs ({questions?.length || 0})
          {questions?.some(q => !q.answer) && (
            <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full ring-1 ring-inset ring-amber-200">
              {questions.filter(q => !q.answer).length} sans réponse
            </span>
          )}
        </h2>
        {!questions?.length ? (
          <p className="text-sm text-gray-500">Aucune question pour le moment.</p>
        ) : (
          <ul className="space-y-3">
            {questions.map(q => (
              <li key={q.id} className="border border-gray-200 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">
                  {new Date(q.asked_at).toLocaleString('fr-CA')}
                  {!q.answer && (
                    <span className="ml-2 text-amber-700 font-medium">· Sans réponse</span>
                  )}
                </p>
                <p className="text-sm font-medium text-gray-900 mb-2">{q.question}</p>

                {q.answer ? (
                  <div className="mt-2 pl-3 border-l-2 border-[#FDBA74] text-sm text-gray-700">
                    <p className="whitespace-pre-line">{q.answer}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Répondu le {new Date(q.answered_at).toLocaleString('fr-CA')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 mt-2">
                    <Textarea
                      label=""
                      rows={2}
                      value={answerDraft[q.id] || ''}
                      onChange={(e) => setAnswerDraft({ ...answerDraft, [q.id]: e.target.value })}
                      placeholder="Votre réponse..."
                    />
                    <button
                      onClick={() => {
                        const a = (answerDraft[q.id] || '').trim()
                        if (!a) { toast.error('Réponse vide'); return }
                        answerMut.mutate({ qid: q.id, answer: a })
                      }}
                      disabled={answerMut.isPending}
                      className="btn-primary text-sm"
                    >
                      <Send className="h-3.5 w-3.5" /> Publier
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Upload PA si statut intro */}
      {deal.status === 'intro' && (
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-2">Uploader la promesse d'achat signée</h2>
          <p className="text-sm text-gray-600 mb-4">
            Une fois la PA signée par l'acheteur et le vendeur, déposez-la ici pour finaliser le deal.
          </p>
          <label className="flex items-center justify-between p-4 border-2 border-dashed border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer mb-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-700">
                  {paFile ? paFile.name : 'Sélectionner le fichier PA (PDF)'}
                </p>
                <p className="text-xs text-gray-500">PDF uniquement</p>
              </div>
            </div>
            <Upload className="h-5 w-5 text-gray-400" />
            <input
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => setPaFile(e.target.files[0] || null)}
            />
          </label>
          <button
            onClick={() => paFile && uploadPa.mutate()}
            disabled={!paFile || uploadPa.isPending}
            className="btn-primary w-full"
          >
            {uploadPa.isPending ? 'Envoi...' : 'Envoyer la PA signée'}
          </button>
        </div>
      )}

      {/* Évaluations — visible quand la PA est signée */}
      {deal.status === 'pa_signed' && (
        <div className="mt-6">
          <ReviewSection
            dealId={dealId}
            canRate
            rateeRoleLabel="l'acheteur gagnant"
            alreadyRated={!!reviews?.some(r => r.rater_id === user?.id)}
          />
        </div>
      )}
    </div>
  )
}
