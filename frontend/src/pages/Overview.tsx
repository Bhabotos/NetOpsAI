import { useState } from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { fetchStats, fetchAlarms, fetchIncidents } from '../api/client';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import { AlertTriangle, Activity, CheckCircle, Zap, RefreshCw } from 'lucide-react';
import SeverityBadge from '../components/SeverityBadge';
import SimulateAlarmModal from '../components/SimulateAlarmModal';
import { formatDistanceToNow } from 'date-fns';

const SEV_COLORS: Record<string, string> = {
  Critical: '#ef4444', Major: '#f97316', Minor: '#eab308',
  Warning: '#f59e0b', Info: '#3b82f6',
};

export default function Overview() {
  const [showSimulate, setShowSimulate] = useState(false);

  const { data: stats, refetch: refetchStats } = useQuery('stats', fetchStats, { refetchInterval: 30_000 });
  const { data: alarmsData }    = useQuery(['alarms', 'recent'],    () => fetchAlarms({ limit: '5', offset: '0' }), { refetchInterval: 30_000 });
  const { data: incidentsData } = useQuery(['incidents', 'recent'], () => fetchIncidents({ limit: '5', offset: '0' }), { refetchInterval: 30_000 });

  const alarmCounts   = stats?.data?.alarm_counts    || [];
  const incidentCounts = stats?.data?.incident_counts || [];
  const agentStats    = stats?.data?.agent_stats      || [];
  const alarmTrend    = stats?.data?.alarm_trend      || [];

  const totalAlarms    = alarmCounts.reduce((s, x) => s + parseInt(x.count), 0);
  const openIncidents  = incidentCounts.find(x => x.incident_status === 'open')?.count || '0';
  const criticalAlarms = alarmCounts.find(x => x.severity === 'Critical')?.count || '0';
  const resolvedCount  = incidentCounts.find(x => x.incident_status === 'resolved')?.count || '0';

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">NOC Overview</h1>
          <p className="text-xs text-gray-500">Real-time network health and incident summary</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost flex items-center gap-1.5 text-xs" onClick={() => refetchStats()}>
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button className="btn-primary flex items-center gap-1.5 text-xs" onClick={() => setShowSimulate(true)}>
            <Zap className="w-3.5 h-3.5" /> Simulate Alarm
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="stat-card">
          <div className="text-xs text-gray-500">Total Alarms</div>
          <div className="text-2xl font-bold text-white">{totalAlarms}</div>
          <div className="text-xs text-gray-600">all time</div>
        </div>
        <div className="stat-card border-red-700/30">
          <div className="text-xs text-gray-500">Critical Alarms</div>
          <div className="text-2xl font-bold text-red-400">{criticalAlarms}</div>
          <div className="flex gap-1 mt-0.5">
            <AlertTriangle className="w-3 h-3 text-red-500" />
            <span className="text-xs text-red-500">Requires attention</span>
          </div>
        </div>
        <div className="stat-card border-orange-700/30">
          <div className="text-xs text-gray-500">Open Incidents</div>
          <div className="text-2xl font-bold text-orange-400">{openIncidents}</div>
          <Link to="/incidents" className="text-xs text-blue-400 hover:underline">View all →</Link>
        </div>
        <div className="stat-card border-green-700/30">
          <div className="text-xs text-gray-500">Resolved</div>
          <div className="text-2xl font-bold text-green-400">{resolvedCount}</div>
          <div className="flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-green-500" />
            <span className="text-xs text-gray-600">incidents</span>
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-3">
        {/* Alarm severity distribution */}
        <div className="noc-panel p-4">
          <div className="text-xs text-gray-400 mb-3 font-semibold uppercase tracking-wider">Alarm Severity Distribution</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={alarmCounts} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" vertical={false} />
              <XAxis dataKey="severity" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#0f1629', border: '1px solid #1e2d4a', borderRadius: 6, fontSize: 12 }}
                labelStyle={{ color: '#9ca3af' }}
                itemStyle={{ color: '#e5e7eb' }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {alarmCounts.map((entry, index) => (
                  <Cell key={index} fill={SEV_COLORS[entry.severity] || '#3b82f6'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 7-day alarm trend */}
        <div className="noc-panel p-4">
          <div className="text-xs text-gray-400 mb-3 font-semibold uppercase tracking-wider">7-Day Alarm Trend</div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={alarmTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fill: '#6b7280', fontSize: 10 }}
                axisLine={false} tickLine={false}
                tickFormatter={d => d ? d.slice(5) : ''}
              />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#0f1629', border: '1px solid #1e2d4a', borderRadius: 6, fontSize: 12 }}
                labelStyle={{ color: '#9ca3af' }}
                itemStyle={{ color: '#06b6d4' }}
              />
              <Line type="monotone" dataKey="count" stroke="#06b6d4" strokeWidth={2} dot={{ fill: '#06b6d4', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Agent stats + Recent tables */}
      <div className="grid grid-cols-3 gap-3">
        {/* Agent performance */}
        <div className="noc-panel p-4">
          <div className="text-xs text-gray-400 mb-3 font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-blue-400" /> Agent Performance
          </div>
          <div className="space-y-2">
            {agentStats.length === 0 ? (
              <p className="text-xs text-gray-600">No agent executions yet.</p>
            ) : (
              agentStats.map((a: { agent_name: string; total: string; success: string; fail: string; avg_ms: string }) => {
                const total = parseInt(a.total) || 1;
                const successPct = Math.round((parseInt(a.success) / total) * 100);
                return (
                  <div key={a.agent_name}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-gray-300 capitalize">{a.agent_name.replace(/_/g, ' ')}</span>
                      <span className={successPct >= 80 ? 'text-green-400' : 'text-red-400'}>{successPct}%</span>
                    </div>
                    <div className="h-1.5 bg-[#1e2d4a] rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${successPct}%` }} />
                    </div>
                    <div className="text-[10px] text-gray-600 mt-0.5">{a.total} runs · avg {a.avg_ms || '?'}ms</div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recent alarms */}
        <div className="noc-panel p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Recent Alarms</div>
            <Link to="/alarms" className="text-xs text-blue-400 hover:underline">All →</Link>
          </div>
          <div className="space-y-2">
            {(alarmsData?.data || []).map(a => (
              <div key={a.alarm_id} className="flex items-start gap-2 py-1 border-b border-[#1a2744] last:border-0">
                <SeverityBadge severity={a.severity} className="mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs text-white truncate">{a.alarm_type}</div>
                  <div className="text-[10px] text-gray-500">{a.device_name}</div>
                </div>
              </div>
            ))}
            {!alarmsData?.data?.length && <p className="text-xs text-gray-600">No alarms yet.</p>}
          </div>
        </div>

        {/* Recent incidents */}
        <div className="noc-panel p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Recent Incidents</div>
            <Link to="/incidents" className="text-xs text-blue-400 hover:underline">All →</Link>
          </div>
          <div className="space-y-2">
            {(incidentsData?.data || []).map(inc => (
              <Link key={inc.incident_id} to={`/incidents/${inc.incident_id}`}
                className="flex items-start gap-2 py-1 border-b border-[#1a2744] last:border-0 hover:bg-[#1a2744] rounded transition-colors px-1">
                <SeverityBadge severity={inc.severity} className="mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs text-white truncate">{inc.incident_title}</div>
                  <div className="text-[10px] text-gray-500">
                    {formatDistanceToNow(new Date(inc.created_at), { addSuffix: true })}
                  </div>
                </div>
              </Link>
            ))}
            {!incidentsData?.data?.length && <p className="text-xs text-gray-600">No incidents yet.</p>}
          </div>
        </div>
      </div>

      {showSimulate && <SimulateAlarmModal onClose={() => setShowSimulate(false)} />}
    </div>
  );
}
