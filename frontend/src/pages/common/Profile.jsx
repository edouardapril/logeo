import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Camera, Trash2, User as UserIcon, Lock, Bell, Save } from 'lucide-react'
import {
  getMeApi, updateProfileApi, changePasswordApi,
  updateNotificationsApi, uploadProfilePhotoApi, deleteProfilePhotoApi,
} from '../../api/profile'
import Input from '../../components/ui/Input'
import Spinner from '../../components/ui/Spinner'
import { fileUrl } from '../../utils/url'

export default function Profile() {
  const queryClient = useQueryClient()
  const fileRef = useRef(null)
  const { data: me, isLoading } = useQuery({ queryKey: ['me-profile'], queryFn: getMeApi })

  const [profile, setProfile] = useState({ full_name: '', email: '', phone: '' })
  const [pwd, setPwd] = useState({ current_password: '', new_password: '', confirm: '' })
  const [emailNotif, setEmailNotif] = useState(true)

  useEffect(() => {
    if (me) {
      setProfile({ full_name: me.full_name || '', email: me.email || '', phone: me.phone || '' })
      setEmailNotif(me.email_notifications ?? true)
    }
  }, [me?.id])

  const updateMut = useMutation({
    mutationFn: updateProfileApi,
    onSuccess: () => {
      toast.success('Profil mis à jour')
      queryClient.invalidateQueries({ queryKey: ['me-profile'] })
      queryClient.invalidateQueries({ queryKey: ['me'] })
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erreur'),
  })

  const pwdMut = useMutation({
    mutationFn: () => changePasswordApi(pwd.current_password, pwd.new_password),
    onSuccess: () => {
      toast.success('Mot de passe modifié')
      setPwd({ current_password: '', new_password: '', confirm: '' })
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erreur'),
  })

  const notifMut = useMutation({
    mutationFn: updateNotificationsApi,
    onSuccess: () => {
      toast.success('Préférences enregistrées')
      queryClient.invalidateQueries({ queryKey: ['me-profile'] })
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erreur'),
  })

  const photoMut = useMutation({
    mutationFn: uploadProfilePhotoApi,
    onSuccess: () => {
      toast.success('Photo mise à jour')
      queryClient.invalidateQueries({ queryKey: ['me-profile'] })
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Erreur'),
  })

  const deletePhotoMut = useMutation({
    mutationFn: deleteProfilePhotoApi,
    onSuccess: () => {
      toast.success('Photo supprimée')
      queryClient.invalidateQueries({ queryKey: ['me-profile'] })
    },
  })

  const onSelectPhoto = (e) => {
    const f = e.target.files?.[0]
    if (f) photoMut.mutate(f)
    e.target.value = ''
  }

  const onSubmitProfile = (e) => {
    e.preventDefault()
    updateMut.mutate(profile)
  }

  const onSubmitPwd = (e) => {
    e.preventDefault()
    if (pwd.new_password !== pwd.confirm) {
      toast.error('La confirmation ne correspond pas')
      return
    }
    if (pwd.new_password.length < 8) {
      toast.error('Mot de passe : 8 caractères minimum')
      return
    }
    pwdMut.mutate()
  }

  if (isLoading) return <Spinner label="Chargement du profil..." />
  if (!me) return null

  const initials = (me.full_name || me.email || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Mon profil</h1>
      <p className="text-sm text-gray-600 mb-6">
        Mets à jour tes infos, ton mot de passe et tes préférences.
      </p>

      {/* Photo */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-5">
          <div className="relative">
            {me.profile_photo_path ? (
              <img
                src={fileUrl(me.profile_photo_path)}
                alt="Photo de profil"
                className="h-20 w-20 rounded-full object-cover border-2 border-[#FED7AA]"
              />
            ) : (
              <div className="h-20 w-20 rounded-full bg-[#FFEDD5] text-[#C2410C] flex items-center justify-center text-xl font-bold">
                {initials}
              </div>
            )}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900">{me.full_name}</p>
            <p className="text-sm text-gray-600 capitalize">{me.role}</p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={photoMut.isPending}
                className="btn-secondary text-xs"
              >
                <Camera className="h-3.5 w-3.5" />
                {me.profile_photo_path ? 'Changer' : 'Ajouter'} la photo
              </button>
              {me.profile_photo_path && (
                <button
                  onClick={() => deletePhotoMut.mutate()}
                  className="btn-secondary text-xs text-red-700"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Supprimer
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={onSelectPhoto}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">JPG, PNG, WebP — 2 Mo max recommandé.</p>
          </div>
        </div>
      </div>

      {/* Infos */}
      <form onSubmit={onSubmitProfile} className="card p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <UserIcon className="h-4 w-4 text-[#C2410C]" /> Informations
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Nom complet"
            value={profile.full_name}
            onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
            required
          />
          <Input
            label="Téléphone"
            value={profile.phone}
            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            placeholder="514-555-1234"
          />
          <div className="md:col-span-2">
            <Input
              label="Email"
              type="email"
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              required
            />
          </div>
        </div>
        <button type="submit" disabled={updateMut.isPending} className="btn-primary mt-4">
          <Save className="h-4 w-4" /> {updateMut.isPending ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </form>

      {/* Password */}
      <form onSubmit={onSubmitPwd} className="card p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Lock className="h-4 w-4 text-[#C2410C]" /> Changer le mot de passe
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Mot de passe actuel" type="password"
            value={pwd.current_password}
            onChange={(e) => setPwd({ ...pwd, current_password: e.target.value })}
            required
          />
          <Input
            label="Nouveau mot de passe" type="password"
            value={pwd.new_password}
            onChange={(e) => setPwd({ ...pwd, new_password: e.target.value })}
            required hint="8 caractères minimum"
          />
          <Input
            label="Confirmation" type="password"
            value={pwd.confirm}
            onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })}
            required
          />
        </div>
        <button type="submit" disabled={pwdMut.isPending} className="btn-primary mt-4">
          {pwdMut.isPending ? '...' : 'Changer le mot de passe'}
        </button>
      </form>

      {/* Notifications */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Bell className="h-4 w-4 text-[#C2410C]" /> Notifications
        </h2>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={emailNotif}
            onChange={(e) => {
              setEmailNotif(e.target.checked)
              notifMut.mutate(e.target.checked)
            }}
            className="mt-1 rounded border-gray-300 text-[#EA580C] focus:ring-[#EA580C]"
          />
          <div>
            <p className="font-medium text-gray-900">Notifications par email</p>
            <p className="text-sm text-gray-600">
              Recevez les alertes nouveaux deals, fermetures d'enchères, paiements et introductions officielles.
            </p>
          </div>
        </label>
      </div>
    </div>
  )
}
