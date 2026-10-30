import { useState } from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { fetchAgentLogs } from '../api/client';
import { ChevronLeft, ChevronRight, CheckCircle, XCircle, Clock } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

const AGENT_COLORS: Record<string, string> = {
  alarm_classification:     '#3b82f6',
  root_cause_analysis:      '#8b5cf6',
  topology_impact:          '#06b6d4',
  remediation_report:       '#10b981',
  orchestrator:             '#f59e0b',
};

const PAGE_SIZE = 25;

export default function AgentLogs() {
  const [agentFilter, setAgentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);

  const params: Record<string, string> = {
    limit: String(PAGE_SIZE),
    offset: String(page * PAGE_SIZE),
  };
  if (agentFilter)  params.agent_name       = agentFilter;
  if (statusFilter) params.execution_status = statusFilter;

  const { data, isLoading } = useQuery(
    ['agentLogs', agentFilter, statusFilter, page],
    () => fetchAgentLogs(params),
    { keepPreviousData: true, refetchInterval: 30_000 }
  );

  const logs     = data?.data       || [];
  const total    = data?.total      || 0;
  const agStats  = data?.agent_stats || [];
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const agentNames = Object.keys(AGENT_COLORS);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-white">Agent Execution Logs</h1>
        <p className="text-xs text-gray-500">{total} total executions</p>
      </div>

      {/* Per-agent stat cards */}
      {agStats.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {agStats.map((a) => {
            const total = parseInt(a.total) || 1;
            const successPct = Math.round((parseInt(a.success) / total) * 100);
            const color = AGENT_COLORS[a.agent_name] || '#6b7280';
            return (
              <div key={a.agent_name} className="noc-panel p-3" style={{ borderColor: `${color}30` }}>
                <div className="text-[10px] text-gray-500 capitalize mb-2 leading-tight">
                  {a.agent_name.replace(/_/g, ' ')}
                </div>
                <div className="text-xl font-bold text-white">{a.total}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">executions</div>
                <div className="mt-2 h-1 bg-[#1e2d4a] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${successPct}%`, backgroundColor: color }} />
                </div>
                <div className="mt-1 flex justify-between text-[10px]">
                  <span style={{ color }}>{successPct}% success</span>
                  <span className="text-gray-600">~{a.avg_ms || '?'}ms</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div className="noc-panel p-3 flex flex-wrap gap-3 items-center">
        <select
          className="input-field text-xs py-1.5"
          value={agentFilter}
          onChange={e => { setAgentFilter(e.target.value); setPage(0); }}
        >
          <option value="">All Agents</option>
          {agentNames.map(n => (
            <option key={n} value={n}>{n.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <select
          className="input-field text-xs py-1.5"
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
        >
          <option value="">All Statuses</option>
          <option value="success">Success</option>
          <option value="failure">Failure</option>
        </select>
        {(agentFilter || statusFilter) && (
          <button
            className="text-xs text-gray-500 hover:text-white"
            onClick={() => { setAgentFilter(''); setStatusFilter(''); setPage(0); }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="noc-panel overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#1e2d4a] text-gray-500">
              <th className="px-4 py-3 text-left font-medium w-5">Status</th>
              <th className="px-4 py-3 text-left font-medium">Agent</th>
              <th className="px-4 py-3 text-left font-medium">Incident</th>
              <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Input Tokens</th>
              <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Output Tokens</th>
              <th className="px-4 py-3 text-left font-medium">Duration</th>
              <th className="px-4 py-3 text-left font-medium">Error</th>
              <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Time</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={8} className="text-center py-8 text-gray-600">Loading logs...</td></tr>
            )}
            {!isLoading && logs.length === 0 && (
              <tr><td colSpan={8} className="text-center py-8 text-gray-600">No agent logs found.</td></tr>
            )}
            {logs.map(log => {
              const color = AGENT_COLORS[log.agent_name] || '#6b7280';
              return (
                <tr key={log.log_id} className="border-b border-[#1a2744] hover:bg-[#1a2744] transition-colors">
                  <td className="px-4 py-2.5">
                    {log.execution_status === 'success'
                      ? <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                      : <XCircle className="w-3.5 h-3.5 text-red-400" />
                    }
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded capitalize"
                      style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}
                    >
                      {log.agent_name.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {log.incident_id ? (
                      <Link to={`/incidents/${log.incident_id}`} className="text-blue-400 hover:underline font-mono text-[10px]">
                        {log.incident_id.slice(0, 8)}…
                      </Link>
                    ) : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-400 hidden md:table-cell">
                    {log.input_tokens ? log.input_tokens.toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-gray-400 hidden md:table-cell">
                    {log.output_tokens ? log.output_tokens.toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-gray-400">
                    {log.duration_ms != null ? (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {log.duration_ms}ms
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-red-400 max-w-[200px]">
                    {log.error_message ? (
                      <span className="truncate block text-[10px]" title={log.error_message}>
                        {log.error_message}
                      </span>
                    ) : <span className="text-gray-700">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 hidden lg:table-cell" title={format(new Date(log.started_at), 'yyyy-MM-dd HH:mm:ss')}>
                    {formatDistanceToNow(new Date(log.started_at), { addSuffix: true })}
                  </td>
                </tr>
              );
            })}
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
    </div>
  );
}
