import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Eye, LogOut } from 'lucide-react'
import { impersonateExitApi } from '../../api/admin'
import { useAuth } from '../../contexts/AuthContext'

const ROLE_LABEL = {
  acheteur: 'Acheteur',
  courtier: 'Courtier',
  regional_partner: 'Partenaire régional',
}

export default function ImpersonationBanner() {
  const navigate = useNavigate()
  const { isImpersonating, impersonation, exitImpersonation } = useAuth()

  const exitMut = useMutation({
    mutationFn: () => impersonateExitApi(),
    onSuccess: (token) => {
      exitImpersonation(token)
      toast.success('Mode visualisation quitté')
      navigate('/admin')
    },
    onError: (e) => {
      // Fallback : restaure depuis le snapshot local même si /exit échoue
      exitImpersonation(null)
      toast.error(e.response?.data?.detail || 'Session expirée — admin restauré localement')
      navigate('/admin')
    },
  })

  if (!isImpersonating || !impersonation) return null

  const t = impersonation.target || {}

  return (
    <div className="sticky top-0 z-40 bg-[#EA580C] text-white px-4 py-2 flex items-center justify-between gap-3 shadow">
      <div className="flex items-center gap-2 min-w-0">
        <Eye className="h-4 w-4 flex-shrink-0" />
        <p className="text-sm truncate">
          <span className="font-bold">Mode visualisation</span>
          {' · '}
          <span className="opacity-90">
            {ROLE_LABEL[t.role] || t.role} — {t.full_name || t.email}
          </span>
          <span className="opacity-75 hidden md:inline"> · session 60 min, actions destructives bloquées</span>
        </p>
      </div>
      <button
        onClick={() => exitMut.mutate()}
        disabled={exitMut.isPending}
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-white/20 hover:bg-white/30 text-sm font-semibold flex-shrink-0"
      >
        <LogOut className="h-3.5 w-3.5" />
        Quitter
      </button>
    </div>
  )
}
