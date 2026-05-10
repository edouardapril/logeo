// LOTPLOT 23 — Templates d'emails preview pour le walkthrough.
// Volontairement HTML inline simple (pas d'images externes pour rester
// fonctionnel offline). Les emails sont rendus via dangerouslySetInnerHTML
// dans EmailPreviewSidebar — le contenu vient d'ici, donc safe.

const FROM_LOGEO = 'L\'équipe Logeo <noreply@logeo.ca>'
const BRAND_HEADER = `
  <div style="background:#EA580C;color:white;padding:14px 18px;border-radius:8px 8px 0 0;font-weight:700;font-size:15px;">
    Logeo · Marketplace immobilière off-market
  </div>
`
const SIGNATURE = `
  <p style="margin-top:18px;color:#666;font-size:12px;">
    L'équipe Logeo · <a href="mailto:contact@logeo.ca" style="color:#EA580C;">contact@logeo.ca</a><br>
    <em>Email envoyé en mode démo — pas de vraie transaction.</em>
  </p>
`

function wrap(bodyInner) {
  return `
    <div style="max-width:560px;font-family:-apple-system,system-ui,sans-serif;">
      ${BRAND_HEADER}
      <div style="padding:18px;background:white;border:1px solid #f0f0f0;border-top:none;border-radius:0 0 8px 8px;">
        ${bodyInner}
        ${SIGNATURE}
      </div>
    </div>
  `
}

// ── ACHETEUR ────────────────────────────────────────────────────────────────

export const ACHETEUR_EMAILS = {
  nda_signed: {
    type: 'nda_signed',
    from: FROM_LOGEO,
    subject: 'NDA signé · accès au dossier complet',
    body_html: wrap(`
      <h2 style="color:#9A3412;font-size:18px;">NDA signé avec succès</h2>
      <p>Bonjour,</p>
      <p>Votre NDA pour le deal <strong>Multilogement à Saint-Constant</strong> a été enregistré et horodaté (preuve légale Loi 25).</p>
      <p>Vous avez maintenant accès au dossier complet : adresse exacte, coordonnées du courtier, baux détaillés, photos privées.</p>
      <p style="background:#FFEDD5;padding:10px;border-radius:6px;font-size:13px;">
        <strong>Engagement de non-contournement :</strong> 24 mois.
        Pénalité d'infraction : 3× les frais Logeo applicables.
      </p>
    `),
  },
  bid_placed: {
    type: 'bid_placed',
    from: FROM_LOGEO,
    subject: 'Enchère placée · vous êtes en tête',
    body_html: wrap(`
      <h2 style="color:#9A3412;font-size:18px;">Enchère reçue</h2>
      <p>Votre offre maximale de <strong>850 000 $</strong> a été enregistrée.</p>
      <p>Le prix affiché publiquement est de <strong>805 000 $</strong> — votre maximum reste privé.</p>
      <p>Vous serez notifié si un autre acheteur surenchérit.</p>
    `),
  },
  outbid: {
    type: 'outbid',
    from: FROM_LOGEO,
    subject: '⚡ Vous avez été dépassé',
    body_html: wrap(`
      <h2 style="color:#9A3412;font-size:18px;">Un autre acheteur a surenchéri</h2>
      <p>Votre offre de <strong>850 000 $</strong> n'est plus la plus haute. Le prix actuel est de <strong>875 000 $</strong>.</p>
      <p>Pour reprendre la tête, augmentez votre maximum dans la fiche du deal.</p>
      <a href="#" style="display:inline-block;margin-top:8px;padding:10px 16px;background:#EA580C;color:white;text-decoration:none;border-radius:6px;font-weight:600;">
        Surenchérir maintenant →
      </a>
    `),
  },
  won: {
    type: 'won',
    from: FROM_LOGEO,
    subject: '🏆 Vous avez remporté l\'enchère',
    body_html: wrap(`
      <h2 style="color:#9A3412;font-size:18px;">Félicitations !</h2>
      <p>Vous êtes le gagnant de l'enchère pour le deal <strong>Multilogement Saint-Constant</strong>.</p>
      <ul>
        <li><strong>Prix final :</strong> 920 000 $ CAD</li>
        <li><strong>Frais Logeo (1 %) :</strong> 9 200 $ CAD</li>
      </ul>
      <h3 style="color:#9A3412;font-size:15px;">Période de due diligence — 5 jours</h3>
      <p>Vous avez 5 jours pour finaliser votre due diligence (inspection, vérifications, financement) puis confirmer la procédure.</p>
      <p>Aucun débit n'a lieu à ce stade. Les frais Logeo sont payables par virement Interac à la signature de la PA.</p>
    `),
  },
  dd_confirmed: {
    type: 'dd_confirmed',
    from: FROM_LOGEO,
    subject: 'Procédure confirmée · introduction au courtier en cours',
    body_html: wrap(`
      <h2 style="color:#9A3412;font-size:18px;">Due diligence confirmée</h2>
      <p>Vous avez confirmé procéder. La promesse d'achat (PA) sera maintenant rédigée et signée hors plateforme avec le courtier.</p>
      <p>Vous serez notifié dès que la PA est signée pour recevoir les instructions de paiement Interac.</p>
    `),
  },
  interac_instructions: {
    type: 'interac_instructions',
    from: FROM_LOGEO,
    subject: 'PA signée · instructions de paiement Interac',
    body_html: wrap(`
      <h2 style="color:#9A3412;font-size:18px;">Instructions Interac</h2>
      <p>La promesse d'achat est signée. Reste à régler les frais Logeo (1 % du prix final).</p>
      <ul style="line-height:1.8;">
        <li><strong>Montant :</strong> 9 200 $ CAD</li>
        <li><strong>Destinataire :</strong> paiements@logeo.ca</li>
        <li><strong>Référence :</strong> LOGEO-EXEMPLE</li>
      </ul>
      <p style="font-size:13px;color:#666;">Une fois le virement reçu, l'admin Logeo le confirmera et le deal sera marqué finalisé.</p>
    `),
  },
  payment_confirmed: {
    type: 'payment_confirmed',
    from: FROM_LOGEO,
    subject: '✓ Paiement reçu · deal finalisé',
    body_html: wrap(`
      <h2 style="color:#9A3412;font-size:18px;">Paiement confirmé</h2>
      <p>Nous avons reçu votre virement de <strong>9 200 $ CAD</strong>.</p>
      <p>Le deal est officiellement finalisé. Bonne continuation avec votre acquisition !</p>
    `),
  },
}

