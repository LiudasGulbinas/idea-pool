import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Spinner } from './components/Spinner'
import { AuthProvider, useAuth } from './lib/auth'
import { Admin } from './pages/Admin'
import { Feed } from './pages/Feed'
import { IdeaDetail } from './pages/IdeaDetail'
import { IdeaForm } from './pages/IdeaForm'
import { Login } from './pages/Login'
import { Meeting } from './pages/Meeting'
import { NotAllowed } from './pages/NotAllowed'
import { Profile } from './pages/Profile'
import { Shortlist } from './pages/Shortlist'
import { Team } from './pages/Team'

function Gate() {
  const { session, member, loading } = useAuth()
  if (loading) return <Spinner label="Loading…" />
  if (!session) return <Login />
  if (!member) return <NotAllowed />
  return (
    <Routes>
      <Route path="meeting" element={<Meeting />} />
      <Route element={<Layout />}>
        <Route index element={<Feed />} />
        <Route path="ideas/new" element={<IdeaForm key="new" />} />
        <Route path="ideas/:id" element={<IdeaDetail />} />
        <Route path="ideas/:id/edit" element={<IdeaForm key="edit" />} />
        <Route path="shortlist" element={<Shortlist />} />
        <Route path="team" element={<Team />} />
        <Route path="profile" element={<Profile />} />
        <Route path="admin" element={<Admin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </BrowserRouter>
  )
}
