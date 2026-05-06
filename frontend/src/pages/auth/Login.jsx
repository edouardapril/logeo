import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Building2 } from 'lucide-react'
import Input from '../../components/ui/Input'
import Logo from '../../components/ui/Logo'
import { loginApi, resendVerificationApi } from '../../api/auth'
import { useAuth } from '../../contexts/AuthContext'

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [needsVerify, setNeedsVerify] = useState(false)
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
      const detail = err.response?.data?.detail || 'Erreur de connexion'
      // Item 10 : reconnaît le 403 "Email non confirmé" pour proposer le renvoi
      if (err.response?.status === 403 && detail.toLowerCase().includes('email')) {
        setNeedsVerify(true)
      }
      toast.error(detail)
    } finally {
      setLoading(false)
    }
  }

  const onResend = async () => {
    if (!form.email) { toast.error('Saisissez votre email d\'abord'); return }
    try {
      await resendVerificationApi(form.email)
      toast.success('Si un compte existe pour cet email, un nouveau lien a été envoyé.')
    } catch {
      toast.error('Erreur lors du renvoi du lien.')
    }
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      <div className="flex-1 flex items-center justify-center px-8 py-12">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 inline-block text-[#1A1A1A]">
            <Logo size="md" />
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

          {needsVerify && (
            <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm">
              <p className="text-amber-900 font-medium mb-1">Email non confirmé</p>
              <p className="text-xs text-amber-800 mb-2">
                Vérifiez votre boîte mail (et les spams). Si vous n'avez rien reçu :
              </p>
              <button onClick={onResend} className="text-xs link-brand font-semibold">
                Renvoyer le lien de confirmation →
              </button>
            </div>
          )}

          <div className="mt-8 text-center text-sm text-gray-600">
            <p className="mb-2">Pas encore de compte ?</p>
            <div className="flex items-center justify-center gap-3">
              <Link to="/register/courtier" className="font-medium link-brand">
                S'inscrire comme courtier
              </Link>
              <span className="text-gray-300">·</span>
              <Link to="/register/acheteur" className="font-medium link-brand">
                Comme acheteur
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex flex-1 bg-[#EA580C] items-center justify-center p-12 relative overflow-hidden">
        <div className="relative max-w-md text-white">
          <Building2 className="h-12 w-12 mb-6 text-white/90" />
          <h2 className="text-3xl font-bold mb-4 leading-tight">
            La marketplace off-market des investisseurs immobiliers du Québec
          </h2>
          <p className="text-white/90 leading-relaxed">
            Connectez-vous à un réseau de courtiers OACIQ vérifiés et d'acheteurs qualifiés.
            Enchères anonymes, NDA légaux, paiements sécurisés.
          </p>
        </div>
      </div>
    </div>
  )
}
