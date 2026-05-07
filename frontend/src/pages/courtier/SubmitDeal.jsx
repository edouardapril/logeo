import { useState } from 'react'
import { useNavigate, Link, Navigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Upload, FileText, Image as ImageIcon, X, Plus, Hammer,
  AlertTriangle, Video, Receipt, Home,
} from 'lucide-react'
import Input, { Select, Textarea } from '../../components/ui/Input'
import {
  submitDealApi, uploadDocumentsApi, uploadDealPhotosApi,
  createUnitApi,
} from '../../api/courtier'
import { conventionStatusApi } from '../../api/profile'
import { PROPERTY_TYPES } from '../../utils/constants'
import Spinner from '../../components/ui/Spinner'
import QuebecLocationPicker from '../../components/ui/QuebecLocationPicker'

const MAX_PHOTOS = 10

const WORK_CATEGORIES = [
  { key: 'toiture',    label: 'Toiture' },
  { key: 'fondation',  label: 'Fondation' },
  { key: 'electrique', label: 'Électrique' },
  { key: 'plomberie',  label: 'Plomberie' },
  { key: 'fenetres',   label: 'Fenêtres' },
  { key: 'chauffage',  label: 'Chauffage' },
]

const TRI_STATE = [
  { value: '',         label: '— Sélectionner —' },
  { value: 'no',       label: 'Non' },
  { value: 'yes',      label: 'Oui' },
  { value: 'unknown',  label: 'Inconnu' },
]

const OCCUPANCY = [
  { value: 'rented', label: 'Loué' },
  { value: 'vacant', label: 'Libre' },
]

