import { useQuery } from 'react-query';
import { fetchTopology } from '../api/client';
import type { Device, TopologyLink } from '../api/client';
import { Network, AlertTriangle, Activity, Server } from 'lucide-react';
import clsx from 'clsx';

const ROLE_COLOR: Record<string, string> = {
  core:         '#3b82f6',
  distribution: '#8b5cf6',
  edge:         '#06b6d4',
  access:       '#10b981',
  transport:    '#f59e0b',
  amplifier:    '#6b7280',
};

const STATUS_COLOR: Record<string, string> = {
  active:      '#10b981',
  inactive:    '#ef4444',
  maintenance: '#f59e0b',
};

function DeviceCard({ device }: { device: Device }) {
  const roleColor = ROLE_COLOR[device.network_role] || '#6b7280';
  const hasCritical = parseInt(String(device.active_alarm_count)) > 0;

  return (
    <div className={clsx(
      'noc-panel p-3 hover:border-blue-500/50 transition-colors cursor-default',
      hasCritical && 'border-red-700/50'
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_COLOR[device.status] || '#6b7280' }} />
          <span className="text-xs font-semibold text-white truncate">{device.device_name}</span>
        </div>
        <div className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${roleColor}20`, color: roleColor, border: `1px solid ${roleColor}40` }}>
          {device.network_role}
        </div>
      </div>
      <div className="mt-1.5 text-[10px] text-gray-500 space-y-0.5">
        <div>{device.device_type} · {device.vendor}</div>
        <div>{device.location}</div>
        <div className="font-mono text-gray-600">{device.ip_address || device.management_ip}</div>
      </div>
      <div className="mt-2 flex gap-3">
        {parseInt(String(device.active_alarm_count)) > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-red-400">
            <AlertTriangle className="w-3 h-3" /> {device.active_alarm_count} alarms
          </span>
        )}
        {parseInt(String(device.active_incident_count)) > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-orange-400">
            <Activity className="w-3 h-3" /> {device.active_incident_count} incidents
          </span>
        )}
        {parseInt(String(device.active_alarm_count)) === 0 && parseInt(String(device.active_incident_count)) === 0 && (
          <span className="text-[10px] text-green-400">● Healthy</span>
        )}
      </div>
    </div>
  );
}

function LinkRow({ link }: { link: TopologyLink }) {
  return (
    <div className="flex items-center gap-3 py-1.5 border-b border-[#1a2744] last:border-0 text-xs">
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <span className="text-gray-300 truncate">{link.source_name}</span>
        <span className="text-gray-600 flex-shrink-0">——</span>
        <span className="text-gray-300 truncate">{link.dest_name}</span>
      </div>
      <span className="text-[10px] text-blue-400 flex-shrink-0 hidden md:block">{link.link_type}</span>
      <span className="text-[10px] text-gray-500 flex-shrink-0">{link.capacity_gbps} Gbps</span>
    </div>
  );
}

export default function Topology() {
  const { data, isLoading } = useQuery('topology', fetchTopology, { refetchInterval: 60_000 });

  const nodes  = data?.nodes  || [];
  const links  = data?.links  || [];

  // Group devices by role
  const roleGroups = nodes.reduce<Record<string, Device[]>>((acc, d) => {
    const role = d.network_role || 'other';
    if (!acc[role]) acc[role] = [];
    acc[role].push(d);
    return acc;
  }, {});

  const totalAlarms   = nodes.reduce((s, d) => s + parseInt(String(d.active_alarm_count)), 0);
  const unhealthyNodes = nodes.filter(d => parseInt(String(d.active_alarm_count)) > 0).length;

  if (isLoading) return <div className="text-gray-500 text-sm p-8">Loading topology...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Network Topology</h1>
          <p className="text-xs text-gray-500">{nodes.length} devices · {links.length} links</p>
        </div>
        <div className="flex gap-3 text-xs">
          <div className="stat-card py-2">
            <span className="text-gray-500">Active Alarms</span>
            <span className={`font-bold text-base ${totalAlarms > 0 ? 'text-red-400' : 'text-green-400'}`}>{totalAlarms}</span>
          </div>
          <div className="stat-card py-2">
            <span className="text-gray-500">Unhealthy Nodes</span>
            <span className={`font-bold text-base ${unhealthyNodes > 0 ? 'text-orange-400' : 'text-green-400'}`}>{unhealthyNodes}</span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="noc-panel p-3 flex flex-wrap gap-4 text-xs">
        {Object.entries(ROLE_COLOR).map(([role, color]) => (
          <div key={role} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-gray-400 capitalize">{role}</span>
          </div>
        ))}
        <div className="ml-4 flex items-center gap-3">
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-green-400" /><span className="text-gray-400">Active</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-400" /><span className="text-gray-400">Inactive</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-yellow-400" /><span className="text-gray-400">Maintenance</span></div>
        </div>
      </div>

      {/* Device grid by role */}
      <div className="space-y-4">
        {Object.entries(roleGroups).sort(([a], [b]) => {
          const order = ['core','distribution','edge','access','transport','amplifier'];
          return order.indexOf(a) - order.indexOf(b);
        }).map(([role, devs]) => (
          <div key={role}>
            <div className="flex items-center gap-2 mb-2">
              <Server className="w-3.5 h-3.5" style={{ color: ROLE_COLOR[role] || '#6b7280' }} />
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 capitalize">{role} Layer</span>
              <div className="flex-1 h-px bg-[#1e2d4a]" />
              <span className="text-xs text-gray-600">{devs.length} devices</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
              {devs.map(d => <DeviceCard key={d.device_id} device={d} />)}
            </div>
          </div>
        ))}
      </div>

      {/* Links table */}
      <div className="noc-panel p-4">
        <div className="flex items-center gap-2 mb-3">
          <Network className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Network Links</span>
          <span className="text-xs text-gray-600 ml-auto">{links.length} links</span>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {links.map(l => <LinkRow key={l.link_id} link={l} />)}
          {links.length === 0 && <p className="text-xs text-gray-600">No links defined.</p>}
        </div>
      </div>
    </div>
  );
}
