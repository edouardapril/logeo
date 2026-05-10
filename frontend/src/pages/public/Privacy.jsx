import { Link } from 'react-router-dom'

// TODO LOTPLOT 20B : remplacer ce placeholder par la vraie politique de
// confidentialité validée par un avocat (Loi 25 — Québec). Section provisoire
// pour que le lien footer ne pointe pas vers un 404 dans la vidéo de lancement.
export default function Privacy() {
  return (
    <div className="max-w-3xl mx-auto py-12">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
        Politique de confidentialité
      </h1>
      <p className="text-sm text-gray-500 mb-8">
        Version provisoire · dernière mise à jour : {new Date().toLocaleDateString('fr-CA')}
      </p>

      <div className="card p-6 bg-amber-50 border-amber-200 mb-8">
        <p className="text-sm text-amber-900">
          <strong>Document en cours de finalisation.</strong> La politique de confidentialité
          complète (Loi 25 — Québec) sera publiée sous peu. Pour toute question d'ici là,
          contactez-nous à <a href="mailto:contact@logeo.ca" className="link-brand">contact@logeo.ca</a>.
        </p>
      </div>

      <div className="prose prose-sm max-w-none text-gray-700 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Données collectées</h2>
        <p>
          Lors de l'inscription, Logeo collecte : nom, adresse email, téléphone, et — pour
          les courtiers — numéro de licence OACIQ et nom d'agence. Ces données sont stockées
          de manière sécurisée et ne sont jamais revendues à des tiers.
        </p>

        <h2 className="text-lg font-semibold text-gray-900">Données légales</h2>
        <p>
          Lors de la signature d'un NDA ou du placement d'une offre, l'adresse IP, l'agent
          utilisateur et l'horodatage sont enregistrés à titre de preuve légale (Loi 25 du
          Québec). Ces données ne sont accessibles qu'à l'équipe Logeo et aux autorités si
          requis par la loi.
        </p>

        <h2 className="text-lg font-semibold text-gray-900">Paiements</h2>
        <p>
          Les paiements (frais Logeo) transitent par <strong>virement Interac</strong>.
          Aucun numéro de carte n'est stocké sur nos serveurs.
        </p>

        <h2 className="text-lg font-semibold text-gray-900">Vos droits (Loi 25)</h2>
        <ul className="list-disc list-inside space-y-1.5">
          <li>Droit d'accès aux renseignements personnels que nous détenons sur vous.</li>
          <li>Droit de rectification des données inexactes.</li>
          <li>Droit à l'effacement de votre compte (dans les limites légales d'audit).</li>
          <li>
            Droit à la portabilité — demande à
            <a href="mailto:contact@logeo.ca" className="link-brand"> contact@logeo.ca</a>.
          </li>
        </ul>
      </div>

      <div className="mt-12 pt-6 border-t border-gray-200 text-xs text-gray-500">
        <Link to="/" className="link-brand">← Retour à l'accueil</Link>
      </div>
    </div>
  )
}
