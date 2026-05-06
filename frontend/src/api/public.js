import client from './client'

export const publicAcheteurApi = (id) =>
  client.get(`/public/acheteur/${id}`).then(r => r.data)

export const publicCourtierApi = (id) =>
  client.get(`/public/courtier/${id}`).then(r => r.data)

export const leaderboardApi = (limit = 10) =>
  client.get('/public/leaderboard', { params: { limit } }).then(r => r.data)

export const publicMarketplaceApi = (params = {}) =>
  client.get('/public/marketplace', { params }).then(r => r.data)
