import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Upload, FileText, AlertTriangle, Clock, MessageSquare, Send, RotateCcw,
  Lock, MapPin, Building, Hammer, Receipt, Video,
  Image as ImageIcon, Star, X, Save,
} from 'lucide-react'
import {
  courtierGetDealApi, uploadPaApi,
  courtierListQuestionsApi, answerQuestionApi, restartRoundApi,
  uploadDealPhotosApi, deleteDealPhotoApi, setTeaserSelectionApi,
} from '../../api/courtier'
import Spinner from '../../components/ui/Spinner'
import Badge from '../../components/ui/Badge'
import Timer from '../../components/ui/Timer'
import { PROPERTY_TYPE_LABELS } from '../../utils/constants'
import { Textarea } from '../../components/ui/Input'
import ReviewSection from '../../components/deal/ReviewSection'
import { useAuth } from '../../contexts/AuthContext'
import { listReviewsForDealApi } from '../../api/reviews'
import { fileUrl } from '../../utils/url'

const TRI_LABEL = { yes: 'Oui', no: 'Non', unknown: 'Inconnu' }
const WORK_LABEL = {
  toiture: 'Toiture', fondation: 'Fondation', electrique: 'Électrique',
  plomberie: 'Plomberie', fenetres: 'Fenêtres', chauffage: 'Chauffage',
}
const EXPENSES_LABEL = {
  taxes_municipales: 'Taxes municipales', taxes_scolaires: 'Taxes scolaires',
  assurances: 'Assurances', entretien: 'Entretien',
  frais_gestion: 'Frais de gestion', autres: 'Autres',
}

const formatMoney = (n) =>
  new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0 }).format(n)

