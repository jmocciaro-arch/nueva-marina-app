'use client'

import { useCallback, useEffect, useState } from 'react'
import { ShoppingBag, Star, Package, Search, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { formatCurrency } from '@/lib/utils'
import type { Product } from '@/types'

// ─── Constantes ────────────────────────────────────────────────────────────────

const CLUB_ID = 1

const CATEGORIAS = [
  { value: 'todos', label: 'Todos' },
  { value: 'Palas', label: 'Palas' },
  { value: 'Zapatillas', label: 'Zapatillas' },
  { value: 'Accesorios', label: 'Accesorios' },
  { value: 'Pelotas', label: 'Pelotas' },
  { value: 'Textil', label: 'Textil' },
]

// ─── Componente principal ──────────────────────────────────────────────────────

export default function TiendaPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [categoriaActiva, setCategoriaActiva] = useState('todos')
  const [busqueda, setBusqueda] = useState('')
  const [productoSeleccionado, setProductoSeleccionado] = useState<Product | null>(null)

  // ─── Carga de datos ─────────────────────────────────────────────────────────

  const loadProducts = useCallback(async () => {
    const supabase = createClient()
    setLoading(true)
    const { data } = await supabase
      .from('nm_products')
      .select('*')
      .eq('club_id', CLUB_ID)
      .eq('is_active', true)
      .order('is_featured', { ascending: false })
      .order('name', { ascending: true })

    setProducts((data as Product[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  // ─── Filtrado ────────────────────────────────────────────────────────────────

  const productosFiltrados = products.filter(p => {
    const coincideCategoria =
      categoriaActiva === 'todos' || p.category === categoriaActiva
    const terminoBusqueda = busqueda.toLowerCase().trim()
    const coincideBusqueda =
      terminoBusqueda === '' ||
      p.name.toLowerCase().includes(terminoBusqueda) ||
      (p.brand?.toLowerCase().includes(terminoBusqueda) ?? false)
    return coincideCategoria && coincideBusqueda
  })

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Tienda</h1>
        <p className="text-sm text-slate-400 mt-1">
          Productos y equipamiento disponible en el club
        </p>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
        />
        <input
          type="text"
          placeholder="Buscar por nombre o marca..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="w-full rounded-lg border border-slate-600 bg-slate-800 pl-9 pr-9 py-2.5 text-sm text-white placeholder-slate-500 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500"
        />
        {busqueda && (
          <button
            onClick={() => setBusqueda('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
            aria-label="Limpiar búsqueda"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Filtros por categoría */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIAS.map(cat => (
          <button
            key={cat.value}
            onClick={() => setCategoriaActiva(cat.value)}
            className={[
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              categoriaActiva === cat.value
                ? 'bg-cyan-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white',
            ].join(' ')}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Grid de productos */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="h-52 rounded-xl bg-slate-800/50 animate-pulse border border-slate-700/50"
            />
          ))}
        </div>
      ) : productosFiltrados.length === 0 ? (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-12 text-center">
          <Package size={40} className="mx-auto text-slate-600 mb-3" />
          <p className="text-slate-400">
            {busqueda
              ? `No se encontraron productos para "${busqueda}"`
              : categoriaActiva === 'todos'
              ? 'No hay productos disponibles por el momento'
              : `No hay productos en la categoría "${categoriaActiva}"`}
          </p>
          {(busqueda || categoriaActiva !== 'todos') && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-4"
              onClick={() => {
                setBusqueda('')
                setCategoriaActiva('todos')
              }}
            >
              Ver todos los productos
            </Button>
          )}
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-500">
            {productosFiltrados.length}{' '}
            {productosFiltrados.length === 1 ? 'producto' : 'productos'}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {productosFiltrados.map(p => (
              <ProductCard
                key={p.id}
                product={p}
                onClick={() => setProductoSeleccionado(p)}
              />
            ))}
          </div>
        </>
      )}

      {/* Modal de detalle */}
      <Modal
        open={productoSeleccionado !== null}
        onClose={() => setProductoSeleccionado(null)}
        title={productoSeleccionado?.name ?? ''}
        size="md"
        footer={
          <Button variant="secondary" onClick={() => setProductoSeleccionado(null)}>
            Cerrar
          </Button>
        }
      >
        {productoSeleccionado && (
          <ProductDetail product={productoSeleccionado} />
        )}
      </Modal>
    </div>
  )
}

// ─── Sub-componente: tarjeta ──────────────────────────────────────────────────

function ProductCard({
  product: p,
  onClick,
}: {
  product: Product
  onClick: () => void
}) {
  const enStock = p.stock > 0

  return (
    <button
      onClick={onClick}
      className="group text-left w-full rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 hover:border-cyan-500/40 hover:bg-slate-800 transition-all"
    >
      {/* Imagen placeholder o ícono */}
      <div className="w-full h-28 rounded-lg bg-slate-700/50 flex items-center justify-center mb-3 overflow-hidden">
        {p.images && p.images.length > 0 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.images[0]}
            alt={p.name}
            className="w-full h-full object-contain p-2"
          />
        ) : (
          <ShoppingBag size={32} className="text-slate-600" />
        )}
      </div>

      {/* Badges superiores */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        {p.is_featured && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400">
            <Star size={10} className="fill-amber-400" />
            Destacado
          </span>
        )}
        {p.category && (
          <Badge variant="info">{p.category}</Badge>
        )}
      </div>

      {/* Nombre y marca */}
      <p className="text-sm font-semibold text-white group-hover:text-cyan-400 transition-colors leading-snug">
        {p.name}
      </p>
      {p.brand && (
        <p className="text-xs text-slate-500 mt-0.5">{p.brand}</p>
      )}

      {/* Precio */}
      <p className="text-base font-bold text-white mt-2">
        {formatCurrency(p.price)}
      </p>

      {/* Disponibilidad */}
      <div className="mt-2">
        {enStock ? (
          <Badge variant="success">En stock</Badge>
        ) : (
          <Badge variant="danger">Agotado</Badge>
        )}
      </div>
    </button>
  )
}

// ─── Sub-componente: detalle en modal ─────────────────────────────────────────

function ProductDetail({ product: p }: { product: Product }) {
  const enStock = p.stock > 0
  const specs = p.specs && typeof p.specs === 'object' ? Object.entries(p.specs) : []

  return (
    <div className="space-y-5">
      {/* Imagen */}
      {p.images && p.images.length > 0 && (
        <div className="w-full h-48 rounded-lg bg-slate-700/40 flex items-center justify-center overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={p.images[0]}
            alt={p.name}
            className="w-full h-full object-contain p-3"
          />
        </div>
      )}

      {/* Encabezado */}
      <div className="flex items-start justify-between gap-3">
        <div>
          {p.brand && (
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{p.brand}</p>
          )}
          <h3 className="text-lg font-semibold text-white">{p.name}</h3>
        </div>
        <p className="text-xl font-bold text-cyan-400 shrink-0">
          {formatCurrency(p.price)}
        </p>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-2">
        {p.category && <Badge variant="info">{p.category}</Badge>}
        {p.is_featured && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400">
            <Star size={10} className="fill-amber-400" />
            Destacado
          </span>
        )}
        {enStock ? (
          <Badge variant="success">En stock</Badge>
        ) : (
          <Badge variant="danger">Agotado</Badge>
        )}
      </div>

      {/* Descripción */}
      {p.description && (
        <div>
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Descripción
          </h4>
          <p className="text-sm text-slate-300 leading-relaxed">{p.description}</p>
        </div>
      )}

      {/* Specs */}
      {specs.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Especificaciones
          </h4>
          <div className="rounded-lg border border-slate-700/50 overflow-hidden">
            {specs.map(([key, val], idx) => (
              <div
                key={key}
                className={[
                  'flex items-center justify-between px-3 py-2 text-sm',
                  idx % 2 === 0 ? 'bg-slate-800/60' : 'bg-slate-800/30',
                ].join(' ')}
              >
                <span className="text-slate-400 capitalize">{key.replace(/_/g, ' ')}</span>
                <span className="text-white font-medium">{String(val)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info de stock (solo si está disponible, sin revelar cantidad exacta) */}
      {!enStock && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3">
          <p className="text-sm text-red-400">
            Este producto no está disponible en este momento. Consultá con el staff del club para más información.
          </p>
        </div>
      )}
    </div>
  )
}
