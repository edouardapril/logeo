import client from './client'

export const listDealsApi = (params = {}) =>
  client.get('/acheteur/deals', { params }).then(r => r.data)
export const listActiveRegionsApi = () =>
  client.get('/acheteur/deals/regions').then(r => r.data)
export const getDealTeaserApi = (dealId) => client.get(`/acheteur/deals/${dealId}`).then(r => r.data)
export const getDealFullApi = (dealId) => client.get(`/acheteur/deals/${dealId}/full`).then(r => r.data)
export const signNdaApi = (dealId, consents) =>
  client.post(`/acheteur/deals/${dealId}/nda`, { accepted: true, ...consents }).then(r => r.data)
export const signEngagementApi = (dealId) =>
  client.post(`/acheteur/deals/${dealId}/engagement`, { accepted: true }).then(r => r.data)
export const placeBidApi = (dealId, payload) =>
  client.post(`/acheteur/deals/${dealId}/bids`, payload).then(r => r.data)
export const myBidsApi = (dealId) => client.get(`/acheteur/deals/${dealId}/bids/mine`).then(r => r.data)
export const bidRankingApi = (dealId) => client.get(`/acheteur/deals/${dealId}/bids/ranking`).then(r => r.data)

// Sprint A : units / questions / visit
export const dealUnitsApi = (dealId) =>
  client.get(`/acheteur/deals/${dealId}/units`).then(r => r.data)
export const dealQuestionsApi = (dealId) =>
  client.get(`/acheteur/deals/${dealId}/questions`).then(r => r.data)
export const askDealQuestionApi = (dealId, question) =>
  client.post(`/acheteur/deals/${dealId}/questions`, { question }).then(r => r.data)
export const requestVisitApi = (dealId, payload) =>
  client.post(`/acheteur/deals/${dealId}/visit-request`, payload).then(r => r.data)

// Sprint final item 15
export const myAuctionsApi = () =>
  client.get('/acheteur/my-auctions').then(r => r.data)

// Dashboard sommaire — KPIs + dossiers actifs + deals à découvrir
export const acheteurDashboardApi = () =>
  client.get('/acheteur/dashboard').then(r => r.data)

// Sprint UX item 2 — onboarding
export const onboardingStatusApi = (dealId = null) =>
  client.get('/acheteur/onboarding-status', { params: dealId ? { deal_id: dealId } : {} })
    .then(r => r.data)
