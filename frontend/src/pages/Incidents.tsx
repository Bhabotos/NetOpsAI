import { useState } from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { fetchIncidents } from '../api/client';
import SeverityBadge from '../components/SeverityBadge';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';

const STATUS_CLASS: Record<string, string> = {
  open:         'badge-open',
  investigating:'text-yellow-400 bg-yellow-900/20 border border-yellow-700/30 px-2 py-0.5 rounded text-xs',
  resolved:     'badge-resolved',
  closed:       'badge-closed',
  duplicate:    'text-gray-500 bg-gray-800/40 border border-gray-700/30 px-2 py-0.5 rounded text-xs',
};

const PAGE_SIZE = 20;

export default function Incidents() {
  const [severity, setSeverity] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);

  const params: Record<string, string> = {
    limit: String(PAGE_SIZE),
    offset: String(page * PAGE_SIZE),
  };
  if (severity) params.severity = severity;
  if (status)   params.status   = status;

  const { data, isLoading } = useQuery(['incidents', severity, status, page], () => fetchIncidents(params), {
    keepPreviousData: true,
    refetchInterval: 30_000,
  });

  const incidents  = data?.data || [];
  const total      = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-white">Incident Management</h1>
        <p className="text-xs text-gray-500">{total} total incidents</p>
      </div>

      {/* Filters */}
      <div className="noc-panel p-3 flex flex-wrap gap-3 items-center">
        <select className="input-field text-xs py-1.5" value={severity} onChange={e => { setSeverity(e.target.value); setPage(0); }}>
          <option value="">All Severities</option>
          {['Critical','Major','Minor','Warning','Info'].map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="input-field text-xs py-1.5" value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}>
          <option value="">All Statuses</option>
          {['open','investigating','resolved','closed','duplicate'].map(s => <option key={s}>{s}</option>)}
        </select>
        {(severity || status) && (
          <button className="text-xs text-gray-500 hover:text-white" onClick={() => { setSeverity(''); setStatus(''); setPage(0); }}>
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="noc-panel overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#1e2d4a] text-gray-500">
              <th className="px-4 py-3 text-left font-medium">Severity</th>
              <th className="px-4 py-3 text-left font-medium">Title</th>
              <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Root Cause</th>
              <th className="px-4 py-3 text-left font-medium">Impact</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Agents</th>
              <th className="px-4 py-3 text-left font-medium">Created</th>
              <th className="px-4 py-3 text-left font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={8} className="text-center py-8 text-gray-600">Loading incidents...</td></tr>
            )}
            {!isLoading && incidents.length === 0 && (
              <tr><td colSpan={8} className="text-center py-8 text-gray-600">No incidents found.</td></tr>
            )}
            {incidents.map(inc => (
              <tr key={inc.incident_id} className="border-b border-[#1a2744] hover:bg-[#1a2744] transition-colors">
                <td className="px-4 py-3"><SeverityBadge severity={inc.severity} /></td>
                <td className="px-4 py-3">
                  <div className="text-gray-100 font-medium max-w-xs truncate">{inc.incident_title}</div>
                  <div className="text-gray-500 text-[10px] font-mono">{inc.incident_id.slice(0, 8)}…</div>
                </td>
                <td className="px-4 py-3 text-gray-400 hidden md:table-cell max-w-[200px]">
                  <div className="truncate">{inc.probable_root_cause || '—'}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={clsx(
                    'text-[10px] px-1.5 py-0.5 rounded',
                    inc.impact_level === 'Critical' && 'text-red-400 bg-red-900/20',
                    inc.impact_level === 'High'     && 'text-orange-400 bg-orange-900/20',
                    inc.impact_level === 'Medium'   && 'text-yellow-400 bg-yellow-900/20',
                    !['Critical','High','Medium'].includes(inc.impact_level || '') && 'text-gray-400 bg-gray-700/20',
                  )}>
                    {inc.impact_level || 'Unknown'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={STATUS_CLASS[inc.incident_status] || 'text-gray-400'}>
                    {inc.incident_status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">{inc.agent_count || 0}</td>
                <td className="px-4 py-3 text-gray-500">
                  {formatDistanceToNow(new Date(inc.created_at), { addSuffix: true })}
                </td>
                <td className="px-4 py-3">
                  <Link to={`/incidents/${inc.incident_id}`} className="btn-ghost py-1 flex items-center gap-1">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Page {page + 1} of {totalPages} ({total} records)</span>
          <div className="flex gap-1">
            <button className="btn-ghost p-1.5" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button className="btn-ghost p-1.5" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
