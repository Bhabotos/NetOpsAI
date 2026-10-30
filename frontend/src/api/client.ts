import axios from 'axios';

const API_KEY = import.meta.env.VITE_API_KEY || '';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
    ...(API_KEY ? { 'X-API-Key': API_KEY } : {}),
  },
  timeout: 15_000,
});

api.interceptors.response.use(
  res => res,
  err => {
    const msg = err.response?.data?.error || err.message || 'API request failed';
    console.error('[API Error]', msg, err.config?.url);
    return Promise.reject(new Error(msg));
  }
);

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Alarm {
  alarm_id: string;
  device_id: string | null;
  device_name: string;
  alarm_type: string;
  severity: 'Critical' | 'Major' | 'Minor' | 'Warning' | 'Info';
  interface_name: string | null;
  description: string | null;
  alarm_source: string;
  alarm_timestamp: string;
  processing_status: 'received' | 'processing' | 'processed' | 'failed' | 'deduplicated';
  incident_id: string | null;
  created_at: string;
}

export interface Incident {
  incident_id: string;
  alarm_id: string | null;
  incident_title: string;
  severity: string;
  probable_root_cause: string | null;
  supporting_evidence: unknown[];
  alternative_causes: unknown[];
  confidence_estimate: number | null;
  affected_devices: string[];
  affected_services: unknown[];
  impact_level: string | null;
  recommended_actions: unknown[];
  requires_human_approval: boolean;
  incident_status: 'open' | 'investigating' | 'resolved' | 'closed' | 'duplicate';
  full_report: string | null;
  classification_result: unknown;
  rca_result: unknown;
  topology_result: unknown;
  remediation_result: unknown;
  created_at: string;
  resolved_at: string | null;
  device_name?: string;
  alarm_type?: string;
  agent_count?: number;
}

export interface Device {
  device_id: string;
  device_name: string;
  device_type: string;
  vendor: string;
  model: string;
  ip_address: string;
  management_ip: string | null;
  location: string;
  network_role: string;
  status: 'active' | 'inactive' | 'maintenance';
  active_alarm_count: number;
  active_incident_count: number;
}

export interface TopologyLink {
  link_id: string;
  link_name: string;
  source_device_id: string;
  dest_device_id: string;
  link_type: string;
  capacity_gbps: number;
  source_name: string;
  dest_name: string;
}

export interface AgentLog {
  log_id: string;
  incident_id: string;
  agent_name: string;
  execution_status: 'success' | 'failed' | 'running';
  input_data: unknown;
  output_data: unknown;
  error_message: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  duration_ms: number | null;
  started_at: string;
  completed_at: string | null;
  incident_title?: string;
  incident_severity?: string;
}

export interface AgentStat { agent_name: string; total: string; success: string; fail: string; avg_ms: string }

export interface DashboardStats {
  alarm_counts: { severity: string; count: string }[];
  incident_counts: { incident_status: string; count: string }[];
  agent_stats: AgentStat[];
  alarm_trend: { day: string; count: string }[];
}

export interface SimulatePayload {
  device_name: string;
  alarm_type: string;
  severity: string;
  interface_name?: string;
  description?: string;
}

// ── API functions ──────────────────────────────────────────────────────────────

export const fetchAlarms = (params?: Record<string, string>) =>
  api.get<{ data: Alarm[]; total: number }>('/alarms', { params }).then(r => r.data);

export const fetchIncidents = (params?: Record<string, string>) =>
  api.get<{ data: Incident[]; total: number }>('/incidents', { params }).then(r => r.data);

// Backend GET /api/incidents/:id returns flat object: { ...incident, agent_logs: [] }
// (no { data: ... } wrapper — unlike list endpoints)
export const fetchIncident = (id: string) =>
  api.get<Incident & { agent_logs: AgentLog[] }>(`/incidents/${id}`).then(r => r.data);

export const fetchStats = () =>
  api.get<{ data: DashboardStats }>('/incidents/stats').then(r => r.data);

export const fetchDevices = () =>
  api.get<{ data: Device[]; total: number }>('/devices').then(r => r.data);

export const fetchTopology = () =>
  api.get<{ nodes: Device[]; links: TopologyLink[] }>('/topology').then(r => r.data);

export const fetchAgentLogs = (params?: Record<string, string>) =>
  api.get<{ data: AgentLog[]; total: number; agent_stats: AgentStat[] }>('/agents/logs', { params }).then(r => r.data);

export const simulateAlarm = (payload: SimulatePayload) =>
  api.post('/alarms/simulate', payload).then(r => r.data);

export const resolveIncident = (id: string) =>
  api.post(`/incidents/${id}/resolve`).then(r => r.data);

export const fetchHealth = () =>
  api.get('/health').then(r => r.data);
