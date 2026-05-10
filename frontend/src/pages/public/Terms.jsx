import { Link } from 'react-router-dom'

// TODO LOTPLOT 20B : remplacer ce placeholder par le vrai texte juridique
// (CGU complets) avant la sortie public officielle. Section provisoire pour
// que le lien footer ne pointe pas vers un 404 dans la vidéo de lancement.
export default function Terms() {
  return (
    <div className="max-w-3xl mx-auto py-12">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
        Termes et conditions d'utilisation
      </h1>
      <p className="text-sm text-gray-500 mb-8">
        Version provisoire · dernière mise à jour : {new Date().toLocaleDateString('fr-CA')}
      </p>

      <div className="card p-6 bg-amber-50 border-amber-200 mb-8">
        <p className="text-sm text-amber-900">
          <strong>Document en cours de finalisation.</strong> Les termes et conditions
          complets seront publiés sous peu. Pour toute question d'ici là, contactez-nous
          à <a href="mailto:contact@logeo.ca" className="link-brand">contact@logeo.ca</a>.
        </p>
      </div>

      <div className="prose prose-sm max-w-none text-gray-700 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Préambule</h2>
        <p>
          Logeo est une marketplace immobilière dédiée aux deals off-market au Québec.
          L'utilisation de la plateforme est réservée aux courtiers OACIQ et aux acheteurs
          qualifiés résidant au Canada.
        </p>

        <h2 className="text-lg font-semibold text-gray-900">Engagements clés</h2>
        <ul className="list-disc list-inside space-y-1.5">
          <li>Tout courtier doit être membre actif de l'OACIQ.</li>
          <li>Tout acheteur doit être qualifié par l'équipe Logeo après inscription.</li>
          <li>Les NDA signés sur la plateforme sont juridiquement contraignants pour 24 mois.</li>
          <li>
            Les frais Logeo (1 % du prix final) sont payables à la signature de la promesse
            d'achat (PA) par virement Interac.
          </li>
          <li>
            Toute violation des clauses de non-contournement entraîne une pénalité de 3×
            les frais Logeo applicables.
          </li>
        </ul>

        <h2 className="text-lg font-semibold text-gray-900">Loi applicable</h2>
        <p>
          Les présentes conditions sont régies par les lois de la province de Québec, y compris
          la <strong>Loi 25</strong> sur la protection des renseignements personnels.
        </p>
      </div>

      <div className="mt-12 pt-6 border-t border-gray-200 text-xs text-gray-500">
        <Link to="/" className="link-brand">← Retour à l'accueil</Link>
      </div>
    </div>
  )
}
