/**
 * Hiérarchie administrative du Québec utilisée pour les filtres et formulaires Logeo.
 *
 * Niveaux : région administrative → MRC → ville/municipalité.
 * Liste non-exhaustive — focalisée sur les zones où Logeo a le plus d'activité
 * (multilogement, projets multifamiliaux). Toute ville absente peut être saisie en texte libre.
 */

export const QUEBEC = {
  montreal: {
    label: 'Montréal',
    mrcs: {
      agglomeration_montreal: {
        label: 'Agglomération de Montréal',
        cities: [
          'Montréal', 'Westmount', 'Mont-Royal', 'Outremont', 'Côte-Saint-Luc',
          'Hampstead', 'Montréal-Est', 'Montréal-Ouest', 'Dorval', 'Pointe-Claire',
          'Beaconsfield', 'Baie-D\'Urfé', 'Sainte-Anne-de-Bellevue', 'Senneville',
          'Kirkland', 'Dollard-des-Ormeaux',
        ],
      },
    },
  },
  laval: {
    label: 'Laval',
    mrcs: { laval: { label: 'Laval', cities: ['Laval'] } },
  },
  monteregie: {
    label: 'Montérégie',
    mrcs: {
      agglomeration_longueuil: {
        label: 'Agglomération de Longueuil',
        cities: ['Longueuil', 'Brossard', 'Boucherville', 'Saint-Bruno-de-Montarville', 'Saint-Lambert'],
      },
      la_vallee_du_richelieu: {
        label: 'La Vallée-du-Richelieu',
        cities: [
          'Mont-Saint-Hilaire', 'Beloeil', 'McMasterville', 'Otterburn Park',
          'Saint-Basile-le-Grand', 'Chambly', 'Carignan', 'Saint-Jean-Baptiste',
        ],
      },
      roussillon: {
        label: 'Roussillon',
        cities: [
          'Châteauguay', 'La Prairie', 'Candiac', 'Saint-Constant', 'Sainte-Catherine',
          'Mercier', 'Léry', 'Delson', 'Saint-Mathieu', 'Saint-Philippe',
        ],
      },
      le_haut_richelieu: {
        label: 'Le Haut-Richelieu',
        cities: ['Saint-Jean-sur-Richelieu', 'Lacolle', 'Henryville', 'Mont-Saint-Grégoire'],
      },
      la_haute_yamaska: {
        label: 'La Haute-Yamaska',
        cities: ['Granby', 'Bromont', 'Waterloo', 'Roxton Pond', 'Shefford'],
      },
      pierre_de_saurel: {
        label: 'Pierre-De Saurel',
        cities: ['Sorel-Tracy', 'Saint-Joseph-de-Sorel'],
      },
      les_maskoutains: {
        label: 'Les Maskoutains',
        cities: ['Saint-Hyacinthe'],
      },
      beauharnois_salaberry: {
        label: 'Beauharnois-Salaberry',
        cities: ['Salaberry-de-Valleyfield', 'Beauharnois', 'Sainte-Martine'],
      },
      vaudreuil_soulanges: {
        label: 'Vaudreuil-Soulanges',
        cities: [
          'Vaudreuil-Dorion', 'Hudson', 'Rigaud', 'Pincourt', 'L\'Île-Perrot',
          'Saint-Lazare', 'Saint-Polycarpe', 'Coteau-du-Lac', 'Saint-Zotique',
        ],
      },
    },
  },
  laurentides: {
    label: 'Laurentides',
    mrcs: {
      therese_de_blainville: {
        label: 'Thérèse-De Blainville',
        cities: [
          'Blainville', 'Boisbriand', 'Bois-des-Filion', 'Lorraine',
          'Rosemère', 'Sainte-Anne-des-Plaines', 'Sainte-Thérèse',
        ],
      },
      mirabel: { label: 'Mirabel', cities: ['Mirabel'] },
      la_riviere_du_nord: {
        label: 'La Rivière-du-Nord',
        cities: ['Saint-Jérôme', 'Prévost', 'Saint-Hippolyte', 'Sainte-Sophie', 'Saint-Colomban'],
      },
      les_pays_d_en_haut: {
        label: 'Les Pays-d\'en-Haut',
        cities: ['Sainte-Adèle', 'Saint-Sauveur', 'Piedmont', 'Morin-Heights', 'Estérel'],
      },
      les_laurentides: {
        label: 'Les Laurentides',
        cities: ['Sainte-Agathe-des-Monts', 'Mont-Tremblant', 'Saint-Faustin-Lac-Carré'],
      },
      argenteuil: {
        label: 'Argenteuil',
        cities: ['Lachute', 'Brownsburg-Chatham', 'Grenville', 'Saint-André-d\'Argenteuil'],
      },
    },
  },
  lanaudiere: {
    label: 'Lanaudière',
    mrcs: {
      les_moulins: { label: 'Les Moulins', cities: ['Terrebonne', 'Mascouche'] },
      l_assomption: {
        label: 'L\'Assomption',
        cities: ['Repentigny', 'L\'Assomption', 'Saint-Sulpice', 'Charlemagne', 'L\'Épiphanie'],
      },
      d_autray: { label: 'D\'Autray', cities: ['Berthierville', 'Lavaltrie', 'Lanoraie'] },
      joliette: {
        label: 'Joliette',
        cities: ['Joliette', 'Crabtree', 'Notre-Dame-des-Prairies', 'Saint-Charles-Borromée'],
      },
      matawinie: { label: 'Matawinie', cities: ['Rawdon', 'Saint-Donat', 'Chertsey'] },
      montcalm: {
        label: 'Montcalm',
        cities: ['Sainte-Julienne', 'Saint-Liguori', 'Saint-Lin-Laurentides', 'Saint-Esprit'],
      },
    },
  },
  capitale_nationale: {
    label: 'Capitale-Nationale',
    mrcs: {
      agglomeration_quebec: {
        label: 'Agglomération de Québec',
        cities: ['Québec', 'L\'Ancienne-Lorette', 'Saint-Augustin-de-Desmaures'],
      },
      la_jacques_cartier: {
        label: 'La Jacques-Cartier',
        cities: ['Stoneham-et-Tewkesbury', 'Lac-Beauport', 'Sainte-Brigitte-de-Laval', 'Shannon'],
      },
      la_cote_de_beaupre: {
        label: 'La Côte-de-Beaupré',
        cities: ['Beaupré', 'Boischatel', 'Château-Richer', 'Sainte-Anne-de-Beaupré'],
      },
      portneuf: {
        label: 'Portneuf',
        cities: ['Donnacona', 'Saint-Raymond', 'Pont-Rouge', 'Cap-Santé'],
      },
    },
  },
  chaudiere_appalaches: {
    label: 'Chaudière-Appalaches',
    mrcs: {
      levis: { label: 'Lévis', cities: ['Lévis'] },
      beauce_sartigan: {
        label: 'Beauce-Sartigan',
        cities: ['Saint-Georges', 'Notre-Dame-des-Pins'],
      },
      la_nouvelle_beauce: {
        label: 'La Nouvelle-Beauce',
        cities: ['Sainte-Marie', 'Vallée-Jonction', 'Saint-Lambert-de-Lauzon'],
      },
      lotbiniere: {
        label: 'Lotbinière',
        cities: ['Saint-Apollinaire', 'Laurier-Station', 'Saint-Antoine-de-Tilly'],
      },
    },
  },
  estrie: {
    label: 'Estrie',
    mrcs: {
      sherbrooke: { label: 'Sherbrooke', cities: ['Sherbrooke'] },
      memphremagog: {
        label: 'Memphrémagog',
        cities: ['Magog', 'Stanstead', 'Austin', 'Eastman', 'Orford'],
      },
      le_haut_saint_francois: {
        label: 'Le Haut-Saint-François',
        cities: ['East Angus', 'Cookshire-Eaton', 'Weedon'],
      },
      le_val_saint_francois: {
        label: 'Le Val-Saint-François',
        cities: ['Windsor', 'Richmond', 'Valcourt'],
      },
      coaticook: { label: 'Coaticook', cities: ['Coaticook', 'Compton', 'Waterville'] },
    },
  },
  outaouais: {
    label: 'Outaouais',
    mrcs: {
      gatineau: { label: 'Gatineau', cities: ['Gatineau'] },
      les_collines_de_l_outaouais: {
        label: 'Les Collines-de-l\'Outaouais',
        cities: ['Cantley', 'Chelsea', 'L\'Ange-Gardien', 'La Pêche', 'Pontiac', 'Val-des-Monts'],
      },
      papineau: {
        label: 'Papineau',
        cities: ['Thurso', 'Saint-André-Avellin', 'Papineauville', 'Plaisance'],
      },
    },
  },
  mauricie: {
    label: 'Mauricie',
    mrcs: {
      trois_rivieres: { label: 'Trois-Rivières', cities: ['Trois-Rivières'] },
      shawinigan:     { label: 'Shawinigan',     cities: ['Shawinigan'] },
      maskinonge:     { label: 'Maskinongé',     cities: ['Louiseville', 'Yamachiche'] },
      les_chenaux:    { label: 'Les Chenaux',    cities: ['Saint-Maurice', 'Sainte-Anne-de-la-Pérade'] },
    },
  },
  centre_du_quebec: {
    label: 'Centre-du-Québec',
    mrcs: {
      drummond: {
        label: 'Drummond',
        cities: ['Drummondville', 'Saint-Cyrille-de-Wendover', 'Wickham'],
      },
      arthabaska: {
        label: 'Arthabaska',
        cities: ['Victoriaville', 'Princeville', 'Warwick', 'Plessisville'],
      },
      becancour:        { label: 'Bécancour',        cities: ['Bécancour'] },
      nicolet_yamaska:  { label: 'Nicolet-Yamaska',  cities: ['Nicolet', 'Saint-Léonard-d\'Aston', 'Pierreville'] },
    },
  },
  saguenay_lac_saint_jean: {
    label: 'Saguenay—Lac-Saint-Jean',
    mrcs: {
      saguenay: { label: 'Saguenay', cities: ['Saguenay'] },
      lac_saint_jean_est: {
        label: 'Lac-Saint-Jean-Est',
        cities: ['Alma', 'Hébertville', 'Saint-Bruno', 'Saint-Gédéon'],
      },
      le_domaine_du_roy: {
        label: 'Le Domaine-du-Roy',
        cities: ['Roberval', 'Saint-Félicien'],
      },
    },
  },
  autre: {
    label: 'Autre région',
    mrcs: { autre: { label: 'Autre / Hors-liste', cities: [] } },
  },
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export const REGION_OPTIONS = Object.entries(QUEBEC).map(([k, v]) => ({
  value: k, label: v.label,
}))

export function mrcOptionsFor(regionKey) {
  if (!regionKey || !QUEBEC[regionKey]) return []
  return Object.entries(QUEBEC[regionKey].mrcs).map(([k, v]) => ({
    value: k, label: v.label,
  }))
}

export function citiesFor(regionKey, mrcKey) {
  if (!regionKey || !mrcKey) return []
  const region = QUEBEC[regionKey]
  if (!region) return []
  const mrc = region.mrcs[mrcKey]
  return mrc?.cities || []
}

/** Liste plate de toutes les villes connues — pour autocomplétion globale. */
export const ALL_CITIES_FLAT = (() => {
  const set = new Set()
  Object.values(QUEBEC).forEach(r => {
    Object.values(r.mrcs).forEach(m => {
      (m.cities || []).forEach(c => set.add(c))
    })
  })
  return Array.from(set).sort()
})()

/** Inverse-lookup : essaie de trouver region/mrc à partir d'un nom de ville. */
export function locateCity(cityName) {
  if (!cityName) return null
  const normalized = cityName.trim().toLowerCase()
  for (const [rKey, r] of Object.entries(QUEBEC)) {
    for (const [mKey, m] of Object.entries(r.mrcs)) {
      if ((m.cities || []).some(c => c.toLowerCase() === normalized)) {
        return { region: rKey, mrc: mKey, city: cityName.trim() }
      }
    }
  }
  return null
}

export function regionLabel(key) {
  return QUEBEC[key]?.label || key || ''
}
export function mrcLabel(regionKey, mrcKey) {
  return QUEBEC[regionKey]?.mrcs?.[mrcKey]?.label || mrcKey || ''
}
