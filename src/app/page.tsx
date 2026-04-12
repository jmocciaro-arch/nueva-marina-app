import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0b1120]">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0b1120]/80 backdrop-blur-lg border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-600 flex items-center justify-center text-white font-bold text-sm">
              NM
            </div>
            <span className="text-lg font-bold text-white">Nueva Marina</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#reservas" className="text-sm text-slate-400 hover:text-white transition-colors">Reservas</a>
            <a href="#torneos" className="text-sm text-slate-400 hover:text-white transition-colors">Torneos</a>
            <a href="#ligas" className="text-sm text-slate-400 hover:text-white transition-colors">Ligas</a>
            <a href="#gimnasio" className="text-sm text-slate-400 hover:text-white transition-colors">Gimnasio</a>
            <a href="#tienda" className="text-sm text-slate-400 hover:text-white transition-colors">Tienda</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Entrar</Button>
            </Link>
            <Link href="/login">
              <Button size="sm">Registrarse</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            Motril, Granada
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold text-white leading-tight">
            Tu club de padel.
            <br />
            <span className="text-cyan-400">Todo en un solo lugar.</span>
          </h1>
          <p className="mt-6 text-lg text-slate-400 max-w-2xl mx-auto">
            Reserva pistas, competi en torneos y ligas, entrena en el gimnasio,
            mejora tu juego con analisis inteligente y conecta con otros jugadores.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link href="/login">
              <Button size="lg">Reservar Pista</Button>
            </Link>
            <a href="#info">
              <Button variant="outline" size="lg">Conocer mas</Button>
            </a>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="info" className="py-20 px-4 border-t border-slate-800">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12">Todo lo que necesitas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: '🎾', title: 'Reservas', desc: '4 pistas disponibles de 08:00 a 00:00. Reserva online en segundos.' },
              { icon: '🏆', title: 'Torneos', desc: '10 formatos: Premier, Americano, Mexicano y mas. Inscripcion online.' },
              { icon: '⚽', title: 'Ligas', desc: 'Liga de Primavera, Nocturna, Mixta. Tablas de posiciones en tiempo real.' },
              { icon: '💪', title: 'Gimnasio', desc: 'Sala de fitness, clases grupales, rutinas personalizadas.' },
              { icon: '🛒', title: 'Tienda', desc: 'Palas, zapatillas, accesorios. Compra online o en el club.' },
              { icon: '📊', title: 'Ranking', desc: 'Sistema ELO. Subi de categoria jugando partidos competitivos.' },
              { icon: '🔍', title: 'Buscar Partido', desc: 'Encontra jugadores de tu nivel. Matching inteligente.' },
              { icon: '🎥', title: 'Video Analisis', desc: 'Subi tus videos y recibe analisis tecnico con IA.' },
              { icon: '🧠', title: 'IA Personal', desc: 'Recomendaciones de entrenamiento basadas en tu juego.' },
            ].map(f => (
              <div key={f.title} className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-6 hover:border-cyan-500/30 transition-colors">
                <span className="text-3xl">{f.icon}</span>
                <h3 className="mt-3 text-lg font-semibold text-white">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 border-t border-slate-800">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white">Empeza a jugar hoy</h2>
          <p className="mt-4 text-slate-400">
            Registrate gratis y reserva tu primera pista en menos de 1 minuto.
          </p>
          <div className="mt-8">
            <Link href="/login">
              <Button size="lg">Crear cuenta gratis</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-cyan-600 flex items-center justify-center text-white font-bold text-xs">NM</div>
            <span className="text-sm text-slate-400">Nueva Marina Padel & Sport</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-slate-500">
            <span>FALTA ENVIDO SL</span>
            <span>Motril, Granada</span>
            <a href="https://www.nuevamarina.es" className="hover:text-cyan-400">nuevamarina.es</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