export default function CourtierDealDetail() {
  const { dealId } = useParams()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [paFile, setPaFile] = useState(null)
  const [answerDraft, setAnswerDraft] = useState({})
  // Sélection teaser locale — paths originals choisis comme cover/secondaires
  const [coverPath, setCoverPath] = useState(null)
  const [secondaryPaths, setSecondaryPaths] = useState([])

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

  // ── Photos & sélection teaser ──────────────────────────────────────────────
  const uploadPhotosMut = useMutation({
    mutationFn: (files) => uploadDealPhotosApi(dealId, files),
    onSuccess: () => {
      toast.success('Photos uploadées')
      queryClient.invalidateQueries({ queryKey: ['courtier', 'deal', dealId] })
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erreur upload'),
  })

  const deletePhotoMut = useMutation({
    mutationFn: (path) => deleteDealPhotoApi(dealId, path),
    onSuccess: () => {
      toast.success('Photo supprimée')
      setCoverPath(null)
      setSecondaryPaths([])
      queryClient.invalidateQueries({ queryKey: ['courtier', 'deal', dealId] })
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erreur'),
  })

  const teaserSelectionMut = useMutation({
    mutationFn: () => setTeaserSelectionApi(dealId, {
      cover_original: coverPath,
      secondary_originals: secondaryPaths,
    }),
    onSuccess: () => {
      toast.success('Sélection teaser enregistrée — watermarks générés')
      queryClient.invalidateQueries({ queryKey: ['courtier', 'deal', dealId] })
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erreur'),
  })

  const onPickCover = (path) => {
    setCoverPath(path)
    setSecondaryPaths(secondaryPaths.filter(p => p !== path))
  }
  const onToggleSecondary = (path) => {
    if (path === coverPath) return
    if (secondaryPaths.includes(path)) {
      setSecondaryPaths(secondaryPaths.filter(p => p !== path))
    } else if (secondaryPaths.length < 2) {
      setSecondaryPaths([...secondaryPaths, path])
    } else {
      toast('Maximum 2 photos secondaires', { icon: 'ℹ️' })
    }
  }

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
            <h1 className="text-2xl font-bold text-gray-900">
              {deal.city} · {PROPERTY_TYPE_LABELS[deal.property_type] || deal.property_type}
            </h1>
            <Badge status={deal.status} />
          </div>
          <p className="text-sm text-gray-600">Soumis le {new Date(deal.created_at).toLocaleDateString('fr-CA')}</p>
        </div>
      </div>

      {/* Bandeau read-only si fiche verrouillée (enchères en cours / terminées) */}
      {deal.is_locked && (
        <div className="card p-4 mb-6 bg-gray-100 border-gray-300 flex items-center gap-3">
          <Lock className="h-5 w-5 text-gray-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-gray-900 text-sm">Enchères en cours — lecture seule</p>
            <p className="text-xs text-gray-700">
              La fiche n'est plus modifiable depuis le démarrage des enchères. Contactez l'admin si une correction est nécessaire.
            </p>
          </div>
        </div>
      )}

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

      {/* Fiche complète — tous les champs visibles par l'admin/acheteur post-NDA */}
      <div className="card p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Building className="h-4 w-4" /> Informations propriété
        </h2>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div className="col-span-2">
            <dt className="text-gray-500 text-xs">Adresse complète</dt>
            <dd className="font-medium flex items-center gap-1">
              <MapPin className="h-3 w-3 text-red-500" /> {deal.address_private}
            </dd>
          </div>
          {deal.postal_code && (
            <div>
              <dt className="text-gray-500 text-xs">Code postal</dt>
              <dd className="font-medium">{deal.postal_code}</dd>
            </div>
          )}
          {deal.region && (
            <div>
              <dt className="text-gray-500 text-xs">Région</dt>
              <dd className="font-medium">{deal.region}</dd>
            </div>
          )}
          {deal.mrc && (
            <div>
              <dt className="text-gray-500 text-xs">MRC</dt>
              <dd className="font-medium">{deal.mrc}</dd>
            </div>
          )}
          {deal.floor_price != null && (
            <div>
              <dt className="text-gray-500 text-xs">Prix plancher</dt>
              <dd className="font-medium">{formatMoney(deal.floor_price)}</dd>
            </div>
          )}
          {deal.gross_revenue != null && (
            <div>
              <dt className="text-gray-500 text-xs">Revenus bruts</dt>
              <dd className="font-medium">{formatMoney(deal.gross_revenue)}</dd>
            </div>
          )}
          {deal.net_revenue != null && (
            <div>
              <dt className="text-gray-500 text-xs">Revenus nets</dt>
              <dd className="font-medium">{formatMoney(deal.net_revenue)}</dd>
            </div>
          )}
          {deal.yield_pct != null && (
            <div>
              <dt className="text-gray-500 text-xs">Rendement</dt>
              <dd className="font-medium text-emerald-600">{deal.yield_pct.toFixed(2)}%</dd>
            </div>
          )}
          {deal.num_units != null && (
            <div>
              <dt className="text-gray-500 text-xs">Logements</dt>
              <dd className="font-medium">{deal.num_units}</dd>
            </div>
          )}
          {deal.year_built != null && (
            <div>
              <dt className="text-gray-500 text-xs">Année de construction</dt>
              <dd className="font-medium">{deal.year_built}</dd>
            </div>
          )}
          {deal.total_area_sqft != null && (
            <div>
              <dt className="text-gray-500 text-xs">Superficie totale</dt>
              <dd className="font-medium">{deal.total_area_sqft} pi²</dd>
            </div>
          )}
          {deal.municipal_evaluation != null && (
            <div>
              <dt className="text-gray-500 text-xs">Évaluation municipale</dt>
              <dd className="font-medium">{formatMoney(deal.municipal_evaluation)}</dd>
            </div>
          )}
          {deal.zoning && (
            <div>
              <dt className="text-gray-500 text-xs">Zonage</dt>
              <dd className="font-medium">{deal.zoning}</dd>
            </div>
          )}
          {deal.tax_roll_date && (
            <div>
              <dt className="text-gray-500 text-xs">Date du rôle d'évaluation</dt>
              <dd className="font-medium">{new Date(deal.tax_roll_date).toLocaleDateString('fr-CA')}</dd>
            </div>
          )}
        </dl>

        {deal.teaser_text && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <dt className="text-gray-500 text-xs mb-1">Teaser public</dt>
            <p className="text-sm text-gray-700 whitespace-pre-line">{deal.teaser_text}</p>
          </div>
        )}

        {deal.easements && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <dt className="text-gray-500 text-xs mb-1">Servitudes</dt>
            <p className="text-sm text-gray-700 whitespace-pre-line">{deal.easements}</p>
          </div>
        )}

        {deal.visit_notes && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <dt className="text-gray-500 text-xs mb-1">Notes de visite</dt>
            <p className="text-sm text-gray-700 whitespace-pre-line">{deal.visit_notes}</p>
          </div>
        )}

        {deal.virtual_tour_url && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <dt className="text-gray-500 text-xs mb-1 flex items-center gap-1">
              <Video className="h-3 w-3" /> Visite virtuelle
            </dt>
            <a href={deal.virtual_tour_url} target="_blank" rel="noreferrer" className="link-brand text-sm">
              {deal.virtual_tour_url}
            </a>
          </div>
        )}
      </div>

      {/* Dépenses */}
      {deal.expenses && Object.values(deal.expenses).some(v => v) && (
        <div className="card p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Receipt className="h-4 w-4" /> Dépenses annuelles
          </h2>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            {Object.entries(deal.expenses).map(([k, v]) =>
              v ? (
                <div key={k}>
                  <dt className="text-gray-500 text-xs">{EXPENSES_LABEL[k] || k}</dt>
                  <dd className="font-medium">{formatMoney(Number(v))}</dd>
                </div>
              ) : null
            )}
          </dl>
        </div>
      )}

      {/* Travaux */}
      {Array.isArray(deal.work_history) && deal.work_history.length > 0 && (
        <div className="card p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Hammer className="h-4 w-4" /> Historique des travaux
          </h2>
          <ul className="space-y-2 text-sm">
            {deal.work_history.map((w, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="font-medium min-w-[120px]">{WORK_LABEL[w.category] || w.category}</span>
                <span className="text-gray-700">{w.year || '—'}{w.note ? ` · ${w.note}` : ''}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Divulgations matérielles */}
      {deal.material_disclosures && Object.values(deal.material_disclosures).some(Boolean) && (
        <div className="card p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Divulgations matérielles</h2>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            {deal.material_disclosures.asbestos && (
              <div>
                <dt className="text-gray-500 text-xs">Amiante</dt>
                <dd className="font-medium">{TRI_LABEL[deal.material_disclosures.asbestos] || deal.material_disclosures.asbestos}</dd>
              </div>
            )}
            {deal.material_disclosures.pyrite && (
              <div>
                <dt className="text-gray-500 text-xs">Pyrite</dt>
                <dd className="font-medium">{TRI_LABEL[deal.material_disclosures.pyrite] || deal.material_disclosures.pyrite}</dd>
              </div>
            )}
            {deal.material_disclosures.zoning_confirmed && (
              <div>
                <dt className="text-gray-500 text-xs">Zonage confirmé</dt>
                <dd className="font-medium">{TRI_LABEL[deal.material_disclosures.zoning_confirmed] || deal.material_disclosures.zoning_confirmed}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* Documents */}
      {deal.documents && Object.keys(deal.documents).length > 0 && (
        <div className="card p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4" /> Documents
          </h2>
          <ul className="text-sm space-y-1.5">
            {Object.entries(deal.documents).map(([key, path]) => (
              <li key={key}>
                <a href={fileUrl(path)} target="_blank" rel="noreferrer" className="link-brand hover:underline">
                  {key.replace(/_/g, ' ')}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Photos & sélection teaser — visibles toujours, modifiables si !is_locked */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            Photos & teaser ({(deal.photo_paths || []).length})
          </h2>
          {!deal.is_locked && (
            <label className="btn-secondary text-xs cursor-pointer inline-flex items-center gap-1.5">
              <Upload className="h-3.5 w-3.5" />
              Ajouter des photos
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => {
                  const list = Array.from(e.target.files || [])
                  if (list.length) uploadPhotosMut.mutate(list)
                  e.target.value = ''
                }}
              />
            </label>
          )}
        </div>

        {(!deal.photo_paths || deal.photo_paths.length === 0) ? (
          <p className="text-sm text-gray-500">
            Aucune photo. Ajoutez-en pour pouvoir sélectionner 1 couverture + 2 secondaires
            qui seront watermarquées et visibles publiquement avant NDA.
          </p>
        ) : (
          <>
            <p className="text-xs text-gray-600 mb-3">
              Cochez 1 photo de couverture (★) et jusqu'à 2 photos secondaires.
              Les 1 à 3 photos sélectionnées seront watermarquées et publiques avant NDA ;
              les autres restent privées (post-NDA uniquement).
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4">
              {(deal.photo_paths || []).map((p, i) => {
                const isCover = coverPath === p
                const secRank = secondaryPaths.indexOf(p)
                const isSecondary = secRank >= 0
                const secDisabled = !isSecondary && !isCover && secondaryPaths.length >= 2
                return (
                  <div key={p} className="relative">
                    <img
                      src={fileUrl(p)}
                      alt={`Photo ${i + 1}`}
                      className={`h-32 w-full object-cover rounded-lg ${
                        isCover ? 'ring-2 ring-amber-500' : isSecondary ? 'ring-2 ring-blue-500' : ''
                      }`}
                    />
                    {isCover && (
                      <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wide">
                        ★ Couverture
                      </span>
                    )}
                    {isSecondary && (
                      <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-blue-500 text-white text-[10px] font-bold uppercase tracking-wide">
                        Sec. {secRank + 1}
                      </span>
                    )}
                    {!deal.is_locked && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm('Supprimer cette photo ?')) deletePhotoMut.mutate(p)
                          }}
                          aria-label="Supprimer la photo"
                          className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <div className="absolute bottom-1 inset-x-1 flex gap-1">
                          <button
                            type="button"
                            onClick={() => onPickCover(p)}
                            className={`flex-1 text-[10px] font-semibold py-1 rounded transition ${
                              isCover
                                ? 'bg-amber-500 text-white shadow'
                                : 'bg-white/90 text-gray-700 hover:bg-amber-50 hover:text-amber-700'
                            }`}
                          >
                            <Star className="h-3 w-3 inline -mt-0.5" /> Cover
                          </button>
                          <button
                            type="button"
                            onClick={() => onToggleSecondary(p)}
                            disabled={secDisabled}
                            className={`flex-1 text-[10px] font-semibold py-1 rounded transition disabled:opacity-40 disabled:cursor-not-allowed ${
                              isSecondary
                                ? 'bg-blue-500 text-white shadow'
                                : 'bg-white/90 text-gray-700 hover:bg-blue-50 hover:text-blue-700'
                            }`}
                          >
                            Secondaire
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            {!deal.is_locked && (
              <div className="flex items-center justify-between gap-3 flex-wrap pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  {coverPath
                    ? `Sélection : 1 cover · ${secondaryPaths.length} secondaire${secondaryPaths.length > 1 ? 's' : ''}`
                    : 'Aucune sélection — choisissez d\'abord une couverture'}
                </p>
                <button
                  type="button"
                  onClick={() => teaserSelectionMut.mutate()}
                  disabled={!coverPath || teaserSelectionMut.isPending}
                  className="btn-primary text-sm inline-flex items-center gap-1.5"
                >
                  <Save className="h-3.5 w-3.5" />
                  {teaserSelectionMut.isPending ? 'Génération…' : 'Enregistrer la sélection teaser'}
                </button>
              </div>
            )}

            {/* Aperçu courant des watermarks publics */}
            {(deal.teaser_photo_paths || []).length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2">
                  Aperçu teaser actuel (watermarqué, visible avant NDA)
                </p>
                <div className="flex gap-2 flex-wrap">
                  {(deal.teaser_photo_paths || []).map((wp, i) => (
                    <img
                      key={i}
                      src={fileUrl(wp)}
                      alt={`Teaser ${i + 1}`}
                      className="h-20 w-32 object-cover rounded border border-gray-200"
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Frais Logeo (post-verdict) */}
      {(deal.fee_pct || deal.fee_minimum) && (
        <div className="card p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Frais Logeo applicables</h2>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            {deal.fee_pct != null && (
              <div>
                <dt className="text-gray-500 text-xs">Pourcentage</dt>
                <dd className="font-medium">{deal.fee_pct}%</dd>
              </div>
            )}
            {deal.fee_minimum != null && (
              <div>
                <dt className="text-gray-500 text-xs">Plancher</dt>
                <dd className="font-medium">{formatMoney(deal.fee_minimum)}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

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
