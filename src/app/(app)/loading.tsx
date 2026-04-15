export default function AppLoading() {
  return (
    <div className="p-4 lg:p-6 space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-48 bg-slate-800 rounded-lg" />
          <div className="h-4 w-72 bg-slate-800/60 rounded mt-2" />
        </div>
      </div>
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-slate-800/50 rounded-xl border border-slate-700/50" />
        ))}
      </div>
      {/* Content blocks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-64 bg-slate-800/50 rounded-xl border border-slate-700/50" />
        <div className="h-64 bg-slate-800/50 rounded-xl border border-slate-700/50" />
      </div>
    </div>
  )
}
