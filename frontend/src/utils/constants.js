export const PROPERTY_TYPES = [
  { value: 'multilogement_2_6', label: 'Multilogement 2-6 logements' },
  { value: 'multilogement_7_24', label: 'Multilogement 7-24 logements' },
  { value: 'projet_24_plus', label: 'Projet 24+ logements' },
  { value: 'terrain_constructible', label: 'Terrain constructible' },
  { value: 'residentiel_plex', label: 'Résidentiel pour ériger un plex' },
]

// Inclus aussi les anciennes valeurs pour rester lisible sur les deals legacy
export const PROPERTY_TYPE_LABELS = {
  multilogement_2_6: 'Multilogement 2-6',
  multilogement_7_24: 'Multilogement 7-24',
  projet_24_plus: 'Projet 24+',
  terrain_constructible: 'Terrain constructible',
  residentiel_plex: 'Résidentiel à plex',
  multiplex: 'Multiplex',
  commercial: 'Commercial',
  mixte: 'Mixte',
  industriel: 'Industriel',
  terrain: 'Terrain',
}

export const REGIONS = [
  { value: '',          label: 'Toutes les régions' },
  { value: 'montreal',  label: 'Montréal' },
  { value: 'laval',     label: 'Laval' },
  { value: 'rive_sud',  label: 'Rive-Sud' },
  { value: 'rive_nord', label: 'Rive-Nord' },
  { value: 'quebec',    label: 'Québec' },
  { value: 'autre',     label: 'Autre' },
]

/**
 * Mapping code postal canadien (préfixe) → région.
 * H = Île de Montréal et Laval. On distingue H7 = Laval, le reste H = Montréal.
 * J = banlieues (Rive-Sud / Rive-Nord), G = Québec et Est.
 * Source : codes FSA Postes Canada (premier caractère + chiffre).
 */
export function regionFromPostalCode(pc) {
  if (!pc) return null
  const code = String(pc).replace(/\s/g, '').toUpperCase()
  if (!code) return null
  const c0 = code[0]
  const c1 = code[1] || ''

  if (c0 === 'H') return c1 === '7' ? 'laval' : 'montreal'
  if (c0 === 'J') {
    // J3, J4, J5 → Rive-Sud (Longueuil, Brossard, Chambly...)
    // J6 → Rive-Sud (St-Hyacinthe, sud)
    // J7 → Rive-Nord (Mirabel, Saint-Eustache, Boisbriand)
    // J8, J9 → Outaouais (autre)
    // J0 → mixte ; on classe en "autre"
    if ('345'.includes(c1)) return 'rive_sud'
    if (c1 === '6') return 'rive_sud'
    if (c1 === '7') return 'rive_nord'
    return 'autre'
  }
  if (c0 === 'G') return 'quebec'
  return 'autre'
}

const CITY_REGION_HINTS = {
  'montréal': 'montreal', 'montreal': 'montreal', 'mtl': 'montreal',
  'laval': 'laval',
  'longueuil': 'rive_sud', 'brossard': 'rive_sud', 'st-lambert': 'rive_sud',
  'saint-lambert': 'rive_sud', 'chambly': 'rive_sud', 'boucherville': 'rive_sud',
  'st-bruno': 'rive_sud', 'saint-bruno': 'rive_sud', 'saint-hubert': 'rive_sud',
  'st-hubert': 'rive_sud',
  'mirabel': 'rive_nord', 'st-eustache': 'rive_nord', 'saint-eustache': 'rive_nord',
  'boisbriand': 'rive_nord', 'rosemère': 'rive_nord', 'rosemere': 'rive_nord',
  'blainville': 'rive_nord', 'terrebonne': 'rive_nord', 'st-jérôme': 'rive_nord',
  'saint-jerome': 'rive_nord', 'saint-jérôme': 'rive_nord',
  'québec': 'quebec', 'quebec': 'quebec', 'lévis': 'quebec', 'levis': 'quebec',
}

// Mapping nouvelle hiérarchie Québec → 6-région simplifiées du DealList
const QUEBEC_REGION_TO_SIMPLIFIED = {
  montreal: 'montreal',
  laval: 'laval',
  monteregie: 'rive_sud',
  laurentides: 'rive_nord',
  lanaudiere: 'rive_nord',
  capitale_nationale: 'quebec',
  chaudiere_appalaches: 'quebec',
}

export function regionFromDeal(deal) {
  // Priorité 1 : champ explicite `deal.region` (saisi par le courtier — sprint final)
  if (deal.region && QUEBEC_REGION_TO_SIMPLIFIED[deal.region]) {
    return QUEBEC_REGION_TO_SIMPLIFIED[deal.region]
  }
  if (deal.region) return 'autre'

  // Priorité 2 : code postal
  const fromPC = regionFromPostalCode(deal.postal_code)
  if (fromPC) return fromPC

  // Priorité 3 : nom de ville
  const city = String(deal.city || '').trim().toLowerCase()
  return CITY_REGION_HINTS[city] || 'autre'
}
