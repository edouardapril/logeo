import client from './client'

// Users
export const listUsersApi = (role) => client.get('/admin/users', { params: role ? { role } : {} }).then(r => r.data)
export const qualifyUserApi = (userId, isQualified) =>
  client.patch(`/admin/users/${userId}/qualify`, { is_qualified: isQualified }).then(r => r.data)
export const toggleUserApi = (userId) => client.patch(`/admin/users/${userId}/activate`).then(r => r.data)

// Deals
export const adminListDealsApi = (status) =>
  client.get('/admin/deals', { params: status ? { status } : {} }).then(r => r.data)
export const adminGetDealApi = (dealId) => client.get(`/admin/deals/${dealId}`).then(r => r.data)
export const verdictApi = (dealId, data) => client.post(`/admin/deals/${dealId}/verdict`, data).then(r => r.data)

// Bids
export const adminListBidsApi = (dealId) => client.get(`/admin/deals/${dealId}/bids`).then(r => r.data)
export const confirmDepositApi = (dealId, data) =>
  client.post(`/admin/deals/${dealId}/confirm-deposit`, data).then(r => r.data)
export const confirmBalanceApi = (dealId, data) =>
  client.post(`/admin/deals/${dealId}/confirm-balance`, data).then(r => r.data)

// Dashboard metrics + enriched listing (sprint admin)
export const adminMetricsApi = () =>
  client.get('/admin/dashboard/metrics').then(r => r.data)

export const adminListDealsEnrichedApi = (status) =>
  client.get('/admin/deals/enriched', { params: status ? { status } : {} }).then(r => r.data)

export const extendBidCloseApi = (dealId, isoDateTime) =>
  client.post(`/admin/deals/${dealId}/extend-bid-close`, { bid_close_at: isoDateTime }).then(r => r.data)

// Users tabs
export const listAcheteursAdminApi = () =>
  client.get('/admin/users/acheteurs').then(r => r.data)
export const listCourtiersAdminApi = () =>
  client.get('/admin/users/courtiers').then(r => r.data)
export const listPendingApi = () =>
  client.get('/admin/users/pending').then(r => r.data)
export const rejectPendingApi = (userId) =>
  client.post(`/admin/users/${userId}/reject`).then(r => r.data)

// Sanctions
export const listSanctionsApi = (activeOnly = true) =>
  client.get('/admin/sanctions', { params: { active_only: activeOnly } }).then(r => r.data)
export const createSanctionApi = (payload) =>
  client.post('/admin/sanctions', payload).then(r => r.data)
export const liftSanctionApi = (sanctionId, lifted_reason) =>
  client.post(`/admin/sanctions/${sanctionId}/lift`, { lifted_reason }).then(r => r.data)
