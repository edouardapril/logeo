import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Layout from './components/layout/Layout'

import Login from './pages/auth/Login'
import RegisterCourtier from './pages/auth/RegisterCourtier'
import RegisterAcheteur from './pages/auth/RegisterAcheteur'

import AdminDashboard from './pages/admin/AdminDashboard'
import AdminUsers from './pages/admin/AdminUsers'
import AdminDeals from './pages/admin/AdminDeals'
import AdminDealDetail from './pages/admin/AdminDealDetail'

import CourtierDashboard from './pages/courtier/CourtierDashboard'
import SubmitDeal from './pages/courtier/SubmitDeal'
import CourtierDealDetail from './pages/courtier/CourtierDealDetail'

import DealList from './pages/acheteur/DealList'
import DealDetail from './pages/acheteur/DealDetail'

function ProtectedRoute({ roles }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return <Outlet />
}

function RoleRedirect() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'admin') return <Navigate to="/admin" replace />
  if (user.role === 'courtier') return <Navigate to="/courtier" replace />
  return <Navigate to="/acheteur/deals" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/register/courtier" element={<RegisterCourtier />} />
        <Route path="/register/acheteur" element={<RegisterAcheteur />} />
        <Route path="/" element={<RoleRedirect />} />

        {/* Admin */}
        <Route element={<ProtectedRoute roles={['admin']} />}>
          <Route element={<Layout />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/deals" element={<AdminDeals />} />
            <Route path="/admin/deals/:dealId" element={<AdminDealDetail />} />
          </Route>
        </Route>

        {/* Courtier */}
        <Route element={<ProtectedRoute roles={['courtier']} />}>
          <Route element={<Layout />}>
            <Route path="/courtier" element={<CourtierDashboard />} />
            <Route path="/courtier/submit" element={<SubmitDeal />} />
            <Route path="/courtier/deals/:dealId" element={<CourtierDealDetail />} />
          </Route>
        </Route>

        {/* Acheteur */}
        <Route element={<ProtectedRoute roles={['acheteur']} />}>
          <Route element={<Layout />}>
            <Route path="/acheteur/deals" element={<DealList />} />
            <Route path="/acheteur/deals/:dealId" element={<DealDetail />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
