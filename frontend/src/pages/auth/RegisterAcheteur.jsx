import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { TrendingUp, Info } from 'lucide-react'
import Input from '../../components/ui/Input'
import { registerAcheteurApi, loginApi } from '../../api/auth'
import { useAuth } from '../../contexts/AuthContext'

export default function RegisterAcheteur() {
  const [form, setForm] = useState({ email: '', password: '', full_name: '', phone: '' })
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { login } = useAuth()

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const onSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await registerAcheteurApi(form)
      const tokenData = await loginApi({ email: form.email, password: form.password })
      login(tokenData)
      toast.success('Compte créé. Un membre Logeo va vous contacter pour la qualification.')
      navigate('/acheteur/deals')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors de l\'inscription')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-2 mb-6">
          <div className="h-9 w-9 rounded-lg bg-logeo-600 flex items-center justify-center text-white font-bold">L</div>
          <span className="text-2xl font-bold text-logeo-900">Logeo</span>
        </Link>

        <div className="card p-8">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-5 w-5 text-logeo-600" />
            <h1 className="text-2xl font-bold text-gray-900">Inscription acheteur</h1>
          </div>
          <p className="text-sm text-gray-600 mb-6">
            Accédez à des deals immobiliers off-market au Québec
          </p>

          <form onSubmit={onSubmit} className="space-y-4">
            <Input label="Nom complet" required value={form.full_name} onChange={set('full_name')} />
            <Input label="Email" type="email" required value={form.email} onChange={set('email')} />
            <Input label="Téléphone" value={form.phone} onChange={set('phone')} placeholder="514-555-1234" />
            <Input label="Mot de passe" type="password" required value={form.password} onChange={set('password')} />

            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 mt-4 flex gap-2">
              <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-900 leading-relaxed">
                Votre compte doit être <strong>qualifié par l'équipe Logeo</strong> avant de pouvoir
                accéder aux deals. Nous vous contacterons sous 24h.
              </p>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? 'Création...' : 'Créer mon compte'}
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
