'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Package,
  Plus,
  ShoppingBag,
  AlertTriangle,
  TrendingUp,
  Pencil,
  Trash2,
  Star,
  CheckCircle,
  XCircle,
  FolderTree,
  Edit2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { KpiCard } from '@/components/ui/kpi-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { formatCurrency } from '@/lib/utils'
import type { Product, ProductCategory } from '@/types'

// ─── Constantes ────────────────────────────────────────────────────────────────

const CLUB_ID = 1

const CATEGORIAS = [
  { value: 'todos', label: 'Todos' },
  { value: 'Palas', label: 'Palas' },
  { value: 'Zapatillas', label: 'Zapatillas' },
  { value: 'Accesorios', label: 'Accesorios' },
  { value: 'Pelotas', label: 'Pelotas' },
  { value: 'Textil', label: 'Textil' },
  { value: 'Otros', label: 'Otros' },
]

const CATEGORIAS_FORM = CATEGORIAS.filter(c => c.value !== 'todos')

const FORM_EMPTY = {
  name: '',
  category: 'Palas',
  brand: '',
  description: '',
  price: '',
  cost: '',
  tax_rate: '21',
  sku: '',
  stock: '0',
  min_stock: '3',
  is_active: true,
  is_featured: false,
}

type FormState = typeof FORM_EMPTY

// ─── Componente principal ──────────────────────────────────────────────────────

