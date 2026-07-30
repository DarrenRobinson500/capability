const COLORS: Record<string, string> = {
  SELF: 'bg-gray-100 text-gray-700',
  MANAGER_ENDORSED: 'bg-green-100 text-green-800',
  MANAGER_ADJUSTED: 'bg-blue-100 text-blue-800',
  ACTIVE: 'bg-green-100 text-green-800',
  EXPIRED: 'bg-red-100 text-red-800',
  PENDING_RENEWAL: 'bg-amber-100 text-amber-800',
  missing: 'bg-red-100 text-red-800',
  below_minimum: 'bg-amber-100 text-amber-800',
  vacant_requirement: 'bg-gray-200 text-gray-700',
};

export default function Badge({ value, label }: { value: string; label?: string }) {
  const classes = COLORS[value] ?? 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}>
      {label ?? value.replaceAll('_', ' ')}
    </span>
  );
}
