import client from './client'

export const courtierListDealsApi = () => client.get('/courtier/deals').then(r => r.data)
export const courtierGetDealApi = (dealId) => client.get(`/courtier/deals/${dealId}`).then(r => r.data)
export const submitDealApi = (data) => client.post('/courtier/deals', data).then(r => r.data)
export const uploadDocumentsApi = (dealId, formData) =>
  client.post(`/courtier/deals/${dealId}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
export const uploadPaApi = (dealId, formData) =>
  client.post(`/courtier/deals/${dealId}/pa`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
