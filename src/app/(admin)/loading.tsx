export default function AdminLoading() {
  return (
    <div className="p-4 lg:p-6 space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-56 bg-slate-800 rounded-lg" />
          <div className="h-4 w-80 bg-slate-800/60 rounded mt-2" />
        </div>
        <div className="h-9 w-32 bg-slate-800 rounded-lg" />
      </div>
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-20 bg-slate-800/50 rounded-xl border border-slate-700/50" />
        ))}
      </div>
      {/* Table skeleton */}
      <div className="rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="h-10 bg-slate-800/80" />
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-12 border-t border-slate-700/30 bg-slate-800/20" />
        ))}
      </div>
    </div>
  )
}
