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
