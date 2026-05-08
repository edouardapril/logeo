import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Upload, FileText, MessageSquare, Send, RotateCcw,
  Lock, Image as ImageIcon, Star, X, Save, Eye, Pencil,
} from 'lucide-react'
import {
  courtierGetDealApi, uploadPaApi,
  courtierListQuestionsApi, answerQuestionApi, restartRoundApi,
  uploadDealPhotosApi, deleteDealPhotoApi, setTeaserSelectionApi,
} from '../../api/courtier'
import Spinner from '../../components/ui/Spinner'
import { Textarea } from '../../components/ui/Input'
import ReviewSection from '../../components/deal/ReviewSection'
import { useAuth } from '../../contexts/AuthContext'
import { listReviewsForDealApi } from '../../api/reviews'
import { fileUrl } from '../../utils/url'
import DealFiche from '../../components/deal/DealFiche'
import DealHero from '../../components/deal/DealHero'
import LockedFeatureGrid from '../../components/deal/LockedFeatureGrid'
import CourtierDealProgress from '../../components/courtier/CourtierDealProgress'

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

  // CTA hero rôle-aware courtier owner :
  //  - pre-bidding (draft/analyse) : Modifier (lien — l'édition courante se fait
  //    via les sections de fiche éditables ci-dessous tant que !is_locked)
  //  - bidding (bid) ou post-bidding : Voir l'activité (lien interne ancre Q&A)
  //  - auction_ended : Relancer une nouvelle ronde (action mutation)
  const heroCta = (
    deal.status === 'auction_ended' ? (
      <button
        onClick={() => {
          if (window.confirm('Relancer une nouvelle ronde de 10 jours ? Le deal repassera en analyse.')) {
            restartMut.mutate()
          }
        }}
        disabled={restartMut.isPending}
        className="btn-primary w-full text-base py-3 inline-flex items-center justify-center gap-2"
      >
        <RotateCcw className="h-5 w-5" />
        {restartMut.isPending ? '...' : 'Relancer une nouvelle ronde'}
      </button>
    ) : ['draft', 'analyse'].includes(deal.status) && !deal.is_locked ? (
      <a
        href="#fiche-edit"
        className="btn-primary w-full text-base py-3 inline-flex items-center justify-center gap-2"
      >
        <Pencil className="h-5 w-5" />
        Modifier mon deal
      </a>
    ) : (
      <a
        href="#activite"
        className="btn-primary w-full text-base py-3 inline-flex items-center justify-center gap-2"
      >
        <Eye className="h-5 w-5" />
        Voir l'activité ({deal.ndas_count || 0} NDAs · {deal.bidders_count || 0} offres)
      </a>
    )
  )

  return (
    <div>
      <Link to="/courtier" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> Retour aux deals
      </Link>

      {/* Progress bar courtier — étapes Soumis → Approuvé → Enchères → Acheteur → PA */}
      <CourtierDealProgress deal={deal} />

      {/* Hero unifié — countdown + prix + CTA rôle-aware */}
      <DealHero deal={deal} cta={heroCta} />

      {/* Bandeau read-only si fiche verrouillée (post-démarrage enchères) */}
      {deal.is_locked && (
        <div className="card p-4 mb-6 bg-gray-100 border-gray-300 flex items-center gap-3">
          <Lock className="h-5 w-5 text-gray-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-gray-900 text-sm">Enchères en cours — fiche en lecture seule</p>
            <p className="text-xs text-gray-700">
              La fiche n'est plus modifiable depuis le démarrage des enchères. Contactez l'admin si une correction est nécessaire.
            </p>
          </div>
        </div>
      )}

      {/* Détails propriété (cards locked/unlocked) — owner a tout débloqué */}
      <div className="mb-6">
        <LockedFeatureGrid
          permissions={{
            canSeePhotos: true,
            canSeeAddress: true,
            canSeeDocuments: true,
            canSeeCourtier: true,
          }}
          lockedHint="—"
        />
      </div>

      {/* Fiche partagée — visuel acheteur post-NDA, sections rôle-aware */}
      <div id="fiche-edit">
        <DealFiche
          deal={deal}
          permissions={{
            canSeeAddress: true,        // owner voit son adresse
            canSeeFinancials: true,
            canSeePhotos: false,        // gérées par le panel courtier-spécifique ci-dessous
            canSeeCourtier: false,      // pas de bloc « courtier » à soi-même
            canSeeDocuments: true,
            canSeeAdminMeta: true,      // frais Logeo applicables
          }}
        />
      </div>

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
              {(deal.photo_paths || []).map((displayUrl, i) => {
                // Path BRUT (pour PATCH /teaser-selection — qui valide contre la DB)
                // ; `displayUrl` est l'URL signée pour l'affichage. Liste parallèle.
                const rawPath = (deal.photo_paths_raw || [])[i] || displayUrl
                const isCover = coverPath === rawPath
                const secRank = secondaryPaths.indexOf(rawPath)
                const isSecondary = secRank >= 0
                const secDisabled = !isSecondary && !isCover && secondaryPaths.length >= 2
                return (
                  <div key={rawPath} className="relative">
                    <img
                      src={fileUrl(displayUrl)}
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
                            if (window.confirm('Supprimer cette photo ?')) deletePhotoMut.mutate(rawPath)
                          }}
                          aria-label="Supprimer la photo"
                          className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <div className="absolute bottom-1 inset-x-1 flex gap-1">
                          <button
                            type="button"
                            onClick={() => onPickCover(rawPath)}
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
                            onClick={() => onToggleSecondary(rawPath)}
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

      {/* Q&A — répondre aux questions des acheteurs */}
      <div id="activite" className="card p-6 mb-6">
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
