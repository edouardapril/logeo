import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Building2, HelpCircle, ArrowRight } from 'lucide-react'
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
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-white">
      {/* GAUCHE — fond blanc */}
      <div className="flex items-center justify-center px-6 sm:px-8 py-10 sm:py-12 bg-white">
        <div className="w-full max-w-md">
          <div className="flex justify-center lg:justify-start mb-8">
            <Link to="/" className="inline-block text-[#1A1A1A]">
              <Logo size="md" />
            </Link>
          </div>

          <Link
            to="/marketplace"
            className="w-full mb-6 px-4 py-3.5 rounded-lg border border-[#FDBA74] bg-[#FFEDD5] text-[#9A3412] font-semibold text-sm hover:bg-[#FED7AA] active:bg-[#FDBA74] transition-colors flex items-center justify-between gap-2"
          >
            <span className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Voir les enchères en cours
            </span>
            <span className="text-[#EA580C]">→</span>
          </Link>

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
            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
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

          <div className="mt-7 text-center text-sm text-gray-600">
            <p className="mb-2">Pas encore de compte ?</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-3">
              <Link to="/register/courtier" className="font-medium link-brand">
                S'inscrire comme courtier
              </Link>
              <span className="text-gray-300 hidden sm:inline">·</span>
              <Link to="/register/acheteur" className="font-medium link-brand">
                Comme acheteur
              </Link>
            </div>
          </div>

          {/* Lien "Comment ça fonctionne ?" — bouton mis en avant */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <Link
              to="/comment-ca-marche"
              className="flex items-center justify-between gap-2 px-4 py-3.5 rounded-lg border border-gray-200 hover:border-[#FDBA74] hover:bg-[#FFF7ED] active:bg-[#FFEDD5] transition-colors group"
            >
              <span className="flex items-center gap-2.5 font-semibold text-gray-900">
                <HelpCircle className="h-5 w-5 text-[#EA580C]" />
                Comment ça fonctionne ?
              </span>
              <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-[#EA580C] transition-colors" />
            </Link>
          </div>
        </div>
      </div>

      {/* DROITE — fond orange (caché sur mobile / tablette) */}
      <div className="hidden lg:flex bg-[#EA580C] items-center justify-center p-12 relative overflow-hidden">
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
