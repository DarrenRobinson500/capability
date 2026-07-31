import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface NavItem {
  to: string;
  label: string;
  show: (role: string | null, hasEmployee: boolean) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/org-chart', label: 'Org Chart', show: () => true },
  { to: '/admin/skills', label: 'Skills', show: (role) => role === 'HR_ADMIN' },
  {
    to: '/requirements',
    label: 'Positions',
    show: (role) => role === 'MANAGER' || role === 'HR_ADMIN',
  },
  { to: '/profile', label: 'My Skills Profile', show: (_role, hasEmployee) => hasEmployee },
  { to: '/team', label: 'Team Skills Matrix', show: (role) => role === 'MANAGER' },
  { to: '/admin/org-structure', label: 'Org Chart Builder', show: (role) => role === 'HR_ADMIN' },
  {
    to: '/reports/gaps',
    label: 'Gap Analysis',
    show: (role) => role === 'MANAGER' || role === 'HR_ADMIN' || role === 'EXECUTIVE',
  },
  { to: '/search', label: 'Capability Search', show: (role) => role === 'MANAGER' || role === 'HR_ADMIN' },
  { to: '/certifications', label: 'Certifications', show: () => true },
  {
    to: '/dashboard',
    label: 'Dashboard',
    show: (role) => role === 'EXECUTIVE' || role === 'HR_ADMIN',
  },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const hasEmployee = user?.employee_id != null;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="text-lg font-semibold">Capability</div>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>
              {user?.employee_name ?? user?.username} <span className="text-gray-400">({user?.role})</span>
            </span>
            <button
              onClick={() => void logout()}
              className="rounded-md border border-gray-300 px-3 py-1 hover:bg-gray-100"
            >
              Log out
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl flex-wrap gap-1 px-4 pb-2 text-sm">
          {NAV_ITEMS.filter((item) => item.show(user?.role ?? null, hasEmployee)).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 ${isActive ? 'bg-orange-100 text-orange-800' : 'text-gray-600 hover:bg-gray-100'}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
