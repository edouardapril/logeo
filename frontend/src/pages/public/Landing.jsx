import { Link } from 'react-router-dom'
import { ArrowRight, Building2, ShieldCheck, Trophy } from 'lucide-react'
import Logo from '../../components/ui/Logo'
import { useAuth } from '../../contexts/AuthContext'

export default function Landing() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-white">
      {/* Header simple */}
      <header className="border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo size="md" />
          <nav className="flex items-center gap-3 text-sm">
            <Link to="/leaderboard" className="text-gray-700 hover:text-[#EA580C] font-medium">
              Leaderboard
            </Link>
            <Link to="/marketplace" className="text-gray-700 hover:text-[#EA580C] font-medium">
              Marketplace
            </Link>
            {user ? (
              <Link to="/" className="btn-primary text-sm">Mon espace</Link>
            ) : (
              <Link to="/login" className="btn-secondary text-sm">Se connecter</Link>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 py-20 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-xs uppercase tracking-widest text-[#C2410C] font-semibold mb-3">
              Marketplace immobilière off-market · Québec
            </p>
            <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 leading-tight mb-5">
              Logeo : enchères<br />
              <span className="text-[#EA580C]">multilogements</span><br />
              entre courtiers OACIQ et investisseurs qualifiés.
            </h1>
            <p className="text-lg text-gray-600 mb-8 leading-relaxed">
              Découvrez des opportunités exclusives — multiplex, projets, terrains constructibles —
              avec enchères anonymes, NDA légaux, paiements Stripe sécurisés.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/marketplace" className="btn-primary">
                Voir les enchères en cours <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/register/acheteur" className="btn-secondary">
                S'inscrire comme acheteur
              </Link>
              <Link to="/register/courtier" className="btn-secondary">
                Inscription courtier OACIQ
              </Link>
            </div>
            <p className="text-xs text-gray-500 mt-6">
              Déjà un compte ? <Link to="/login" className="link-brand font-medium">Se connecter</Link>
            </p>
          </div>

          {/* Bento mosaic */}
          <div className="grid grid-cols-2 gap-4">
            <div className="card p-5 col-span-2 bg-[#FFEDD5] border-[#FDBA74]">
              <Trophy className="h-6 w-6 text-[#C2410C] mb-2" />
              <p className="font-bold text-[#9A3412]">Enchères temps réel</p>
              <p className="text-sm text-[#9A3412]/80 mt-1">
                Timer dramatique, anti-snipe +10 min, fil d'activité live, prix proxy bid.
              </p>
            </div>
            <div className="card p-5 bg-white">
              <ShieldCheck className="h-6 w-6 text-emerald-600 mb-2" />
              <p className="font-bold text-gray-900 text-sm">Courtiers OACIQ</p>
              <p className="text-xs text-gray-600 mt-1">Convention juridique, prix plancher contraignant</p>
            </div>
            <div className="card p-5 bg-white">
              <Building2 className="h-6 w-6 text-[#EA580C] mb-2" />
              <p className="font-bold text-gray-900 text-sm">Multilogement</p>
              <p className="text-xs text-gray-600 mt-1">2-6, 7-24, 24+ logements, projets, terrains à plex</p>
            </div>
          </div>
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Comment ça marche</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { n: '1', t: 'Le courtier soumet', d: 'Documents complets, prix plancher, photos, données financières.' },
              { n: '2', t: 'Logeo analyse et publie', d: 'Verdict admin, enchère ouverte 10 jours aux acheteurs qualifiés.' },
              { n: '3', t: 'Enchères proxy bid', d: 'Prix affiché = 2e + 10k. Paiements Stripe automatiques au gagnant.' },
            ].map(s => (
              <div key={s.n} className="card p-6">
                <span className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-[#FFEDD5] text-[#C2410C] font-bold mb-3">
                  {s.n}
                </span>
                <p className="font-semibold text-gray-900 mb-1">{s.t}</p>
                <p className="text-sm text-gray-600">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA bottom */}
      <section className="py-16 bg-[#1A1A1A] text-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-3">Prêt à enchérir ?</h2>
          <p className="text-white/70 mb-6">
            Inscription gratuite. Qualification sous 24h.
          </p>
          <div className="flex justify-center gap-3 flex-wrap">
            <Link to="/marketplace" className="btn-primary">
              Voir les enchères <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/register/acheteur" className="px-4 py-2.5 rounded-lg border border-white/30 text-white hover:bg-white/10 text-sm font-semibold">
              S'inscrire comme acheteur
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-200 py-6 text-center text-xs text-gray-500">
        © Logeo · Plateforme immobilière off-market au Québec ·{' '}
        <Link to="/leaderboard" className="hover:text-[#EA580C]">Leaderboard</Link>
      </footer>
    </div>
  )
}
