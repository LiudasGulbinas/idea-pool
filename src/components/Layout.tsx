import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Avatar } from './Avatar'
import { InstallHint } from './InstallHint'

const tabs = [
  { to: '/', label: 'Ideas', icon: '💡' },
  { to: '/shortlist', label: 'Shortlist', icon: '🏁' },
  { to: '/team', label: 'Team', icon: '👥' },
  { to: '/profile', label: 'Me', icon: '🙂' },
]

export function Layout() {
  const { member } = useAuth()
  const allTabs = member?.role === 'admin' ? [...tabs, { to: '/admin', label: 'Admin', icon: '⚙️' }] : tabs

  return (
    <div className="min-h-dvh pb-20 sm:pb-0">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2 text-lg font-extrabold text-brand-700">
            <span className="text-2xl">💡</span> Idea Pool
          </NavLink>
          <nav className="ml-auto hidden gap-1 sm:flex">
            {allTabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.to === '/'}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 text-sm font-semibold ${isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'}`
                }
              >
                {t.label}
              </NavLink>
            ))}
          </nav>
          {member && (
            <NavLink to="/profile" className="ml-auto sm:ml-2">
              <Avatar member={member} size={32} />
            </NavLink>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5">
        <InstallHint />
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] sm:hidden">
        <div className="mx-auto flex max-w-3xl">
          {allTabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === '/'}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center py-2 text-xs font-semibold ${isActive ? 'text-brand-600' : 'text-slate-500'}`
              }
            >
              <span className="text-xl leading-6">{t.icon}</span>
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
