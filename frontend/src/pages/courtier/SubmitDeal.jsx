import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ArrowLeft, Upload, FileText } from 'lucide-react'
import Input, { Select, Textarea } from '../../components/ui/Input'
import { submitDealApi, uploadDocumentsApi } from '../../api/courtier'

const PROPERTY_TYPES = [
  { value: 'multiplex', label: 'Multiplex' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'mixte', label: 'Mixte' },
  { value: 'industriel', label: 'Industriel' },
  { value: 'terrain', label: 'Terrain' },
]

export default function SubmitDeal() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    property_type: 'multiplex',
    city: '',
    address_private: '',
    asking_price: '',
    gross_revenue: '',
    yield_pct: '',
    num_units: '',
    teaser_text: '',
  })
  const [files, setFiles] = useState({
    baux: null, taxes: null, certificat_localisation: null,
    declaration_vendeur: null, rapport_complet: null,
  })

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = useMutation({
    mutationFn: async () => {
      const payload = {
        property_type: form.property_type,
        city: form.city,
        address_private: form.address_private,
        asking_price: parseInt(form.asking_price),
        gross_revenue: form.gross_revenue ? parseInt(form.gross_revenue) : null,
        yield_pct: form.yield_pct ? parseFloat(form.yield_pct) : null,
        num_units: form.num_units ? parseInt(form.num_units) : null,
        teaser_text: form.teaser_text || null,
      }
      const deal = await submitDealApi(payload)

      const fd = new FormData()
      let hasFile = false
      Object.entries(files).forEach(([k, f]) => {
        if (f) { fd.append(k, f); hasFile = true }
      })
      if (hasFile) await uploadDocumentsApi(deal.id, fd)

      return deal
    },
    onSuccess: (deal) => {
      toast.success('Deal soumis · En attente d\'analyse')
      navigate(`/courtier/deals/${deal.id}`)
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erreur lors de la soumission'),
  })

  const onSubmit = (e) => {
    e.preventDefault()
    if (!form.address_private || !form.city || !form.asking_price) {
      toast.error('Adresse, ville et prix demandé sont obligatoires')
      return
    }
    submit.mutate()
  }

  const FileField = ({ name, label, required }) => (
    <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-gray-400" />
        <div>
          <p className="text-sm font-medium text-gray-700">
            {label} {required && <span className="text-red-500">*</span>}
          </p>
          {files[name] && <p className="text-xs text-emerald-600">{files[name].name}</p>}
        </div>
      </div>
      <Upload className="h-4 w-4 text-gray-400" />
      <input
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(e) => setFiles({ ...files, [name]: e.target.files[0] || null })}
      />
    </label>
  )

  return (
    <div className="max-w-3xl">
      <Link to="/courtier" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> Retour
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">Soumettre un nouveau deal</h1>
      <p className="text-sm text-gray-600 mb-6">
        L'équipe Logeo analyse chaque deal manuellement avant publication.
      </p>

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Informations propriété</h2>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Type de propriété *"
              value={form.property_type}
              onChange={set('property_type')}
              options={PROPERTY_TYPES}
            />
            <Input label="Ville *" required value={form.city} onChange={set('city')} placeholder="Montréal" />
          </div>

          <Input
            label="Adresse complète *"
            required
            value={form.address_private}
            onChange={set('address_private')}
            placeholder="1234 rue Sainte-Catherine, Montréal, QC"
            hint="L'adresse n'est jamais exposée aux acheteurs avant signature du NDA"
          />

          <div className="grid grid-cols-2 gap-4">
            <Input label="Prix demandé (CAD) *" required type="number" min="0"
                   value={form.asking_price} onChange={set('asking_price')} placeholder="800000" />
            <Input label="Nombre de logements" type="number" min="0"
                   value={form.num_units} onChange={set('num_units')} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Revenus bruts annuels (CAD)" type="number" min="0"
                   value={form.gross_revenue} onChange={set('gross_revenue')} placeholder="60000" />
            <Input label="Rendement (%)" type="number" step="0.01" min="0"
                   value={form.yield_pct} onChange={set('yield_pct')} placeholder="6.5" />
          </div>

          <Textarea
            label="Description / teaser"
            value={form.teaser_text}
            onChange={set('teaser_text')}
            placeholder="Résumé attractif sans révéler l'adresse — visible publiquement..."
            rows={3}
          />
        </div>

        <div className="card p-6 space-y-3">
          <div>
            <h2 className="font-semibold text-gray-900">Documents obligatoires</h2>
            <p className="text-sm text-gray-500 mt-1">PDF ou JPG · max 10 MB par fichier</p>
          </div>
          <FileField name="baux" label="Baux" required />
          <FileField name="taxes" label="Comptes de taxes" required />
          <FileField name="certificat_localisation" label="Certificat de localisation" required />
          <FileField name="declaration_vendeur" label="Déclaration du vendeur" required />
          <FileField name="rapport_complet" label="Rapport complet (sera watermarqué pour le gagnant)" />
        </div>

        <div className="flex justify-end gap-3">
          <Link to="/courtier" className="btn-secondary">Annuler</Link>
          <button type="submit" disabled={submit.isPending} className="btn-primary">
            {submit.isPending ? 'Envoi...' : 'Soumettre pour analyse'}
          </button>
        </div>
      </form>
    </div>
  )
}
