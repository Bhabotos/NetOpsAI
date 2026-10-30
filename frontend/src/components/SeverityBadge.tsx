import clsx from 'clsx';

interface Props { severity: string; className?: string; }

const map: Record<string, string> = {
  Critical: 'badge-critical critical-pulse',
  Major:    'badge-major',
  Minor:    'badge-minor',
  Warning:  'badge-warning',
  Info:     'badge-info',
};

export default function SeverityBadge({ severity, className }: Props) {
  return (
    <span className={clsx(map[severity] || 'badge-info', className)}>
      {severity}
    </span>
  );
}
