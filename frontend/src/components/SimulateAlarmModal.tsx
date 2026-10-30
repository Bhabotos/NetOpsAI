import { useState } from 'react';
import { useMutation, useQueryClient } from 'react-query';
import { simulateAlarm } from '../api/client';
import { X, Zap } from 'lucide-react';

// Must match device_name values in database/seed_data.sql
const DEVICE_NAMES = [
  'DHK-CORE-01', 'DHK-AGG-01', 'DHK-AGG-02', 'SYL-CO-01',
  'BAL-CO-01', 'RAJ-CORE-01', 'CTG-CORE-01', 'CTG-AGG-01',
  'DHK-DWDM-01', 'CTG-DWDM-01',
];

const ALARM_TYPES = [
  'LOS', 'LOF', 'High BER', 'Interface Down',
  'Device Unreachable', 'Optical Power Low', 'Card Failure',
];

const SEVERITIES = ['Critical', 'Major', 'Minor', 'Warning', 'Info'];

interface Props { onClose: () => void; }

export default function SimulateAlarmModal({ onClose }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    device_name:    DEVICE_NAMES[0],
    alarm_type:     ALARM_TYPES[0],
    severity:       'Critical',
    interface_name: '',
    description:    '',
  });
  const [result, setResult] = useState<string | null>(null);

  const mutation = useMutation(simulateAlarm, {
    onSuccess: (data) => {
      setResult(JSON.stringify(data, null, 2));
      qc.invalidateQueries('alarms');
      qc.invalidateQueries('incidents');
      qc.invalidateQueries('stats');
    },
    onError: (err: Error) => {
      setResult(`Error: ${err.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    mutation.mutate({
      device_name:    form.device_name,
      alarm_type:     form.alarm_type,
      severity:       form.severity,
      interface_name: form.interface_name || undefined,
      description:    form.description   || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="noc-panel w-full max-w-lg mx-4">
        <div className="noc-panel-header">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-semibold text-white">Simulate Network Alarm</span>
          </div>
          <button onClick={onClose} className="btn-ghost p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Device</label>
              <select
                className="input-field w-full"
                value={form.device_name}
                onChange={e => setForm(f => ({ ...f, device_name: e.target.value }))}
              >
                {DEVICE_NAMES.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Severity</label>
              <select
                className="input-field w-full"
                value={form.severity}
                onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}
              >
                {SEVERITIES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Alarm Type</label>
            <select
              className="input-field w-full"
              value={form.alarm_type}
              onChange={e => setForm(f => ({ ...f, alarm_type: e.target.value }))}
            >
              {ALARM_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Interface (optional)</label>
            <input
              className="input-field w-full"
              placeholder="e.g. GigabitEthernet0/0/1"
              value={form.interface_name}
              onChange={e => setForm(f => ({ ...f, interface_name: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Description (optional)</label>
            <textarea
              className="input-field w-full h-16 resize-none"
              placeholder="Additional alarm description..."
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={mutation.isLoading}>
              {mutation.isLoading ? 'Sending...' : 'Send Alarm'}
            </button>
          </div>
        </form>

        {result && (
          <div className="border-t border-[#1e2d4a] p-4">
            <p className="text-xs text-gray-400 mb-1">Response:</p>
            <pre className="text-xs text-green-300 bg-[#0a0e1a] p-3 rounded overflow-x-auto max-h-40">
              {result}
            </pre>
            {!result.startsWith('Error') && (
              <p className="text-xs text-gray-500 mt-2">
                ✅ Alarm sent. The n8n orchestrator will process it asynchronously. Check Alarms and Incidents pages in ~10–30 seconds.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
