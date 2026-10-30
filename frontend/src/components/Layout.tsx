import { Outlet, NavLink } from 'react-router-dom';
import { Activity, AlertTriangle, Network, Bot, Home, Wifi } from 'lucide-react';
import { useQuery } from 'react-query';
import { fetchHealth } from '../api/client';
import clsx from 'clsx';

const navItems = [
  { to: '/overview',   label: 'Overview',   icon: Home },
  { to: '/alarms',     label: 'Alarms',     icon: AlertTriangle },
  { to: '/incidents',  label: 'Incidents',  icon: Activity },
  { to: '/topology',   label: 'Topology',   icon: Network },
  { to: '/agents',     label: 'Agent Logs', icon: Bot },
];

export default function Layout() {
  const { data: health, isError } = useQuery('health', fetchHealth, {
    refetchInterval: 30_000,
    retry: 1,
  });

  const dbOk = !isError && health?.status === 'ok';

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0e1a]">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-[#0f1629] border-r border-[#1e2d4a] flex flex-col">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-[#1e2d4a]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center">
              <Wifi className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-white leading-none">NetOpsAI</div>
              <div className="text-[10px] text-gray-500 leading-none mt-0.5">NOC Dashboard</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                  isActive
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
                    : 'text-gray-400 hover:text-gray-100 hover:bg-[#1a2744]'
                )
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer: DB status */}
        <div className="px-4 py-3 border-t border-[#1e2d4a]">
          <div className="flex items-center gap-2 text-xs">
            <div className={clsx('w-2 h-2 rounded-full', dbOk ? 'bg-green-400' : 'bg-red-400')} />
            <span className="text-gray-500">{dbOk ? 'DB Connected' : 'DB Offline'}</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex-shrink-0 h-12 border-b border-[#1e2d4a] bg-[#0f1629] flex items-center px-6 gap-4">
          <span className="text-xs text-gray-500 font-mono">
            AI-Powered Multi-Agent Network Operations Center
          </span>
          <div className="ml-auto flex items-center gap-3 text-xs text-gray-500">
            <span className="text-[10px] border border-yellow-700/50 text-yellow-500 px-1.5 py-0.5 rounded">
              READ-ONLY — Human approval required for all remediation
            </span>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto p-4">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
