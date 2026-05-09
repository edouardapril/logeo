import client from './client'

// ── Acheteur : carte de paiement ─────────────────────────────────────────────
export const getPaymentMethodApi = () =>
  client.get('/acheteur/payment-method').then(r => r.data)

export const createSetupIntentApi = () =>
  client.post('/acheteur/payment-method/setup-intent').then(r => r.data)

export const confirmPaymentMethodApi = (paymentMethodId) =>
  client
    .post('/acheteur/payment-method/confirm', { payment_method_id: paymentMethodId })
    .then(r => r.data)

export const deletePaymentMethodApi = () =>
  client.delete('/acheteur/payment-method').then(r => r.data)

// ── Acheteur : due diligence + frais ─────────────────────────────────────────
export const getFeeQuoteApi = (dealId) =>
  client.get(`/acheteur/deals/${dealId}/fee-quote`).then(r => r.data)

export const getMyDealPaymentsApi = (dealId) =>
  client.get(`/acheteur/deals/${dealId}/payments`).then(r => r.data)

// LOTPLOT 19 : remplacé par dd-confirm (workflow Interac manuel, plus de débit auto Stripe)
export const completeDueDiligenceApi = (dealId) =>
  client.post(`/acheteur/deals/${dealId}/dd-confirm`).then(r => r.data)

export const ddWithdrawApi = (dealId) =>
  client.post(`/acheteur/deals/${dealId}/dd-withdraw`).then(r => r.data)

// Workflow admin manuel — PA signée + Interac reçu (LOTPLOT 19F)
export const adminMarkPaSignedApi = (dealId) =>
  client.post(`/admin/deals/${dealId}/mark-pa-signed`).then(r => r.data)

export const adminMarkPaidApi = (dealId, interac_ref) =>
  client.post(`/admin/deals/${dealId}/mark-paid`, interac_ref ? { interac_ref } : null).then(r => r.data)

export const myPaymentHistoryApi = () =>
  client.get('/acheteur/payments/history').then(r => r.data)

// ── Admin ────────────────────────────────────────────────────────────────────
export const adminListPaymentsApi = (params = {}) =>
  client.get('/admin/payments', { params }).then(r => r.data)

export const adminChargeDepositApi = (dealId) =>
  client.post(`/admin/deals/${dealId}/charge-deposit`).then(r => r.data)

export const adminChargeBalanceApi = (dealId) =>
  client.post(`/admin/deals/${dealId}/charge-balance`).then(r => r.data)

export const adminFallbackNextBidderApi = (dealId) =>
  client.post(`/admin/deals/${dealId}/fallback-next-bidder`).then(r => r.data)
