import client from './client'

export const publicAcheteurApi = (id) =>
  client.get(`/public/acheteur/${id}`).then(r => r.data)

export const publicCourtierApi = (id) =>
  client.get(`/public/courtier/${id}`).then(r => r.data)

export const leaderboardApi = (limit = 10) =>
  client.get('/public/leaderboard', { params: { limit } }).then(r => r.data)

export const publicMarketplaceApi = (params = {}) =>
  client.get('/public/marketplace', { params }).then(r => r.data)

export const publicDealApi = (id) =>
  client.get(`/public/deals/${id}`).then(r => r.data)

export const publicDealQuestionsApi = (id) =>
  client.get(`/public/deals/${id}/questions`).then(r => r.data)

// LOTPLOT 21 — sample deal accessible sans login (404 si pas seedé)
export const publicSampleDealApi = () =>
  client.get('/public/sample-deal').then(r => r.data)
