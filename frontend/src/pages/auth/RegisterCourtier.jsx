import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ShieldCheck } from 'lucide-react'
import Input from '../../components/ui/Input'
import { registerCourtierApi, loginApi } from '../../api/auth'
import { useAuth } from '../../contexts/AuthContext'

export default function RegisterCourtier() {
  const [form, setForm] = useState({
    email: '', password: '', full_name: '', phone: '',
    oaciq_number: '', agency_name: '',
  })
  const [conventionAccepted, setConventionAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { login } = useAuth()

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!conventionAccepted) {
      toast.error('Vous devez signer la convention de non-contournement')
      return
    }
    setLoading(true)
    try {
      await registerCourtierApi(form)
      const tokenData = await loginApi({ email: form.email, password: form.password })
      login(tokenData)
      toast.success('Compte créé avec succès')
      navigate('/courtier')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors de l\'inscription')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <Link to="/" className="inline-flex items-center gap-2 mb-6">
          <div className="h-9 w-9 rounded-lg bg-logeo-600 flex items-center justify-center text-white font-bold">L</div>
          <span className="text-2xl font-bold text-logeo-900">Logeo</span>
        </Link>

        <div className="card p-8">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="h-5 w-5 text-logeo-600" />
            <h1 className="text-2xl font-bold text-gray-900">Inscription courtier OACIQ</h1>
          </div>
          <p className="text-sm text-gray-600 mb-6">
            Réservé aux courtiers immobiliers détenant un permis OACIQ valide.
          </p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Nom complet" required value={form.full_name} onChange={set('full_name')} />
              <Input label="Téléphone" value={form.phone} onChange={set('phone')} placeholder="514-555-1234" />
            </div>
            <Input label="Email professionnel" type="email" required value={form.email} onChange={set('email')} />
            <Input label="Mot de passe" type="password" required value={form.password} onChange={set('password')} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Numéro OACIQ" required value={form.oaciq_number} onChange={set('oaciq_number')} placeholder="A1234" />
              <Input label="Nom de l'agence" required value={form.agency_name} onChange={set('agency_name')} />
            </div>

            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 mt-6">
              <h3 className="text-sm font-semibold text-amber-900 mb-2">
                Convention de non-contournement
              </h3>
              <p className="text-xs text-amber-800 leading-relaxed mb-3">
                En vous inscrivant, vous vous engagez pendant <strong>24 mois</strong> à ne pas
                contourner Logeo en concluant directement avec un acheteur découvert via la
                plateforme. La pénalité en cas de contournement est de <strong>3x les frais Logeo</strong>.
                Cette convention est juridiquement contraignante au Québec.
              </p>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={conventionAccepted}
                  onChange={(e) => setConventionAccepted(e.target.checked)}
                  className="mt-0.5 rounded border-gray-300 text-logeo-600 focus:ring-logeo-500"
                />
                <span className="text-sm text-amber-900 font-medium">
                  J'accepte la convention de non-contournement et la collaboration avec Logeo
                </span>
              </label>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full mt-6">
              {loading ? 'Création du compte...' : 'Créer mon compte courtier'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-600 mt-6">
            Déjà un compte ?{' '}
            <Link to="/login" className="font-medium text-logeo-600 hover:text-logeo-700">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
