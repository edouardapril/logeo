import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { TrendingUp, Info } from 'lucide-react'
import Input from '../../components/ui/Input'
import Logo from '../../components/ui/Logo'
import TermsConsent, { allTermsAccepted } from '../../components/auth/TermsConsent'
import { useAuth } from '../../contexts/AuthContext'
import { formatPhoneCA, isValidCAPhone } from '../../utils/phone'

export default function RegisterAcheteur() {
  const [form, setForm] = useState({ email: '', password: '', full_name: '', phone: '' })
  const [tos, setTos] = useState({
    tos_cgu: false, tos_privacy: false,
    tos_canadian_resident: false, tos_qualified_investor: false,
  })
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { signUp } = useAuth()

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const tosOk = allTermsAccepted('acheteur', tos)

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!tosOk) {
      toast.error('Vous devez cocher les 4 conditions pour créer votre compte.')
      return
    }
    setLoading(true)
    try {
      // LOTPLOT 28 — signup via supabase-js (depuis AuthContext.signUp).
      // Les champs métier (full_name, phone, role) passent en user_metadata
      // → consommés par le trigger handle_new_user pour peupler public.profiles.
      // L'email de confirmation est envoyé automatiquement par Supabase
      // (Auth → Email Templates côté dashboard).
      await signUp(form.email, form.password, {
        full_name: form.full_name,
        phone: form.phone,
        role: 'acheteur',
      })
      toast.success('Compte créé. Un email de confirmation vous a été envoyé.', { duration: 6000 })
      navigate('/login', { replace: true })
    } catch (err) {
      const msg = err?.message || err?.response?.data?.detail || 'Erreur lors de l\'inscription'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <Link to="/" className="mb-6 inline-block text-[#1A1A1A]">
          <Logo size="md" />
        </Link>

        <div className="card p-8">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-5 w-5 text-[#EA580C]" />
            <h1 className="text-2xl font-bold text-gray-900">Inscription acheteur</h1>
          </div>
          <p className="text-sm text-gray-600 mb-6">
            Accédez à des deals immobiliers off-market au Québec
          </p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Nom complet" required value={form.full_name} onChange={set('full_name')} />
              <Input
                label="Téléphone *"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: formatPhoneCA(e.target.value) })}
                placeholder="(514) 555-1234"
                hint="Utilisé pour le 2FA SMS lors des paiements"
                error={form.phone && !isValidCAPhone(form.phone) ? 'Format requis : (xxx) xxx-xxxx' : null}
              />
            </div>
            <Input label="Email" type="email" required value={form.email} onChange={set('email')} />
            <Input label="Mot de passe" type="password" required value={form.password} onChange={set('password')} />

            <div className="rounded-lg bg-[#FFEDD5] border border-[#FDBA74] p-3 mt-2 flex gap-2">
              <Info className="h-4 w-4 text-[#C2410C] mt-0.5 flex-shrink-0" />
              <p className="text-xs text-[#1A1A1A] leading-relaxed">
                Votre compte doit être <strong>qualifié par l'équipe Logeo</strong> avant de pouvoir
                accéder aux deals. Nous vous contacterons sous 24h.
              </p>
            </div>

            {/* Conditions d'utilisation — sprint final item 9 */}
            <div className="pt-4 border-t border-gray-100">
              <p className="text-sm font-semibold text-gray-900 mb-3">
                Conditions d'utilisation et confirmations légales
              </p>
              <TermsConsent role="acheteur" value={tos} onChange={setTos} />
            </div>

            <button
              type="submit"
              disabled={loading || !tosOk}
              className="btn-primary w-full mt-2"
            >
              {loading ? 'Création...' : 'Créer mon compte'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-600 mt-6">
            Déjà un compte ?{' '}
            <Link to="/login" className="font-medium link-brand">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
