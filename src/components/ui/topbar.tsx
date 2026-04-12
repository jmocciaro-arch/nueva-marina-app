'use client'

import { Bell, Search } from 'lucide-react'
import { useState } from 'react'

interface TopbarProps {
  title?: string
  showSearch?: boolean
}

export function Topbar({ title, showSearch = true }: TopbarProps) {
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 lg:px-6 bg-slate-900/80 backdrop-blur-lg border-b border-slate-700/50">
      <div className="flex items-center gap-4">
        <div className="lg:hidden w-10" /> {/* Space for mobile menu button */}
        {title && <h1 className="text-lg font-semibold text-white">{title}</h1>}
      </div>

      <div className="flex items-center gap-2">
        {showSearch && (
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <Search size={18} />
          </button>
        )}
        <button className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-cyan-500 rounded-full" />
        </button>
      </div>
    </header>
  )
}
