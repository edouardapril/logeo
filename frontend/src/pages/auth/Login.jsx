import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Building2 } from 'lucide-react'
import Input from '../../components/ui/Input'
import { loginApi } from '../../api/auth'
import { useAuth } from '../../contexts/AuthContext'

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { login } = useAuth()

  const onSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await loginApi(form)
      login(data)
      toast.success('Connexion réussie')
      if (data.role === 'admin') navigate('/admin')
      else if (data.role === 'courtier') navigate('/courtier')
      else navigate('/acheteur/deals')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      <div className="flex-1 flex items-center justify-center px-8 py-12">
        <div className="w-full max-w-md">
          <Link to="/" className="inline-flex items-center gap-2 mb-8">
            <div className="h-9 w-9 rounded-lg bg-logeo-600 flex items-center justify-center text-white font-bold">L</div>
            <span className="text-2xl font-bold text-logeo-900">Logeo</span>
          </Link>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">Connexion</h1>
          <p className="text-sm text-gray-600 mb-8">
            Accédez à votre tableau de bord
          </p>

          <form onSubmit={onSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="vous@exemple.com"
            />
            <Input
              label="Mot de passe"
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
            />
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-gray-600">
            <p className="mb-2">Pas encore de compte ?</p>
            <div className="flex items-center justify-center gap-3">
              <Link to="/register/courtier" className="font-medium text-logeo-600 hover:text-logeo-700">
                S'inscrire comme courtier
              </Link>
              <span className="text-gray-300">·</span>
              <Link to="/register/acheteur" className="font-medium text-logeo-600 hover:text-logeo-700">
                Comme acheteur
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-logeo-900 via-logeo-800 to-logeo-950 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 h-72 w-72 rounded-full bg-logeo-400 blur-3xl" />
          <div className="absolute bottom-20 right-20 h-96 w-96 rounded-full bg-logeo-500 blur-3xl" />
        </div>
        <div className="relative max-w-md text-white">
          <Building2 className="h-12 w-12 mb-6 text-logeo-200" />
          <h2 className="text-3xl font-bold mb-4 leading-tight">
            La marketplace off-market des investisseurs immobiliers du Québec
          </h2>
          <p className="text-logeo-100/80 leading-relaxed">
            Connectez-vous à un réseau de courtiers OACIQ vérifiés et d'acheteurs qualifiés.
            Enchères anonymes, NDA légaux, paiements sécurisés.
          </p>
        </div>
      </div>
    </div>
  )
}
