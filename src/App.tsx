import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Spinner } from './components/Spinner'
import { AuthProvider, useAuth } from './lib/auth'
import { isConfigured } from './lib/supabase'
import { Admin } from './pages/Admin'
import { Home } from './pages/Home'
import { Login } from './pages/Login'
import { NotAllowed } from './pages/NotAllowed'
import { Profile } from './pages/Profile'
import { Team } from './pages/Team'

function Gate() {
  const { session, member, loading } = useAuth()
  if (loading) return <Spinner label="Loading…" />
  if (!session) return <Login />
  if (!member) return <NotAllowed />
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="team" element={<Team />} />
        <Route path="profile" element={<Profile />} />
        <Route path="admin" element={<Admin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  if (!isConfigured) {
    return (
      <div className="p-6 text-center text-slate-600">
        The app is not connected to the database yet (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).
      </div>
    )
  }
  return (
    <BrowserRouter>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </BrowserRouter>
  )
}
