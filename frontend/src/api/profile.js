import client, { uploadConfig } from './client'

export const getMeApi = () => client.get('/me').then(r => r.data)

export const updateProfileApi = (payload) =>
  client.patch('/me', payload).then(r => r.data)

export const changePasswordApi = (current_password, new_password) =>
  client.post('/me/password', { current_password, new_password }).then(r => r.data)

export const updateNotificationsApi = (email_notifications) =>
  client.patch('/me/notifications', { email_notifications }).then(r => r.data)

export const uploadProfilePhotoApi = (file) => {
  const fd = new FormData()
  fd.append('file', file)
  return client.post('/me/photo', fd, uploadConfig).then(r => r.data)
}

export const deleteProfilePhotoApi = () =>
  client.delete('/me/photo').then(r => r.data)

// Convention courtier (sprint B)
export const conventionStatusApi = () =>
  client.get('/me/convention/status').then(r => r.data)

export const signConventionApi = (consents) =>
  client.post('/me/convention/sign', consents).then(r => r.data)
