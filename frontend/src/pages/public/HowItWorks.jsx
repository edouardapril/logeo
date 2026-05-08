import { Link } from 'react-router-dom'
import {
  Building2, TrendingUp, ShieldCheck, Trophy, FileText, ArrowRight,
  CheckCircle2, Lock, Coins, MapPin, Clock,
} from 'lucide-react'

const COURTIER_STEPS = [
  { icon: FileText, title: 'Soumettez votre deal off-market',
    body: "Documents complets, photos, données financières, prix plancher. La fiche est confidentielle jusqu'à publication." },
  { icon: ShieldCheck, title: 'Logeo analyse et publie en 48h',
    body: "L'équipe Logeo vérifie l'éligibilité, valide les documents, fixe les frais et donne le verdict GO ou NO GO." },
  { icon: Trophy, title: '10 jours d\'enchères anonymes',
    body: "Les acheteurs qualifiés signent le NDA, posent des questions, enchérissent en proxy bid. Anti-snipe +10 min." },
  { icon: CheckCircle2, title: 'Introduction officielle + paiement automatique',
    body: "Le gagnant paye par Stripe (dépôt 25 % puis solde 75 %). Logeo vous met en contact pour la signature de la PA." },
]

const ACHETEUR_STEPS = [
  { icon: TrendingUp, title: 'Inscrivez-vous et qualifiez-vous',
    body: "Inscription gratuite. L'équipe Logeo qualifie votre profil sous 24h (revenus, expérience d'investissement)." },
  { icon: Lock, title: 'Accédez aux deals exclusifs off-market',
    body: "Marketplace de multilogements partout au Québec. Le NDA donne accès au dossier complet (adresse, baux, financiers)." },
  { icon: Trophy, title: 'Enchérissez anonymement (proxy bid)',
    body: "Vous fixez votre maximum. Le système enchérit pour vous à l'incrément +5 000 $ jusqu'à votre plafond. Aucun nom ni montant n'est public." },
  { icon: Coins, title: 'Gagnez et complétez votre due diligence',
    body: "Si gagnant, dépôt 25 % débité automatiquement. 5 jours pour confirmer la due diligence puis solde 75 %. Logeo gère le reste." },
]

const FAQ = [
  {
    q: "Comment fonctionne le proxy bid ?",
    a: "Vous indiquez votre offre maximum. Le système enchérit pour vous, à l'incrément minimum (5 000 $), jusqu'à concurrencer le bidder le plus haut. Le prix affiché public n'est jamais votre maximum — c'est seulement le 2ᵉ plus haut max + 5 000 $.",
  },
  {
    q: "Qu'est-ce que le prix plancher ?",
    a: "C'est le prix minimum auquel le vendeur s'engage à vendre. Visible publiquement dès la mise en ligne. Tout courtier qui refuse une offre gagnante au-dessus du plancher s'expose à une pénalité de 3× les frais Logeo et à l'expulsion permanente de la plateforme.",
  },
  {
    q: "Quels types de propriétés sont acceptés ?",
    a: "Logeo accepte 5 catégories : Terrain, Résidentiel, Petit Plex (2 à 5 logements), Multilogement (6-24 logements), Multilogement (+24 logements). Pas d'unifamilial ni de condo personnel.",
  },
  {
    q: "Comment sont protégés mes paiements ?",
    a: "Tous les paiements transitent par Stripe (PCI-DSS niveau 1). Vos numéros de carte ne touchent jamais nos serveurs. Le dépôt 25 % est encaissé à la fermeture de l'enchère ; le solde 75 % seulement après confirmation de votre due diligence.",
  },
  {
    q: "Que se passe-t-il si je me désiste après avoir gagné ?",
    a: "Le dépôt 25 % (minimum 2 500 $) est conservé par Logeo et le deal est attribué automatiquement au 2ᵉ offrant. Vous recevez aussi une sanction visible sur votre profil public.",
  },
  {
    q: "Anti-snipe — c'est quoi ?",
    a: "Si une enchère est placée dans les 10 dernières minutes avant la fermeture, le timer est automatiquement prolongé de 10 minutes. Les enchères durent ainsi le temps qu'il faut pour qu'une vraie surenchère soit possible.",
  },
]

function StepCard({ step, idx }) {
  const Icon = step.icon
  return (
    <div className="card p-6">
      <div className="flex items-center gap-3 mb-3">
        <span className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-[#FFEDD5] text-[#C2410C] font-bold">
          {idx + 1}
        </span>
        <Icon className="h-5 w-5 text-[#C2410C]" />
      </div>
      <p className="font-semibold text-gray-900 mb-1">{step.title}</p>
      <p className="text-sm text-gray-600 leading-relaxed">{step.body}</p>
    </div>
  )
}

export default function HowItWorks() {
  return (
    <div className="space-y-16">
      <section>
        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-3">
          Comment ça marche ?
        </h1>
        <p className="text-lg text-gray-600 max-w-3xl">
          Logeo est une marketplace immobilière off-market au Québec dédiée aux multilogements.
          Voici comment courtiers OACIQ et investisseurs qualifiés se rencontrent en toute sécurité.
        </p>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-6">
          <Building2 className="h-6 w-6 text-[#EA580C]" />
          <h2 className="text-2xl font-bold text-gray-900">Pour les courtiers OACIQ</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {COURTIER_STEPS.map((s, i) => <StepCard key={i} step={s} idx={i} />)}
        </div>
        <div className="mt-6 text-center">
          <Link to="/register/courtier" className="btn-primary">
            Inscription courtier <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="h-6 w-6 text-[#EA580C]" />
          <h2 className="text-2xl font-bold text-gray-900">Pour les acheteurs investisseurs</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {ACHETEUR_STEPS.map((s, i) => <StepCard key={i} step={s} idx={i} />)}
        </div>
        <div className="mt-6 text-center">
          <Link to="/register/acheteur" className="btn-primary">
            Inscription acheteur <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Questions fréquentes</h2>
        <div className="space-y-3">
          {FAQ.map((item, i) => (
            <details key={i} className="card p-5 group cursor-pointer">
              <summary className="font-semibold text-gray-900 list-none flex items-center justify-between gap-3">
                <span>{item.q}</span>
                <span className="text-[#EA580C] text-xl transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="text-sm text-gray-700 mt-3 leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="card p-8 bg-[#1A1A1A] text-white text-center">
        <h2 className="text-2xl font-bold mb-3">Prêt à participer ?</h2>
        <p className="text-white/70 mb-6 max-w-xl mx-auto">
          Inscription gratuite. Qualification sous 24h. Aucun engagement.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/marketplace" className="btn-primary">
            Voir les enchères <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/register/acheteur"
            className="px-4 py-2.5 rounded-lg border border-white/30 text-white hover:bg-white/10 text-sm font-semibold"
          >
            S'inscrire comme acheteur
          </Link>
          <Link
            to="/register/courtier"
            className="px-4 py-2.5 rounded-lg border border-white/30 text-white hover:bg-white/10 text-sm font-semibold"
          >
            Inscription courtier OACIQ
          </Link>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-center gap-6 text-xs text-gray-500 flex-wrap">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> Tout le Québec
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Enchères 10 jours
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> Loi 25 conforme
          </span>
        </div>
      </section>
    </div>
  )
}
