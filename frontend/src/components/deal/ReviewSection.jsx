import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Star, Send } from 'lucide-react'
import { createReviewApi, listReviewsForDealApi } from '../../api/reviews'
import { Textarea } from '../ui/Input'
import RatingStars from '../ui/RatingStars'

/**
 * Section affichée sur la page d'un deal complété (status = pa_signed).
 * Permet à courtier ↔ acheteur gagnant de s'évaluer mutuellement et
 * affiche les évaluations existantes.
 *
 *  Props:
 *   - dealId
 *   - canRate (bool) : l'utilisateur courant peut-il rater l'autre partie ?
 *   - rateeRoleLabel: 'l'acheteur' ou 'le courtier'
 *   - alreadyRated (bool) : a-t-il déjà laissé une review pour ce deal ?
 */
export default function ReviewSection({ dealId, canRate, rateeRoleLabel, alreadyRated }) {
  const queryClient = useQueryClient()
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')

  const { data: reviews } = useQuery({
    queryKey: ['reviews', dealId],
    queryFn: () => listReviewsForDealApi(dealId),
  })

  const submit = useMutation({
    mutationFn: () => createReviewApi(dealId, { rating, comment: comment.trim() || null }),
    onSuccess: () => {
      toast.success('Évaluation enregistrée')
      setRating(0); setComment('')
      queryClient.invalidateQueries({ queryKey: ['reviews', dealId] })
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erreur'),
  })

  return (
    <div className="card p-6">
      <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Star className="h-4 w-4 text-amber-500" />
        Évaluations ({reviews?.length || 0})
      </h2>

      {/* Existing reviews */}
      <div className="space-y-3 mb-4">
        {reviews?.map(r => (
          <div key={r.id} className="border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-gray-900">
                {r.rater_name || 'Anonyme'}
                <span className="ml-2 text-xs text-gray-500">· {r.rater_role_label}</span>
              </p>
              <p className="text-xs text-gray-500">
                {new Date(r.created_at).toLocaleDateString('fr-CA')}
              </p>
            </div>
            <RatingStars value={r.rating} readonly size="sm" />
            {r.comment && (
              <p className="text-sm text-gray-700 mt-2 whitespace-pre-line">{r.comment}</p>
            )}
          </div>
        ))}
        {reviews?.length === 0 && (
          <p className="text-sm text-gray-500 italic">Aucune évaluation pour ce deal.</p>
        )}
      </div>

      {/* Form (only if eligible and not already rated) */}
      {canRate && !alreadyRated && (
        <div className="border-t border-gray-100 pt-4 space-y-3">
          <p className="text-sm font-medium text-gray-900">
            Évaluer {rateeRoleLabel}
          </p>
          <div className="flex items-center gap-2">
            <RatingStars value={rating} onChange={setRating} size="lg" />
            <span className="text-sm text-gray-500 ml-2">{rating || '—'}/5</span>
          </div>
          <Textarea
            label="Commentaire (optionnel)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="Décrivez votre expérience..."
          />
          <button
            onClick={() => {
              if (!rating) { toast.error('Sélectionnez une note'); return }
              submit.mutate()
            }}
            disabled={submit.isPending || !rating}
            className="btn-primary text-sm"
          >
            <Send className="h-3.5 w-3.5" />
            {submit.isPending ? 'Envoi...' : 'Soumettre l\'évaluation'}
          </button>
        </div>
      )}

      {canRate && alreadyRated && (
        <p className="text-sm text-emerald-700 italic">
          Vous avez déjà soumis votre évaluation pour ce deal. Merci !
        </p>
      )}
    </div>
  )
}
