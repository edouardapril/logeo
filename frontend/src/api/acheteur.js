import client from './client'

export const listDealsApi = () => client.get('/acheteur/deals').then(r => r.data)
export const getDealTeaserApi = (dealId) => client.get(`/acheteur/deals/${dealId}`).then(r => r.data)
export const getDealFullApi = (dealId) => client.get(`/acheteur/deals/${dealId}/full`).then(r => r.data)
export const signNdaApi = (dealId) => client.post(`/acheteur/deals/${dealId}/nda`, { accepted: true }).then(r => r.data)
export const signEngagementApi = (dealId) =>
  client.post(`/acheteur/deals/${dealId}/engagement`, { accepted: true }).then(r => r.data)
export const placeBidApi = (dealId, amount) =>
  client.post(`/acheteur/deals/${dealId}/bids`, { amount }).then(r => r.data)
export const myBidsApi = (dealId) => client.get(`/acheteur/deals/${dealId}/bids/mine`).then(r => r.data)
export const bidRankingApi = (dealId) => client.get(`/acheteur/deals/${dealId}/bids/ranking`).then(r => r.data)
