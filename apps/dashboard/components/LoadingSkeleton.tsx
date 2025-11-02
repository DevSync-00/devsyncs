export function ProjectCardSkeleton() {
  return (
    <div className="p-6 bg-card border border-border rounded-lg animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="w-8 h-8 bg-muted rounded" />
        <div className="w-16 h-6 bg-muted rounded" />
      </div>
      <div className="h-6 bg-muted rounded mb-2 w-3/4" />
      <div className="h-4 bg-muted rounded w-1/2 mb-4" />
      <div className="flex items-center gap-4">
        <div className="h-4 bg-muted rounded w-24" />
        <div className="h-4 bg-muted rounded w-20" />
      </div>
    </div>
  );
}

export function ScanReportSkeleton() {
  return (
    <div className="p-6 bg-card border border-border rounded-lg animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 bg-muted rounded" />
          <div>
            <div className="h-5 bg-muted rounded w-48 mb-2" />
            <div className="h-4 bg-muted rounded w-32" />
          </div>
        </div>
        <div className="w-16 h-6 bg-muted rounded" />
      </div>
      <div className="h-4 bg-muted rounded w-32 mt-4" />
    </div>
  );
}

export function MigrationCardSkeleton() {
  return (
    <div className="p-6 bg-card border border-border rounded-lg animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 bg-muted rounded" />
          <div>
            <div className="h-6 bg-muted rounded w-48 mb-2" />
            <div className="h-4 bg-muted rounded w-32" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-20 h-9 bg-muted rounded" />
          <div className="w-24 h-9 bg-muted rounded" />
        </div>
      </div>
      <div className="h-32 bg-muted rounded" />
    </div>
  );
}

export function TableRowSkeleton() {
  return (
    <tr className="animate-pulse">
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-muted rounded-full" />
          <div>
            <div className="h-4 bg-muted rounded w-32 mb-2" />
            <div className="h-3 bg-muted rounded w-20" />
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="h-4 bg-muted rounded w-20" />
      </td>
      <td className="px-6 py-4">
        <div className="h-4 bg-muted rounded w-24" />
      </td>
    </tr>
  );
}

export function StatsCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-lg p-6 flex items-center space-x-4 animate-pulse">
      <div className="w-8 h-8 bg-muted rounded" />
      <div className="flex-1">
        <div className="h-4 bg-muted rounded w-24 mb-2" />
        <div className="h-8 bg-muted rounded w-16" />
      </div>
    </div>
  );
}

