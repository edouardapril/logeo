/**
 * Formate au fur et à mesure de la frappe vers (xxx) xxx-xxxx.
 * Accepte les chiffres + +1 préfixé, ignore le reste.
 */
export function formatPhoneCA(value) {
  if (!value) return ''
  // Garde les chiffres uniquement
  let digits = String(value).replace(/\D/g, '')
  // Drop le préfixe "1" canadien
  if (digits.startsWith('1') && digits.length > 10) digits = digits.slice(1)
  digits = digits.slice(0, 10)
  if (digits.length === 0) return ''
  if (digits.length <= 3)  return `(${digits}`
  if (digits.length <= 6)  return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

export function isValidCAPhone(value) {
  const digits = String(value || '').replace(/\D/g, '').replace(/^1/, '')
  return digits.length === 10
}
