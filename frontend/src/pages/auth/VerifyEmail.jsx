import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import Logo from '../../components/ui/Logo'
import { verifyEmailApi } from '../../api/auth'

export default function VerifyEmail() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const [state, setState] = useState({ status: 'loading', message: '' })

  useEffect(() => {
    if (!token) {
      setState({ status: 'error', message: 'Lien invalide — token manquant.' })
      return
    }
    verifyEmailApi(token)
      .then((res) => setState({
        status: 'ok',
        message: `Email confirmé ! Vous pouvez maintenant vous connecter avec ${res.email}.`,
      }))
      .catch((e) => setState({
        status: 'error',
        message: e.response?.data?.detail || 'Lien invalide ou expiré.',
      }))
  }, [token])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 inline-block text-[#1A1A1A]">
          <Logo size="md" />
        </Link>
        <div className="card p-8 text-center">
          {state.status === 'loading' && (
            <>
              <Loader2 className="h-12 w-12 mx-auto text-[#EA580C] mb-3 animate-spin" />
              <p className="text-gray-600">Vérification en cours...</p>
            </>
          )}
          {state.status === 'ok' && (
            <>
              <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-600 mb-3" />
              <h1 className="text-xl font-bold text-gray-900 mb-2">Email confirmé</h1>
              <p className="text-sm text-gray-600 mb-6">{state.message}</p>
              <Link to="/login" className="btn-primary">Se connecter</Link>
            </>
          )}
          {state.status === 'error' && (
            <>
              <AlertTriangle className="h-12 w-12 mx-auto text-red-600 mb-3" />
              <h1 className="text-xl font-bold text-gray-900 mb-2">Lien invalide</h1>
              <p className="text-sm text-gray-600 mb-6">{state.message}</p>
              <Link to="/login" className="btn-secondary">Retour à la connexion</Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
