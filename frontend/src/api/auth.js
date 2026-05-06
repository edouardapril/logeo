import client from './client'

export const loginApi = (data) => client.post('/auth/login', data).then(r => r.data)
export const registerCourtierApi = (data) => client.post('/auth/register/courtier', data).then(r => r.data)
export const registerAcheteurApi = (data) => client.post('/auth/register/acheteur', data).then(r => r.data)
export const getMeApi = () => client.get('/auth/me').then(r => r.data)

// Sprint final item 10 — email verification
export const verifyEmailApi = (token) =>
  client.post('/auth/verify-email', null, { params: { token } }).then(r => r.data)
export const resendVerificationApi = (email) =>
  client.post('/auth/resend-verification', null, { params: { email } }).then(r => r.data)
