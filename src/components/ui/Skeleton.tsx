/**
 * Loading placeholders shaped like the real screens, shown instantly by each route's loading.tsx
 * while the server fetches data (and by lazy charts while their code downloads).
 */

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-slate-200/70 ${className}`} aria-hidden />;
}

function Status({ label }: { label: string }) {
  return (
    <span className="sr-only" role="status">
      {label}
    </span>
  );
}

/** Page title + action buttons. */
function HeaderSkeleton({ actions = 2 }: { actions?: number }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
      <div className="space-y-2">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-3 w-72 max-w-[80vw]" />
      </div>
      <div className="flex gap-2 self-end sm:self-auto">
        {Array.from({ length: actions }, (_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/** List screens: header, filter bar, table rows (cards on phones), pagination. */
export function TablePageSkeleton({ rows = 8, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-4">
      <Status label="Loading list" />
      <HeaderSkeleton />
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex flex-wrap gap-2 p-3 border-b border-slate-100">
          <Skeleton className="h-9 w-full sm:w-72 rounded-lg" />
          <Skeleton className="h-9 w-36 rounded-lg hidden sm:block" />
          <Skeleton className="h-9 w-36 rounded-lg hidden sm:block" />
        </div>
        <div className="hidden md:grid gap-4 px-4 py-2.5 bg-head border-b border-slate-100" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }, (_, i) => (
            <Skeleton key={i} className="h-3 w-3/5" />
          ))}
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from({ length: rows }, (_, r) => (
            <div key={r} className="px-4 py-3">
              <div className="hidden md:grid gap-4 items-center" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
                {Array.from({ length: columns }, (_, c) => (
                  <Skeleton key={c} className={`h-3.5 ${c === 0 ? "w-4/5" : c % 2 ? "w-1/2" : "w-2/3"}`} />
                ))}
              </div>
              <div className="md:hidden space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <div className="grid grid-cols-2 gap-2">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between p-3 border-t border-slate-100">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-8 w-40 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function KpiSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-2.5 w-20" />
        </div>
      ))}
    </div>
  );
}

/** Chart-shaped placeholder (bars rising from an axis). */
export function ChartSkeleton({ height = "h-60" }: { height?: string }) {
  const bars = [45, 70, 35, 80, 55, 90, 40, 65, 75, 50, 85, 60];
  return (
    <div className={`${height} w-full flex items-end gap-2 px-2 pb-6 border-b border-l border-slate-100`} aria-hidden>
      {bars.map((h, i) => (
        <div key={i} className="flex-1 animate-pulse rounded-t bg-slate-200/70" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

function PanelSkeleton({ className = "", chart = false, lines = 5 }: { className?: string; chart?: boolean; lines?: number }) {
  return (
    <div className={`bg-white border border-slate-200 rounded-xl p-4 space-y-4 ${className}`}>
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-56 max-w-full" />
      </div>
      {chart ? (
        <ChartSkeleton />
      ) : (
        <div className="space-y-3">
          {Array.from({ length: lines }, (_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex justify-between gap-3">
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Dashboards: filters, KPI tiles, chart + side panels. */
export function DashboardSkeleton({ kpis = 9 }: { kpis?: number }) {
  return (
    <div className="space-y-4">
      <Status label="Loading dashboard" />
      <HeaderSkeleton actions={0} />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-lg" />
        ))}
      </div>
      <KpiSkeleton count={kpis} />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <PanelSkeleton className="xl:col-span-2" chart />
        <PanelSkeleton />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <PanelSkeleton className="xl:col-span-2" lines={6} />
        <PanelSkeleton />
      </div>
    </div>
  );
}

/** Detail screens (order, product, expense …): header card, tiles, main table + side cards. */
export function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <Status label="Loading details" />
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-64 max-w-full" />
          </div>
          <Skeleton className="h-8 w-28 rounded-lg hidden sm:block" />
        </div>
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <Skeleton className="h-7 w-7 rounded-full" />
              <Skeleton className="h-2.5 w-14" />
            </div>
          ))}
        </div>
      </div>
      <KpiSkeleton count={4} />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <PanelSkeleton className="xl:col-span-2" lines={4} />
        <PanelSkeleton lines={4} />
      </div>
    </div>
  );
}

/** Create / edit pages. */
export function FormSkeleton({ sections = 3 }: { sections?: number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl">
      <Status label="Loading form" />
      <div className="flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-slate-100">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-64 max-w-[60vw]" />
        </div>
      </div>
      <div className="p-4 sm:p-6 space-y-8">
        {Array.from({ length: sections }, (_, s) => (
          <div key={s} className="space-y-4">
            <Skeleton className="h-3 w-32" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-9 w-full rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 px-4 sm:px-6 py-4 border-t border-slate-100">
        <Skeleton className="h-9 w-20 rounded-lg" />
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
    </div>
  );
}
