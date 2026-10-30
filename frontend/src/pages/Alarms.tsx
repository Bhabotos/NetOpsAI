import { useState } from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { fetchAlarms } from '../api/client';
import SeverityBadge from '../components/SeverityBadge';
import SimulateAlarmModal from '../components/SimulateAlarmModal';
import { Zap, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import clsx from 'clsx';

const STATUS_LABELS: Record<string, string> = {
  received: 'Received', processing: 'Processing', processed: 'Processed',
  failed: 'Failed', deduplicated: 'Deduped',
};

const PAGE_SIZE = 20;

export default function Alarms() {
  const [showSimulate, setShowSimulate] = useState(false);
  const [severity, setSeverity] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);

  const params: Record<string, string> = {
    limit: String(PAGE_SIZE),
    offset: String(page * PAGE_SIZE),
  };
  if (severity) params.severity = severity;
  if (status)   params.status   = status;

  const { data, isLoading } = useQuery(['alarms', severity, status, page], () => fetchAlarms(params), {
    keepPreviousData: true,
    refetchInterval: 30_000,
  });

  const alarms = data?.data || [];
  const total  = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Alarm Management</h1>
          <p className="text-xs text-gray-500">{total} total alarms</p>
        </div>
        <button className="btn-primary flex items-center gap-1.5 text-xs" onClick={() => setShowSimulate(true)}>
          <Zap className="w-3.5 h-3.5" /> Simulate Alarm
        </button>
      </div>

      {/* Filters */}
      <div className="noc-panel p-3 flex flex-wrap gap-3 items-center">
        <Filter className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
        <select className="input-field text-xs py-1.5" value={severity} onChange={e => { setSeverity(e.target.value); setPage(0); }}>
          <option value="">All Severities</option>
          {['Critical','Major','Minor','Warning','Info'].map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="input-field text-xs py-1.5" value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}>
          <option value="">All Statuses</option>
          {['received','processing','processed','failed','deduplicated'].map(s => <option key={s}>{s}</option>)}
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
              <th className="px-4 py-3 text-left font-medium">Alarm Type</th>
              <th className="px-4 py-3 text-left font-medium">Device</th>
              <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Interface</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Incident</th>
              <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="text-center py-8 text-gray-600">Loading alarms...</td></tr>
            )}
            {!isLoading && alarms.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-gray-600">No alarms found.</td></tr>
            )}
            {alarms.map(a => (
              <tr key={a.alarm_id} className="border-b border-[#1a2744] hover:bg-[#1a2744] transition-colors">
                <td className="px-4 py-2.5">
                  <SeverityBadge severity={a.severity} />
                </td>
                <td className="px-4 py-2.5 text-gray-200 font-medium">{a.alarm_type}</td>
                <td className="px-4 py-2.5 text-gray-300">{a.device_name}</td>
                <td className="px-4 py-2.5 text-gray-400 hidden md:table-cell">{a.interface_name || '—'}</td>
                <td className="px-4 py-2.5">
                  <span className={clsx(
                    'px-1.5 py-0.5 rounded text-[10px]',
                    a.processing_status === 'processed'     && 'text-green-400 bg-green-900/20',
                    a.processing_status === 'processing'    && 'text-yellow-400 bg-yellow-900/20',
                    a.processing_status === 'failed'        && 'text-red-400 bg-red-900/20',
                    a.processing_status === 'deduplicated'  && 'text-gray-400 bg-gray-700/20',
                    a.processing_status === 'received'      && 'text-blue-400 bg-blue-900/20',
                  )}>
                    {STATUS_LABELS[a.processing_status] || a.processing_status}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  {a.incident_id ? (
                    <Link to={`/incidents/${a.incident_id}`} className="text-blue-400 hover:underline text-[10px] font-mono">
                      {a.incident_id.slice(0, 8)}…
                    </Link>
                  ) : <span className="text-gray-600">—</span>}
                </td>
                <td className="px-4 py-2.5 text-gray-500 hidden lg:table-cell" title={format(new Date(a.alarm_timestamp), 'yyyy-MM-dd HH:mm:ss')}>
                  {formatDistanceToNow(new Date(a.alarm_timestamp), { addSuffix: true })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
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

      {showSimulate && <SimulateAlarmModal onClose={() => setShowSimulate(false)} />}
    </div>
  );
}
