import { MapPin } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center bg-[#0b1120]">
      <div className="w-20 h-20 rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-6">
        <MapPin size={40} className="text-cyan-400" />
      </div>
      <h1 className="text-4xl font-bold text-white mb-2">404</h1>
      <p className="text-lg text-slate-400 mb-6">Esta página no existe en Nueva Marina</p>
      <div className="flex gap-3">
        <a
          href="/dashboard"
          className="inline-flex items-center px-5 py-2.5 rounded-lg bg-cyan-600 text-white font-medium hover:bg-cyan-500 transition-colors"
        >
          Ir al inicio
        </a>
      </div>
    </div>
  )
}
