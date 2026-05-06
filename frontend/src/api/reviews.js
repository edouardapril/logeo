import client from './client'

export const createReviewApi = (dealId, payload) =>
  client.post(`/reviews/deals/${dealId}`, payload).then(r => r.data)

export const listReviewsForDealApi = (dealId) =>
  client.get(`/reviews/deals/${dealId}`).then(r => r.data)

export const userRatingAggregateApi = (userId) =>
  client.get(`/reviews/users/${userId}/aggregate`).then(r => r.data)
