import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { fetchIncident, resolveIncident } from '../api/client';
import SeverityBadge from '../components/SeverityBadge';
import { ArrowLeft, CheckCircle, AlertTriangle, Clock, Shield } from 'lucide-react';
import { format } from 'date-fns';

function JsonBlock({ data }: { data: unknown }) {
  return (
    <pre className="bg-[#0a0e1a] text-xs text-gray-300 p-3 rounded overflow-x-auto max-h-60 border border-[#1e2d4a]">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

export default function IncidentDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery(['incident', id], () => fetchIncident(id!), {
    enabled: !!id,
    refetchInterval: 20_000,
  });

  const resolve = useMutation(() => resolveIncident(id!), {
    onSuccess: () => {
      qc.invalidateQueries(['incident', id]);
      qc.invalidateQueries('incidents');
      qc.invalidateQueries('stats');
    },
  });

  if (isLoading) return <div className="text-gray-500 text-sm p-8">Loading incident...</div>;
  if (error || !data) return <div className="text-red-400 text-sm p-8">Failed to load incident.</div>;

  // fetchIncident returns the flat incident object (no .data wrapper)
  // Backend GET /api/incidents/:id returns { incident_id, ..., agent_logs: [] }
  const inc  = data;
  const logs = data.agent_logs || [];

  const safeJson = (v: unknown) => {
    if (!v) return null;
    if (typeof v === 'string') { try { return JSON.parse(v); } catch { return v; } }
    return v;
  };

  const classResult  = safeJson(inc.classification_result);
  const rcaResult    = safeJson(inc.rca_result);
  const topResult    = safeJson(inc.topology_result);
  const remResult    = safeJson(inc.remediation_result);
  const affectedDevs = Array.isArray(inc.affected_devices) ? inc.affected_devices : safeJson(inc.affected_devices) || [];
  const recActions   = Array.isArray(inc.recommended_actions) ? inc.recommended_actions : safeJson(inc.recommended_actions) || [];

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link to="/incidents" className="btn-ghost p-1.5 mt-0.5 flex-shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <SeverityBadge severity={inc.severity} />
            <span className={`text-xs px-2 py-0.5 rounded border ${
              inc.incident_status === 'open' ? 'border-red-700/50 text-red-400 bg-red-900/20' :
              inc.incident_status === 'resolved' ? 'border-green-700/50 text-green-400 bg-green-900/20' :
              'border-gray-700 text-gray-400 bg-gray-800/30'
            }`}>{inc.incident_status}</span>
            {inc.requires_human_approval && (
              <span className="text-xs border border-yellow-700/50 text-yellow-500 px-2 py-0.5 rounded bg-yellow-900/10 flex items-center gap-1">
                <Shield className="w-3 h-3" /> Human approval required
              </span>
            )}
          </div>
          <h1 className="text-base font-bold text-white mt-1.5 leading-tight">{inc.incident_title}</h1>
          <div className="flex flex-wrap gap-4 mt-1.5 text-xs text-gray-500">
            <span className="font-mono">{inc.incident_id}</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {format(new Date(inc.created_at), 'PPp')}</span>
            {inc.resolved_at && <span className="text-green-500">Resolved: {format(new Date(inc.resolved_at), 'PPp')}</span>}
          </div>
        </div>
        {inc.incident_status === 'open' && (
          <button
            className="btn-primary flex items-center gap-1.5 text-xs flex-shrink-0"
            onClick={() => resolve.mutate()}
            disabled={resolve.isLoading}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            {resolve.isLoading ? 'Resolving...' : 'Resolve Incident'}
          </button>
        )}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-3 gap-4">
        {/* Root Cause */}
        <div className="col-span-2 space-y-4">
          <div className="noc-panel p-4">
            <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-400" /> Root Cause Analysis
            </div>
            <p className="text-sm text-white font-medium">{inc.probable_root_cause || 'Under investigation'}</p>
            {rcaResult && (
              <div className="mt-3 space-y-2">
                <div className="flex gap-4 text-xs">
                  <span className="text-gray-500">Category: <span className="text-gray-200">{rcaResult.root_cause_category}</span></span>
                  <span className="text-gray-500">Confidence: <span className="text-gray-200">{((rcaResult.confidence || 0) * 100).toFixed(0)}%</span></span>
                  <span className="text-gray-500">Physical inspection: <span className={rcaResult.requires_physical_inspection ? 'text-red-400' : 'text-green-400'}>{rcaResult.requires_physical_inspection ? 'Required' : 'Not required'}</span></span>
                </div>
                {rcaResult.timeline_analysis && (
                  <div className="bg-[#0a0e1a] p-3 rounded border border-[#1e2d4a] text-xs text-gray-300">
                    <span className="text-gray-500 block mb-1">Timeline:</span>
                    {rcaResult.timeline_analysis}
                  </div>
                )}
                {Array.isArray(rcaResult.supporting_evidence) && rcaResult.supporting_evidence.length > 0 && (
                  <div>
                    <span className="text-xs text-gray-500 block mb-1">Supporting Evidence:</span>
                    {rcaResult.supporting_evidence.map((e: { evidence: string; weight: string }, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-xs py-0.5">
                        <span className={`flex-shrink-0 ${e.weight === 'High' ? 'text-red-400' : e.weight === 'Medium' ? 'text-yellow-400' : 'text-gray-500'}`}>•</span>
                        <span className="text-gray-300">{e.evidence} <span className="text-gray-600">({e.weight})</span></span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Recommended actions */}
          {recActions.length > 0 && (
            <div className="noc-panel p-4">
              <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">
                Recommended Actions <span className="text-yellow-500 text-[10px] font-normal ml-1">(READ-ONLY — Human approval required)</span>
              </div>
              <div className="space-y-3">
                {(Array.isArray(recActions) ? recActions : []).map((action: { priority?: number; action_type?: string; title: string; description: string; estimated_duration_minutes?: number; cli_commands?: string[] }, i: number) => (
                  <div key={i} className="bg-[#0a0e1a] rounded border border-[#1e2d4a] p-3">
                    <div className="flex items-start gap-2">
                      <span className="text-blue-400 font-bold text-sm flex-shrink-0">{action.priority || i + 1}.</span>
                      <div>
                        <div className="text-sm font-medium text-white">{action.title}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{action.action_type} · ~{action.estimated_duration_minutes || '?'} min</div>
                        <div className="text-xs text-gray-300 mt-1.5">{action.description}</div>
                        {action.cli_commands && action.cli_commands.length > 0 && (
                          <div className="mt-2">
                            <div className="text-[10px] text-gray-500 mb-1">CLI Commands (diagnostic only):</div>
                            {action.cli_commands.map((cmd: string, ci: number) => (
                              <code key={ci} className="block text-[10px] text-green-300 bg-black/40 px-2 py-0.5 rounded font-mono">{cmd}</code>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Full report */}
          {inc.full_report && (
            <div className="noc-panel p-4">
              <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">Full Incident Report</div>
              <div className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed bg-[#0a0e1a] p-3 rounded border border-[#1e2d4a] max-h-80 overflow-y-auto">
                {inc.full_report}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-3">
          {/* Impact summary */}
          <div className="noc-panel p-4">
            <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">Impact Summary</div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Impact Level</span>
                <span className={`font-semibold ${inc.impact_level === 'Critical' ? 'text-red-400' : inc.impact_level === 'High' ? 'text-orange-400' : 'text-gray-200'}`}>
                  {inc.impact_level || 'Unknown'}
                </span>
              </div>
              {topResult && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Rerouting</span>
                    <span className={topResult.traffic_rerouting_possible ? 'text-green-400' : 'text-red-400'}>
                      {topResult.traffic_rerouting_possible ? 'Possible' : 'Not possible'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Redundant paths</span>
                    <span className={topResult.redundant_paths_available ? 'text-green-400' : 'text-red-400'}>
                      {topResult.redundant_paths_available ? 'Available' : 'None'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Customers affected</span>
                    <span className="text-gray-200">{topResult.estimated_customers_affected || 0}</span>
                  </div>
                </>
              )}
            </div>
            {affectedDevs.length > 0 && (
              <div className="mt-3">
                <div className="text-[10px] text-gray-500 mb-1">Affected Devices:</div>
                {affectedDevs.map((d: string, i: number) => (
                  <div key={i} className="text-xs text-red-300 py-0.5">{d}</div>
                ))}
              </div>
            )}
          </div>

          {/* Classification */}
          {classResult && (
            <div className="noc-panel p-4">
              <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">Classification</div>
              <div className="space-y-1.5 text-xs">
                <div><span className="text-gray-500">Category: </span><span className="text-gray-200">{classResult.alarm_category}</span></div>
                <div><span className="text-gray-500">Subtype: </span><span className="text-gray-200">{classResult.alarm_subtype}</span></div>
                <div><span className="text-gray-500">Urgency: </span><span className="text-gray-200">{classResult.urgency}</span></div>
                <div><span className="text-gray-500">Service Affecting: </span>
                  <span className={classResult.is_service_affecting ? 'text-red-400' : 'text-green-400'}>
                    {classResult.is_service_affecting ? 'Yes' : 'No'}
                  </span>
                </div>
                <div><span className="text-gray-500">Confidence: </span><span className="text-gray-200">{((classResult.classification_confidence || 0) * 100).toFixed(0)}%</span></div>
              </div>
            </div>
          )}

          {/* Escalation */}
          {remResult?.escalation_required && (
            <div className="noc-panel p-4 border-orange-700/40">
              <div className="text-xs text-orange-400 font-semibold mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Escalation Required
              </div>
              <div className="text-xs text-gray-300">{remResult.escalation_team}</div>
              <div className="text-xs text-gray-500 mt-1">{remResult.escalation_reason}</div>
            </div>
          )}
        </div>
      </div>

      {/* Agent execution logs */}
      {logs.length > 0 && (
        <div className="noc-panel p-4">
          <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">Agent Execution Logs</div>
          <div className="space-y-2">
            {logs.map(log => (
              <div key={log.log_id} className="bg-[#0a0e1a] rounded border border-[#1e2d4a] p-3">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${log.execution_status === 'success' ? 'bg-green-400' : 'bg-red-400'}`} />
                  <span className="text-xs font-medium text-white capitalize">{log.agent_name.replace(/_/g, ' ')}</span>
                  <span className={`text-[10px] ml-auto ${log.execution_status === 'success' ? 'text-green-400' : 'text-red-400'}`}>{log.execution_status}</span>
                  {log.duration_ms && <span className="text-[10px] text-gray-500">{log.duration_ms}ms</span>}
                </div>
                {log.error_message && (
                  <div className="mt-1.5 text-xs text-red-400 pl-5">{log.error_message}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Raw results (collapsible debug) */}
      <details className="noc-panel p-4 cursor-pointer">
        <summary className="text-xs text-gray-500 hover:text-gray-300">Raw Agent Results (debug)</summary>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {classResult && <div><div className="text-[10px] text-gray-500 mb-1">Classification</div><JsonBlock data={classResult} /></div>}
          {rcaResult   && <div><div className="text-[10px] text-gray-500 mb-1">RCA</div><JsonBlock data={rcaResult} /></div>}
          {topResult   && <div><div className="text-[10px] text-gray-500 mb-1">Topology</div><JsonBlock data={topResult} /></div>}
          {remResult   && <div><div className="text-[10px] text-gray-500 mb-1">Remediation</div><JsonBlock data={remResult} /></div>}
        </div>
      </details>
    </div>
  );
}