// ── COURTIER ────────────────────────────────────────────────────────────────

export const COURTIER_EMAILS = {
  submission_received: {
    type: 'submission_received',
    from: FROM_LOGEO,
    subject: 'Soumission reçue · en analyse par Logeo',
    body_html: wrap(`
      <h2 style="color:#9A3412;font-size:18px;">Votre deal est en analyse</h2>
      <p>Bonjour,</p>
      <p>Nous avons bien reçu votre soumission pour le deal <strong>Multilogement à Saint-Constant</strong>.</p>
      <p>L'équipe Logeo l'analyse actuellement (vérification financière, validation marché, évaluation des risques). Vous recevrez un verdict <strong>GO</strong> ou <strong>NO GO</strong> sous 48 h.</p>
    `),
  },
  verdict_go: {
    type: 'verdict_go',
    from: FROM_LOGEO,
    subject: '🎉 Verdict GO · votre deal est publié',
    body_html: wrap(`
      <h2 style="color:#9A3412;font-size:18px;">Verdict : GO</h2>
      <p>Votre deal est validé et publié sur la marketplace. L'enchère est ouverte pour <strong>10 jours</strong>.</p>
      <p>Pendant cette période :</p>
      <ul>
        <li>Les acheteurs qualifiés signent un NDA pour accéder à votre dossier complet.</li>
        <li>Ils placent leurs enchères en proxy bidding (mises maximales privées).</li>
        <li>Vous recevez chaque jour un résumé d'activité par email.</li>
      </ul>
    `),
  },
  ndas_summary: {
    type: 'ndas_summary',
    from: FROM_LOGEO,
    subject: 'Activité de votre deal · 5 acheteurs intéressés',
    body_html: wrap(`
      <h2 style="color:#9A3412;font-size:18px;">5 NDA signés sur votre deal</h2>
      <p>5 acheteurs qualifiés ont signé le NDA et consultent actuellement le dossier complet.</p>
      <p>Les premières enchères devraient arriver dans les prochaines heures.</p>
    `),
  },
  auction_closed_with_winner: {
    type: 'auction_closed',
    from: FROM_LOGEO,
    subject: '✓ Enchère terminée · gagnant identifié',
    body_html: wrap(`
      <h2 style="color:#9A3412;font-size:18px;">L'enchère est fermée</h2>
      <p>Bilan de votre enchère :</p>
      <ul>
        <li><strong>Prix final :</strong> 920 000 $ CAD</li>
        <li><strong>Acheteurs qualifiés ayant signé un NDA :</strong> 5</li>
        <li><strong>Enchères placées :</strong> 7</li>
      </ul>
      <p>Le gagnant entre maintenant en période de due diligence (5 jours).</p>
    `),
  },
  introduction_winner: {
    type: 'introduction_winner',
    from: FROM_LOGEO,
    subject: 'Introduction officielle · coordonnées du gagnant',
    body_html: wrap(`
      <h2 style="color:#9A3412;font-size:18px;">Introduction au gagnant</h2>
      <p>Voici les coordonnées de l'acheteur retenu :</p>
      <ul>
        <li><strong>Nom :</strong> Acheteur Démo</li>
        <li><strong>Email :</strong> demo-acheteur@logeo.ca</li>
        <li><strong>Téléphone :</strong> 514-555-0199</li>
      </ul>
      <p>Vous pouvez le contacter directement pour organiser la visite et préparer la promesse d'achat.</p>
    `),
  },
  pa_signed: {
    type: 'pa_signed',
    from: FROM_LOGEO,
    subject: 'PA signée confirmée · acheteur notifié pour le paiement',
    body_html: wrap(`
      <h2 style="color:#9A3412;font-size:18px;">PA signée — étape suivante</h2>
      <p>Vous avez confirmé que la promesse d'achat est signée. L'acheteur vient de recevoir les instructions de paiement Interac (1 % du prix final = <strong>9 200 $</strong>).</p>
      <p>Logeo confirmera la réception du virement, après quoi le deal sera marqué finalisé.</p>
    `),
  },
  deal_finalized: {
    type: 'deal_finalized',
    from: FROM_LOGEO,
    subject: '🎯 Deal finalisé · félicitations',
    body_html: wrap(`
      <h2 style="color:#9A3412;font-size:18px;">Votre deal off-market est conclu</h2>
      <p>Le paiement de l'acheteur a été reçu. Le deal est officiellement finalisé.</p>
      <p style="background:#FFEDD5;padding:10px;border-radius:6px;">
        <strong>Bilan :</strong> de la soumission à la finalisation, moins de deux semaines.
      </p>
      <p>Merci pour votre confiance — à très vite pour le prochain deal !</p>
    `),
  },
}