export default function GestionTiendaPage() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<'productos' | 'categorias'>('productos')

  // Estado principal
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [categoriaActiva, setCategoriaActiva] = useState('todos')

  // Categorías dinámicas
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [catModalOpen, setCatModalOpen] = useState(false)
  const [catSaving, setCatSaving] = useState(false)
  const [editCatId, setEditCatId] = useState<number | null>(null)
  const [catName, setCatName] = useState('')
  const [catSlug, setCatSlug] = useState('')
  const [catSort, setCatSort] = useState('0')
  const [catActive, setCatActive] = useState(true)

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [form, setForm] = useState<FormState>(FORM_EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // ─── Carga de datos ───────────────────────────────────────────────────────────

  const loadProducts = useCallback(async () => {
    const supabase = createClient()
    setLoading(true)
    const { data, error } = await supabase
      .from('nm_products')
      .select('*')
      .eq('club_id', CLUB_ID)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    if (error) {
      toast('error', 'Error al cargar los productos')
    } else {
      setProducts((data as Product[]) ?? [])
    }
    setLoading(false)
  }, [toast])

  const loadCategories = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('nm_product_categories')
      .select('*')
      .eq('club_id', CLUB_ID)
      .order('sort_order')
      .order('name')
    setCategories((data || []) as ProductCategory[])
  }, [])

  useEffect(() => {
    loadProducts()
    loadCategories()
  }, [loadProducts, loadCategories])

  // ─── KPIs ─────────────────────────────────────────────────────────────────────

  const totalProductos = products.length
  const productosActivos = products.filter(p => p.is_active).length
  const bajoStock = products.filter(p => p.stock <= p.min_stock && p.is_active).length
  const valorStock = products.reduce((acc, p) => acc + p.stock * (p.cost ?? p.price), 0)

  // ─── Filtrado ─────────────────────────────────────────────────────────────────

  const productosFiltrados =
    categoriaActiva === 'todos'
      ? products
      : products.filter(p => p.category === categoriaActiva)

  // ─── Helpers de formulario ────────────────────────────────────────────────────

  function abrirCrear() {
    setEditProduct(null)
    setForm(FORM_EMPTY)
    setConfirmDelete(false)
    setModalOpen(true)
  }

  function abrirEditar(p: Product) {
    setEditProduct(p)
    setForm({
      name: p.name,
      category: p.category ?? 'Otros',
      brand: p.brand ?? '',
      description: p.description ?? '',
      price: String(p.price),
      cost: p.cost !== undefined && p.cost !== null ? String(p.cost) : '',
      tax_rate: String(p.tax_rate),
      sku: p.sku ?? '',
      stock: String(p.stock),
      min_stock: String(p.min_stock),
      is_active: p.is_active,
      is_featured: p.is_featured,
    })
    setConfirmDelete(false)
    setModalOpen(true)
  }

  function cerrarModal() {
    setModalOpen(false)
    setEditProduct(null)
    setConfirmDelete(false)
  }

  function handleFormChange(field: keyof FormState, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function buildPayload() {
    return {
      club_id: CLUB_ID,
      name: form.name.trim(),
      category: form.category,
      brand: form.brand.trim() || null,
      description: form.description.trim() || null,
      price: parseFloat(form.price) || 0,
      cost: form.cost !== '' ? parseFloat(form.cost) : null,
      tax_rate: parseFloat(form.tax_rate) || 21,
      sku: form.sku.trim() || null,
      stock: parseInt(form.stock) || 0,
      min_stock: parseInt(form.min_stock) || 0,
      is_active: form.is_active,
      is_featured: form.is_featured,
    }
  }

  // ─── Guardar (crear / editar) ─────────────────────────────────────────────────

  async function handleGuardar() {
    if (!form.name.trim()) {
      toast('warning', 'El nombre del producto es obligatorio')
      return
    }
    if (!form.price || parseFloat(form.price) <= 0) {
      toast('warning', 'El precio debe ser mayor a 0')
      return
    }

    const supabase = createClient()
    setSaving(true)

    if (editProduct) {
      const { error } = await supabase
        .from('nm_products')
        .update(buildPayload())
        .eq('id', editProduct.id)

      if (error) {
        toast('error', 'No se pudo actualizar el producto')
      } else {
        toast('success', 'Producto actualizado correctamente')
        cerrarModal()
        loadProducts()
      }
    } else {
      const { error } = await supabase
        .from('nm_products')
        .insert(buildPayload())

      if (error) {
        toast('error', 'No se pudo crear el producto')
      } else {
        toast('success', 'Producto creado correctamente')
        cerrarModal()
        loadProducts()
      }
    }

    setSaving(false)
  }

  // ─── Eliminar ─────────────────────────────────────────────────────────────────

  async function handleEliminar() {
    if (!editProduct) return
    const supabase = createClient()
    setDeleting(true)

    const { error } = await supabase
      .from('nm_products')
      .delete()
      .eq('id', editProduct.id)

    if (error) {
      toast('error', 'No se pudo eliminar el producto')
    } else {
      toast('success', 'Producto eliminado')
      cerrarModal()
      loadProducts()
    }
    setDeleting(false)
  }

  // ─── Categorías CRUD ───────────────────────────────────────────────────────────

  function resetCatForm() {
    setEditCatId(null); setCatName(''); setCatSlug(''); setCatSort('0'); setCatActive(true)
  }

  function openEditCat(c: ProductCategory) {
    setEditCatId(c.id); setCatName(c.name); setCatSlug(c.slug || ''); setCatSort(String(c.sort_order)); setCatActive(c.is_active)
    setCatModalOpen(true)
  }

  async function handleSaveCat(e: React.FormEvent) {
    e.preventDefault()
    if (!catName.trim()) return
    setCatSaving(true)
    const supabase = createClient()
    const payload = {
      club_id: CLUB_ID,
      name: catName.trim(),
      slug: catSlug.trim() || catName.trim().toLowerCase().replace(/\s+/g, '-'),
      sort_order: parseInt(catSort) || 0,
      is_active: catActive,
    }
    const { error } = editCatId
      ? await supabase.from('nm_product_categories').update(payload).eq('id', editCatId)
      : await supabase.from('nm_product_categories').insert(payload)
    if (error) toast('error', 'Error: ' + error.message)
    else { toast('success', editCatId ? 'Categoría actualizada' : 'Categoría creada'); resetCatForm(); setCatModalOpen(false); loadCategories() }
    setCatSaving(false)
  }

  async function handleDeleteCat(id: number) {
    if (!confirm('¿Eliminar esta categoría?')) return
    const supabase = createClient()
    const { error } = await supabase.from('nm_product_categories').delete().eq('id', id)
    if (error) toast('error', 'Error: ' + error.message)
    else { toast('info', 'Categoría eliminada'); loadCategories() }
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Gestión de Tienda</h1>
          <p className="text-sm text-slate-400 mt-1">Productos e inventario del local</p>
        </div>
        {activeTab === 'productos' ? (
          <Button onClick={abrirCrear}>
            <Plus size={16} />
            Nuevo producto
          </Button>
        ) : (
          <Button onClick={() => { resetCatForm(); setCatModalOpen(true) }}>
            <Plus size={16} />
            Nueva categoría
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800/50 p-1 rounded-lg w-fit">
        <button onClick={() => setActiveTab('productos')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'productos' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}>
          <Package size={16} /> Productos
        </button>
        <button onClick={() => setActiveTab('categorias')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'categorias' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}>
          <FolderTree size={16} /> Categorías
        </button>
      </div>

      {activeTab === 'productos' && <div className="contents">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          title="Total productos"
          value={totalProductos}
          icon={<Package size={20} />}
          color="#06b6d4"
        />
        <KpiCard
          title="Productos activos"
          value={productosActivos}
          icon={<ShoppingBag size={20} />}
          color="#10b981"
        />
        <KpiCard
          title="Bajo stock"
          value={bajoStock}
          subtitle="por debajo del mínimo"
          icon={<AlertTriangle size={20} />}
          color={bajoStock > 0 ? '#f59e0b' : '#64748b'}
        />
        <KpiCard
          title="Valor del stock"
          value={formatCurrency(valorStock)}
          icon={<TrendingUp size={20} />}
          color="#8b5cf6"
        />
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
              className="h-48 rounded-xl bg-slate-800/50 animate-pulse border border-slate-700/50"
            />
          ))}
        </div>
      ) : productosFiltrados.length === 0 ? (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-12 text-center">
          <Package size={40} className="mx-auto text-slate-600 mb-3" />
          <p className="text-slate-400">
            {categoriaActiva === 'todos'
              ? 'No hay productos cargados todavía'
              : `No hay productos en la categoría "${categoriaActiva}"`}
          </p>
          <Button className="mt-4" size="sm" onClick={abrirCrear}>
            <Plus size={14} />
            Agregar producto
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {productosFiltrados.map(p => (
            <ProductCard key={p.id} product={p} onClick={() => abrirEditar(p)} />
          ))}
        </div>
      )}
      </div>}

      {activeTab === 'categorias' && (
        <>
          {categories.length === 0 ? (
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-12 text-center">
              <FolderTree size={40} className="mx-auto text-slate-600 mb-3" />
              <p className="text-slate-400">No hay categorías creadas</p>
              <Button className="mt-4" size="sm" onClick={() => { resetCatForm(); setCatModalOpen(true) }}>
                <Plus size={14} /> Nueva categoría
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map(c => (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
                  <div className="w-10 h-10 rounded-lg bg-cyan-600/10 flex items-center justify-center">
                    <FolderTree size={18} className="text-cyan-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{c.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {c.slug && <span className="text-[10px] text-slate-500 font-mono">{c.slug}</span>}
                      <Badge variant={c.is_active ? 'success' : 'default'}>{c.is_active ? 'Activa' : 'Inactiva'}</Badge>
                      <span className="text-[10px] text-slate-600">Orden: {c.sort_order}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEditCat(c)} className="p-1.5 rounded text-slate-500 hover:text-yellow-400 hover:bg-yellow-500/10"><Edit2 size={14} /></button>
                    <button onClick={() => handleDeleteCat(c.id)} className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Category Modal */}
          <Modal
            open={catModalOpen}
            onClose={() => { setCatModalOpen(false); resetCatForm() }}
            title={editCatId ? 'Editar Categoría' : 'Nueva Categoría'}
            footer={
              <div className="flex items-center gap-3">
                <Button variant="ghost" onClick={() => { setCatModalOpen(false); resetCatForm() }}>Cancelar</Button>
                <Button onClick={handleSaveCat} loading={catSaving}>{editCatId ? 'Guardar' : 'Crear'}</Button>
              </div>
            }
          >
            <form onSubmit={handleSaveCat} className="space-y-4">
              <Input label="Nombre" value={catName} onChange={e => setCatName(e.target.value)} placeholder="Ej: Palas" required />
              <Input label="Slug" value={catSlug} onChange={e => setCatSlug(e.target.value)} placeholder="Ej: palas" />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Orden" type="number" value={catSort} onChange={e => setCatSort(e.target.value)} />
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={catActive} onChange={e => setCatActive(e.target.checked)} className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-cyan-600" />
                    <span className="text-sm text-slate-300">Activa</span>
                  </label>
                </div>
              </div>
            </form>
          </Modal>
        </>
      )}

      {/* Modal crear / editar */}
      <Modal
        open={modalOpen}
        onClose={cerrarModal}
        title={editProduct ? 'Editar producto' : 'Nuevo producto'}
        size="lg"
        footer={
          <div className="flex w-full items-center justify-between">
            <div>
              {editProduct && !confirmDelete && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 size={14} />
                  Eliminar
                </Button>
              )}
              {editProduct && confirmDelete && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-400">¿Confirmás la eliminación?</span>
                  <Button
                    variant="danger"
                    size="sm"
                    loading={deleting}
                    onClick={handleEliminar}
                  >
                    Sí, eliminar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDelete(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={cerrarModal}>
                Cancelar
              </Button>
              <Button loading={saving} onClick={handleGuardar}>
                {editProduct ? 'Guardar cambios' : 'Crear producto'}
              </Button>
            </div>
          </div>
        }
      >
        <ProductForm form={form} onChange={handleFormChange} />
      </Modal>
    </div>
  )
}

// ─── Sub-componente: tarjeta de producto ──────────────────────────────────────

function ProductCard({ product: p, onClick }: { product: Product; onClick: () => void }) {
  const isLowStock = p.stock <= p.min_stock

  return (
    <button
      onClick={onClick}
      className="group text-left w-full rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 hover:border-cyan-500/40 hover:bg-slate-800 transition-all"
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate group-hover:text-cyan-400 transition-colors">
            {p.name}
          </p>
          {p.brand && (
            <p className="text-xs text-slate-500 truncate">{p.brand}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {p.is_featured && (
            <Star size={14} className="text-amber-400 fill-amber-400" />
          )}
          {p.is_active ? (
            <CheckCircle size={14} className="text-green-400" />
          ) : (
            <XCircle size={14} className="text-slate-600" />
          )}
        </div>
      </div>

      {/* Categoría */}
      {p.category && (
        <div className="mb-3">
          <Badge variant="info">{p.category}</Badge>
        </div>
      )}

      {/* Precio */}
      <p className="text-lg font-bold text-white mb-3">
        {formatCurrency(p.price)}
      </p>

      {/* Stock */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {isLowStock && p.is_active ? (
            <AlertTriangle size={13} className="text-amber-400 shrink-0" />
          ) : null}
          <span className="text-xs text-slate-400">
            Stock: <span className={isLowStock && p.is_active ? 'text-amber-400 font-semibold' : 'text-slate-300'}>
              {p.stock}
            </span>
            {' '}/ mín. {p.min_stock}
          </span>
        </div>
        {isLowStock && p.is_active && (
          <Badge variant="warning">Bajo stock</Badge>
        )}
      </div>

      {/* Editar hint */}
      <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center gap-1 text-xs text-slate-600 group-hover:text-cyan-500 transition-colors">
        <Pencil size={11} />
        Editar
      </div>
    </button>
  )
}

// ─── Sub-componente: formulario ────────────────────────────────────────────────

function ProductForm({
  form,
  onChange,
}: {
  form: FormState
  onChange: (field: keyof FormState, value: string | boolean) => void
}) {
  return (
    <div className="space-y-4">
      {/* Fila 1: nombre y marca */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          id="name"
          label="Nombre *"
          placeholder="Ej: Adidas Metalbone 3.3"
          value={form.name}
          onChange={e => onChange('name', e.target.value)}
        />
        <Input
          id="brand"
          label="Marca"
          placeholder="Ej: Adidas"
          value={form.brand}
          onChange={e => onChange('brand', e.target.value)}
        />
      </div>

      {/* Fila 2: categoría y SKU */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          id="category"
          label="Categoría"
          value={form.category}
          options={CATEGORIAS_FORM}
          onChange={e => onChange('category', e.target.value)}
        />
        <Input
          id="sku"
          label="SKU / Código"
          placeholder="Ej: PAL-001"
          value={form.sku}
          onChange={e => onChange('sku', e.target.value)}
        />
      </div>

      {/* Descripción */}
      <div className="space-y-1">
        <label htmlFor="description" className="block text-sm font-medium text-slate-300">
          Descripción
        </label>
        <textarea
          id="description"
          rows={3}
          placeholder="Descripción del producto..."
          value={form.description}
          onChange={e => onChange('description', e.target.value)}
          className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 resize-none"
        />
      </div>

      {/* Fila 3: precio, costo, IVA */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Input
          id="price"
          label="Precio de venta *"
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={form.price}
          onChange={e => onChange('price', e.target.value)}
        />
        <Input
          id="cost"
          label="Costo"
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={form.cost}
          onChange={e => onChange('cost', e.target.value)}
        />
        <Select
          id="tax_rate"
          label="IVA (%)"
          value={form.tax_rate}
          options={[
            { value: '0', label: '0% — Exento' },
            { value: '4', label: '4% — Superreducido' },
            { value: '10', label: '10% — Reducido' },
            { value: '21', label: '21% — General' },
          ]}
          onChange={e => onChange('tax_rate', e.target.value)}
        />
      </div>

      {/* Fila 4: stock y stock mínimo */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          id="stock"
          label="Stock actual"
          type="number"
          min="0"
          step="1"
          value={form.stock}
          onChange={e => onChange('stock', e.target.value)}
        />
        <Input
          id="min_stock"
          label="Stock mínimo"
          type="number"
          min="0"
          step="1"
          value={form.min_stock}
          onChange={e => onChange('min_stock', e.target.value)}
        />
      </div>

      {/* Switches: activo y destacado */}
      <div className="flex flex-wrap gap-6 pt-1">
        <ToggleSwitch
          id="is_active"
          label="Producto activo"
          checked={form.is_active}
          onChange={v => onChange('is_active', v)}
        />
        <ToggleSwitch
          id="is_featured"
          label="Destacado"
          checked={form.is_featured}
          onChange={v => onChange('is_featured', v)}
        />
      </div>
    </div>
  )
}

// ─── Sub-componente: toggle ────────────────────────────────────────────────────

function ToggleSwitch({
  id,
  label,
  checked,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-2.5 cursor-pointer select-none">
      <div
        className={[
          'relative w-10 h-5 rounded-full transition-colors',
          checked ? 'bg-cyan-600' : 'bg-slate-600',
        ].join(' ')}
      >
        <input
          id={id}
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
        />
        <span
          className={[
            'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0',
          ].join(' ')}
        />
      </div>
      <span className="text-sm text-slate-300">{label}</span>
    </label>
  )
}