export default function SubmitDeal() {
  const navigate = useNavigate()
  const { data: conv, isLoading: loadingConv } = useQuery({
    queryKey: ['convention-status'],
    queryFn: conventionStatusApi,
  })

  const [form, setForm] = useState({
    property_type: PROPERTY_TYPES[0].value,
    region: '',
    mrc: '',
    city: '',
    postal_code: '',
    address_private: '',
    asking_price: '',
    floor_price: '',
    municipal_evaluation: '',
    gross_revenue: '',
    net_revenue: '',
    yield_pct: '',
    num_units: '',
    year_built: '',
    total_area_sqft: '',
    tax_roll_date: '',
    teaser_text: '',
    virtual_tour_url: '',
    visit_notes: '',
    zoning: '',
    easements: '',
  })

  // Expenses : taxes, assurances, entretien, frais de gestion, autres
  const [expenses, setExpenses] = useState({
    taxes_municipales: '', taxes_scolaires: '',
    assurances: '', entretien: '', frais_gestion: '', autres: '',
  })

  // work_history : list of { category, year, note }
  const [workHistory, setWorkHistory] = useState([])

  // material_disclosures : { asbestos, pyrite, zoning_confirmed }
  const [materials, setMaterials] = useState({
    asbestos: '', pyrite: '', zoning_confirmed: '',
  })

  const [files, setFiles] = useState({
    baux: null, taxes: null, certificat_localisation: null,
    declaration_vendeur: null, rapport_complet: null,
  })
  const [photos, setPhotos] = useState([])

  // Logements (créés en local, POST après création du deal)
  const [units, setUnits] = useState([])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = useMutation({
    mutationFn: async () => {
      const cleanedExpenses = Object.fromEntries(
        Object.entries(expenses).filter(([_, v]) => v !== '').map(([k, v]) => [k, parseInt(v) || 0])
      )
      const cleanedMaterials = Object.fromEntries(
        Object.entries(materials).filter(([_, v]) => v !== '')
      )

      const payload = {
        property_type: form.property_type,
        region: form.region,
        mrc: form.mrc || null,
        city: form.city,
        postal_code: form.postal_code,
        address_private: form.address_private,
        asking_price: parseInt(form.asking_price),
        floor_price: form.floor_price ? parseInt(form.floor_price) : null,
        municipal_evaluation: form.municipal_evaluation ? parseInt(form.municipal_evaluation) : null,
        gross_revenue: form.gross_revenue ? parseInt(form.gross_revenue) : null,
        net_revenue: form.net_revenue ? parseInt(form.net_revenue) : null,
        yield_pct: form.yield_pct ? parseFloat(form.yield_pct) : null,
        num_units: form.num_units ? parseInt(form.num_units) : null,
        year_built: form.year_built ? parseInt(form.year_built) : null,
        total_area_sqft: form.total_area_sqft ? parseInt(form.total_area_sqft) : null,
        tax_roll_date: form.tax_roll_date || null,
        teaser_text: form.teaser_text || null,
        virtual_tour_url: form.virtual_tour_url || null,
        visit_notes: form.visit_notes || null,
        zoning: form.zoning || null,
        easements: form.easements || null,
        expenses: Object.keys(cleanedExpenses).length ? cleanedExpenses : null,
        work_history: workHistory.length ? workHistory : null,
        material_disclosures: Object.keys(cleanedMaterials).length ? cleanedMaterials : null,
      }
      const deal = await submitDealApi(payload)

      // Documents
      const fd = new FormData()
      let hasDoc = false
      Object.entries(files).forEach(([k, f]) => {
        if (f) { fd.append(k, f); hasDoc = true }
      })
      if (hasDoc) await uploadDocumentsApi(deal.id, fd)

      // Photos générales
      if (photos.length) await uploadDealPhotosApi(deal.id, photos)

      // Logements
      for (let i = 0; i < units.length; i++) {
        const u = units[i]
        await createUnitApi(deal.id, {
          label: u.label,
          unit_type: u.unit_type || null,
          area_sqft: u.area_sqft ? parseInt(u.area_sqft) : null,
          current_rent: u.current_rent ? parseInt(u.current_rent) : null,
          market_rent: u.market_rent ? parseInt(u.market_rent) : null,
          lease_end: u.lease_end || null,
          occupancy_status: u.occupancy_status || null,
          notes: u.notes || null,
          order_index: i,
        })
      }

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
    if (!form.region) { toast.error('Région requise'); return }
    if (!form.city || !form.postal_code || !form.address_private || !form.asking_price) {
      toast.error('Adresse, ville, code postal et prix demandé sont obligatoires')
      return
    }
    if (!form.floor_price) {
      toast.error('Le prix plancher est obligatoire — c\'est l\'engagement ferme du vendeur')
      return
    }
    if (parseInt(form.floor_price) > parseInt(form.asking_price)) {
      toast.error('Le prix plancher ne peut pas être supérieur au prix demandé')
      return
    }
    submit.mutate()
  }

  const onAddPhotos = (e) => {
    const incoming = Array.from(e.target.files || [])
    if (!incoming.length) return
    const merged = [...photos, ...incoming].slice(0, MAX_PHOTOS)
    if (photos.length + incoming.length > MAX_PHOTOS) {
      toast(`Maximum ${MAX_PHOTOS} photos`, { icon: 'ℹ️' })
    }
    setPhotos(merged)
    e.target.value = ''
  }
  const removePhoto = (i) => setPhotos(photos.filter((_, idx) => idx !== i))

  const addWork = () => setWorkHistory([...workHistory, { category: 'toiture', year: '', note: '' }])
  const updateWork = (i, k, v) => {
    const copy = [...workHistory]
    copy[i] = { ...copy[i], [k]: v }
    setWorkHistory(copy)
  }
  const removeWork = (i) => setWorkHistory(workHistory.filter((_, idx) => idx !== i))

  const addUnit = () => setUnits([...units, {
    label: `Logement ${units.length + 1}`,
    unit_type: '4½', area_sqft: '', current_rent: '', market_rent: '',
    lease_end: '', occupancy_status: 'rented', notes: '',
  }])
  const updateUnit = (i, k, v) => {
    const copy = [...units]
    copy[i] = { ...copy[i], [k]: v }
    setUnits(copy)
  }
  const removeUnit = (i) => setUnits(units.filter((_, idx) => idx !== i))

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
        type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
        onChange={(e) => setFiles({ ...files, [name]: e.target.files[0] || null })}
      />
    </label>
  )

  // Gate convention : tous les hooks sont au-dessus, on peut faire les early-returns ici
  if (loadingConv) return <Spinner label="Vérification de la convention..." />
  if (conv?.needs_resign) {
    return <Navigate to="/courtier/convention" replace state={{ next: '/courtier/submit' }} />
  }

  return (
    <div className="max-w-3xl">
      <Link to="/courtier" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> Retour
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">Soumettre un nouveau deal</h1>
      <p className="text-sm text-gray-600 mb-6">
        Plus la fiche est complète, plus l'analyse est rapide et l'enchère performante.
      </p>

      <form onSubmit={onSubmit} className="space-y-6">

        {/* ── Identité du deal ── */}
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Informations propriété</h2>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Type de propriété *"
              value={form.property_type}
              onChange={set('property_type')}
              options={PROPERTY_TYPES}
            />
            <div /> {/* spacer pour la grille 2 colonnes */}
          </div>

          <QuebecLocationPicker
            value={{ region: form.region, mrc: form.mrc, city: form.city }}
            onChange={(loc) => setForm({ ...form, ...loc })}
            required
          />

          <Input
            label="Adresse complète *"
            required value={form.address_private} onChange={set('address_private')}
            placeholder="1234 rue Sainte-Catherine, Montréal, QC"
            hint="L'adresse n'est jamais exposée aux acheteurs avant signature du NDA"
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Code postal *" required value={form.postal_code} onChange={set('postal_code')}
              placeholder="H2X 1Y4" hint="Sert à classer le deal par région"
            />
            <Input label="Nombre de logements" type="number" min="0"
                   value={form.num_units} onChange={set('num_units')} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Année de construction" type="number" min="1700" max="2099"
                   value={form.year_built} onChange={set('year_built')}
                   placeholder="1985" />
            <Input label="Superficie totale (pi²)" type="number" min="0"
                   value={form.total_area_sqft} onChange={set('total_area_sqft')}
                   placeholder="6500" />
          </div>

          <Input
            label="Date au rôle foncier"
            type="date"
            value={form.tax_roll_date}
            onChange={set('tax_roll_date')}
            hint="Date de la dernière évaluation municipale connue"
          />

          <Textarea
            label="Description / teaser"
            value={form.teaser_text} onChange={set('teaser_text')}
            placeholder="Résumé attractif sans révéler l'adresse — visible publiquement..."
            rows={3}
          />
        </div>

        {/* ── Section financière ── */}
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Receipt className="h-4 w-4 text-[#C2410C]" /> Financier
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Prix demandé (CAD) *" required type="number" min="0"
                   value={form.asking_price} onChange={set('asking_price')} placeholder="800000" />
            <Input label="Valeur au rôle foncier (CAD)" type="number" min="0"
                   value={form.municipal_evaluation} onChange={set('municipal_evaluation')}
                   placeholder="650000"
                   hint="Évaluation municipale officielle" />
          </div>

          <Input
            label="Prix plancher (CAD) — engagement ferme du vendeur *"
            required type="number" min="0"
            value={form.floor_price} onChange={set('floor_price')} placeholder="700000"
            hint="Visible publiquement par les acheteurs. Le vendeur s'engage à accepter toute offre gagnante au-dessus."
          />

          <div className="grid grid-cols-2 gap-4">
            <Input label="Revenus bruts annuels (CAD)" type="number" min="0"
                   value={form.gross_revenue} onChange={set('gross_revenue')} placeholder="60000" />
            <Input label="Revenus nets annuels (CAD)" type="number" min="0"
                   value={form.net_revenue} onChange={set('net_revenue')} placeholder="42000" />
          </div>

          <Input label="TGA — Taux Global d'Actualisation (%)" type="number" step="0.01" min="0"
                 value={form.yield_pct} onChange={set('yield_pct')} placeholder="6.5"
                 hint="Cap rate / rendement de l'investissement" />

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Dépenses annuelles (CAD)</p>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Taxes municipales" type="number" min="0"
                     value={expenses.taxes_municipales}
                     onChange={(e) => setExpenses({ ...expenses, taxes_municipales: e.target.value })} />
              <Input label="Taxes scolaires" type="number" min="0"
                     value={expenses.taxes_scolaires}
                     onChange={(e) => setExpenses({ ...expenses, taxes_scolaires: e.target.value })} />
              <Input label="Assurances" type="number" min="0"
                     value={expenses.assurances}
                     onChange={(e) => setExpenses({ ...expenses, assurances: e.target.value })} />
              <Input label="Entretien" type="number" min="0"
                     value={expenses.entretien}
                     onChange={(e) => setExpenses({ ...expenses, entretien: e.target.value })} />
              <Input label="Frais de gestion (CAD)" type="number" min="0" placeholder="5000"
                     value={expenses.frais_gestion}
                     onChange={(e) => setExpenses({ ...expenses, frais_gestion: e.target.value })} />
              <Input label="Autres" type="number" min="0"
                     value={expenses.autres}
                     onChange={(e) => setExpenses({ ...expenses, autres: e.target.value })} />
            </div>
          </div>
        </div>

        {/* ── Logements ── */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Home className="h-4 w-4 text-[#C2410C]" /> Logements ({units.length})
            </h2>
            <button type="button" onClick={addUnit} className="btn-secondary text-xs">
              <Plus className="h-3.5 w-3.5" /> Ajouter un logement
            </button>
          </div>

          {units.length === 0 && (
            <p className="text-sm text-gray-500">
              Optionnel — tu peux aussi les ajouter plus tard depuis la page du deal.
            </p>
          )}

          <div className="space-y-3">
            {units.map((u, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-4 bg-gray-50/50">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-medium text-sm">{u.label}</p>
                  <button type="button" onClick={() => removeUnit(i)} className="text-red-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Identifiant" value={u.label}
                         onChange={(e) => updateUnit(i, 'label', e.target.value)} placeholder="Logement 1" />
                  <Input label="Type" value={u.unit_type}
                         onChange={(e) => updateUnit(i, 'unit_type', e.target.value)} placeholder="4½" />
                  <Input label="Superficie (pi²)" type="number" min="0" value={u.area_sqft}
                         onChange={(e) => updateUnit(i, 'area_sqft', e.target.value)} placeholder="850" />
                  <Select label="Statut" value={u.occupancy_status} options={OCCUPANCY}
                          onChange={(e) => updateUnit(i, 'occupancy_status', e.target.value)} />
                  <Input label="Loyer actuel (CAD/mois)" type="number" min="0" value={u.current_rent}
                         onChange={(e) => updateUnit(i, 'current_rent', e.target.value)} placeholder="900" />
                  <Input label="Loyer marché estimé (CAD/mois)" type="number" min="0" value={u.market_rent}
                         onChange={(e) => updateUnit(i, 'market_rent', e.target.value)} placeholder="1300" />
                  <Input label="Fin du bail" type="date" value={u.lease_end?.slice(0, 10) || ''}
                         onChange={(e) => updateUnit(i, 'lease_end', e.target.value)} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Travaux majeurs ── */}
        <div className="card p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Hammer className="h-4 w-4 text-[#C2410C]" /> Travaux majeurs réalisés
            </h2>
            <button type="button" onClick={addWork} className="btn-secondary text-xs">
              <Plus className="h-3.5 w-3.5" /> Ajouter un poste
            </button>
          </div>

          {workHistory.length === 0 && (
            <p className="text-sm text-gray-500">Optionnel — toiture, fondation, électrique, plomberie...</p>
          )}

          {workHistory.map((w, i) => (
            <div key={i} className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-4">
                <Select label="Catégorie" value={w.category}
                        onChange={(e) => updateWork(i, 'category', e.target.value)}
                        options={WORK_CATEGORIES.map(c => ({ value: c.key, label: c.label }))} />
              </div>
              <div className="col-span-2">
                <Input label="Année" type="number" min="1900" max="2099"
                       value={w.year} onChange={(e) => updateWork(i, 'year', e.target.value)} />
              </div>
              <div className="col-span-5">
                <Input label="Note" value={w.note}
                       onChange={(e) => updateWork(i, 'note', e.target.value)}
                       placeholder="Réfection complète, garantie 25 ans..." />
              </div>
              <div className="col-span-1">
                <button type="button" onClick={() => removeWork(i)} className="text-red-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* ── Matières & zonage ── */}
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-[#C2410C]" /> Divulgations matières & zonage
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <Select label="Présence d'amiante" value={materials.asbestos}
                    onChange={(e) => setMaterials({ ...materials, asbestos: e.target.value })}
                    options={TRI_STATE} />
            <Select label="Présence de pyrite" value={materials.pyrite}
                    onChange={(e) => setMaterials({ ...materials, pyrite: e.target.value })}
                    options={TRI_STATE} />
            <Select label="Zonage municipal confirmé" value={materials.zoning_confirmed}
                    onChange={(e) => setMaterials({ ...materials, zoning_confirmed: e.target.value })}
                    options={TRI_STATE} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Code de zonage" value={form.zoning} onChange={set('zoning')}
                   placeholder="R-3, C-2..." />
            <Input label="Servitudes connues" value={form.easements} onChange={set('easements')}
                   placeholder="ex: passage Hydro-Québec" />
          </div>
        </div>

        {/* ── Visite ── */}
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Video className="h-4 w-4 text-[#C2410C]" /> Visite
          </h2>
          <Input
            label="Lien visite virtuelle 360°"
            value={form.virtual_tour_url} onChange={set('virtual_tour_url')}
            placeholder="https://my.matterport.com/show/?m=..."
            hint="YouTube, Vimeo ou Matterport accepté"
          />
          <Textarea
            label="Disponibilités pour visites physiques"
            value={form.visit_notes} onChange={set('visit_notes')}
            placeholder="Ex: Mardi 18h-20h, samedis 10h-14h. Préavis 24h."
            rows={2}
          />
        </div>

        {/* ── Photos générales ── */}
        <div className="card p-6 space-y-3">
          <div>
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-[#C2410C]" /> Photos extérieur ({photos.length}/{MAX_PHOTOS})
            </h2>
            <p className="text-sm text-gray-500 mt-1">JPG, PNG ou WebP — max {MAX_PHOTOS}. Photos de logements à part, dans la section logements.</p>
          </div>

          {photos.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {photos.map((p, i) => (
                <div key={i} className="relative group">
                  <img src={URL.createObjectURL(p)} alt={`Photo ${i + 1}`}
                       className="h-24 w-full object-cover rounded-lg" />
                  <button type="button" onClick={() => removePhoto(i)}
                          className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {photos.length < MAX_PHOTOS && (
            <label className="flex items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
              <div className="text-center">
                <Upload className="h-5 w-5 text-gray-400 mx-auto mb-1" />
                <p className="text-sm font-medium text-gray-700">Ajouter des photos</p>
              </div>
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
                     onChange={onAddPhotos} />
            </label>
          )}
        </div>

        {/* ── Documents ── */}
        <div className="card p-6 space-y-3">
          <div>
            <h2 className="font-semibold text-gray-900">Documents</h2>
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
