export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200/90 ${className}`} />;
}

export function ListRowSkeleton({ count = 5 }) {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="px-4 md:px-5 py-3.5 flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-4 w-2/5 max-w-[220px]" />
            <Skeleton className="h-3 w-1/3 max-w-[160px]" />
          </div>
          <Skeleton className="h-9 w-24 hidden sm:block" />
          <Skeleton className="h-9 w-9 shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function CardGridSkeleton({ count = 4 }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-slate-100 p-5 flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-slate-200 p-4">
          <Skeleton className="h-3 w-16 mb-3" />
          <Skeleton className="h-7 w-12" />
        </div>
      ))}
    </div>
  );
}

export function ResultsPageSkeleton() {
  return (
    <div className="space-y-4">
      <StatsSkeleton />
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 h-[280px]">
          <Skeleton className="h-4 w-40 mb-4" />
          <Skeleton className="h-[200px] w-full rounded-xl" />
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <Skeleton className="h-4 w-44" />
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b">
          <Skeleton className="h-4 w-28" />
        </div>
        <ListRowSkeleton count={6} />
      </div>
    </div>
  );
}

export function ExamPageSkeleton() {
  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-[#eef2f7]">
      <div className="bg-[#00448a] px-4 py-3 space-y-2">
        <Skeleton className="h-3 w-32 bg-white/20" />
        <Skeleton className="h-5 w-48 bg-white/25" />
      </div>
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 p-4 space-y-3">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-[60%] min-h-[240px] w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
        <div className="hidden sm:block w-56 p-4 space-y-2 border-l bg-white">
          <Skeleton className="h-4 w-24 mb-3" />
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full rounded-md" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
