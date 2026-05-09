import client, { uploadConfig } from './client'

export const courtierListDealsApi = () => client.get('/courtier/deals').then(r => r.data)
export const courtierGetDealApi = (dealId) => client.get(`/courtier/deals/${dealId}`).then(r => r.data)
export const submitDealApi = (data) => client.post('/courtier/deals', data).then(r => r.data)
export const uploadDocumentsApi = (dealId, formData) =>
  client.post(`/courtier/deals/${dealId}/documents`, formData, uploadConfig).then(r => r.data)
export const uploadPaApi = (dealId, formData) =>
  client.post(`/courtier/deals/${dealId}/pa`, formData, uploadConfig).then(r => r.data)

export const uploadDealPhotosApi = (dealId, files) => {
  const fd = new FormData()
  files.forEach(f => fd.append('files', f))
  return client.post(`/courtier/deals/${dealId}/photos`, fd, uploadConfig).then(r => r.data)
}

export const deleteDealPhotoApi = (dealId, path) =>
  client.delete(`/courtier/deals/${dealId}/photos`, { params: { path } }).then(r => r.data)

export const setTeaserSelectionApi = (dealId, payload) =>
  client.patch(`/courtier/deals/${dealId}/teaser-selection`, payload).then(r => r.data)

export const patchDealApi = (dealId, payload) =>
  client.patch(`/courtier/deals/${dealId}`, payload).then(r => r.data)

export const uploadInspectionReportApi = (dealId, file) => {
  const fd = new FormData()
  fd.append('file', file)
  return client.post(`/courtier/deals/${dealId}/inspection-report`, fd, uploadConfig).then(r => r.data)
}

// Units (logements)
export const listUnitsApi = (dealId) =>
  client.get(`/courtier/deals/${dealId}/units`).then(r => r.data)
export const createUnitApi = (dealId, payload) =>
  client.post(`/courtier/deals/${dealId}/units`, payload).then(r => r.data)
export const updateUnitApi = (dealId, unitId, payload) =>
  client.patch(`/courtier/deals/${dealId}/units/${unitId}`, payload).then(r => r.data)
export const deleteUnitApi = (dealId, unitId) =>
  client.delete(`/courtier/deals/${dealId}/units/${unitId}`).then(r => r.data)
export const uploadUnitPhotosApi = (dealId, unitId, files) => {
  const fd = new FormData()
  files.forEach(f => fd.append('files', f))
  return client.post(`/courtier/deals/${dealId}/units/${unitId}/photos`, fd, uploadConfig).then(r => r.data)
}
export const uploadUnitLeaseApi = (dealId, unitId, file) => {
  const fd = new FormData()
  fd.append('file', file)
  return client.post(`/courtier/deals/${dealId}/units/${unitId}/lease`, fd, uploadConfig).then(r => r.data)
}

// FAQ courtier
export const courtierListQuestionsApi = (dealId) =>
  client.get(`/courtier/deals/${dealId}/questions`).then(r => r.data)
export const answerQuestionApi = (dealId, questionId, answer) =>
  client.post(`/courtier/deals/${dealId}/questions/${questionId}/answer`, { answer }).then(r => r.data)

// Relance d'une nouvelle ronde (sprint final item 4)
export const restartRoundApi = (dealId) =>
  client.post(`/courtier/deals/${dealId}/restart-round`).then(r => r.data)

// Sprint UX item 5 — vision 360 par deal
export const courtierListDealsEnrichedApi = () =>
  client.get('/courtier/deals/enriched').then(r => r.data)

// Dashboard sommaire courtier — KPIs + deals en cours
export const courtierDashboardApi = () =>
  client.get('/courtier/dashboard').then(r => r.data)
