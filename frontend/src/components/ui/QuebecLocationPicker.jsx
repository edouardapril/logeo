import { useMemo } from 'react'
import { Select } from './Input'
import Input from './Input'
import {
  REGION_OPTIONS, mrcOptionsFor, citiesFor, ALL_CITIES_FLAT,
} from '../../utils/quebec'

/**
 * Picker hiérarchique Région → MRC → Ville.
 *
 *  Props:
 *    value: { region, mrc, city }
 *    onChange: (next) => void   — appelé à chaque changement avec l'objet complet
 *    required: bool             — marque les champs obligatoires
 *    showCity: bool             — par défaut true ; mettre à false pour filtres MRC-seulement
 *
 *  L'utilisateur peut soit :
 *    1. Cascade : sélectionner région → MRC → ville (suggérée dans le datalist)
 *    2. Saisir librement la ville (autocomplétion sur toutes les villes connues)
 *
 *  Quand la ville est saisie librement, region/mrc restent ce que l'utilisateur a choisi.
 */
export default function QuebecLocationPicker({
  value = { region: '', mrc: '', city: '' },
  onChange,
  required = false,
  showCity = true,
}) {
  const mrcs = useMemo(() => mrcOptionsFor(value.region), [value.region])
  const citySuggestions = useMemo(() => {
    const fromMrc = citiesFor(value.region, value.mrc)
    return fromMrc.length ? fromMrc : ALL_CITIES_FLAT
  }, [value.region, value.mrc])

  const set = (patch) => onChange?.({ ...value, ...patch })

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <Select
        label={`Région${required ? ' *' : ''}`}
        value={value.region || ''}
        onChange={(e) => set({ region: e.target.value, mrc: '', city: '' })}
        options={[{ value: '', label: '— Sélectionner —' }, ...REGION_OPTIONS]}
      />
      <Select
        label={`MRC${required ? ' *' : ''}`}
        value={value.mrc || ''}
        onChange={(e) => set({ mrc: e.target.value, city: '' })}
        options={[
          { value: '', label: value.region ? '— Sélectionner —' : 'Choisir une région d\'abord' },
          ...mrcs,
        ]}
      />
      {showCity && (
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">
            Ville{required ? ' *' : ''}
          </label>
          <input
            list="quebec-cities-list"
            value={value.city || ''}
            onChange={(e) => set({ city: e.target.value })}
            placeholder={citySuggestions.length ? citySuggestions[0] : 'Ville'}
            className="input-base"
          />
          <datalist id="quebec-cities-list">
            {citySuggestions.map(c => <option key={c} value={c} />)}
          </datalist>
          <p className="text-xs text-gray-500">
            Saisie libre acceptée si la ville n'est pas dans la liste.
          </p>
        </div>
      )}
    </div>
  )
}
