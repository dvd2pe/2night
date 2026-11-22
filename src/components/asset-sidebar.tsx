'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Download, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  Asset,
  AssetManifest,
  AssetType,
  TYPE_ICONS,
  TYPE_LABELS,
  downloadJson,
  formatBytes,
} from '@/lib/asset-types'

interface Props {
  manifest: AssetManifest
  selected: Asset | null
  onSelect: (a: Asset) => void
  onClose?: () => void
}

const TYPE_ORDER: AssetType[] = ['image', 'audio', 'font', 'text']

export function AssetSidebar({ manifest, selected, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [types, setTypes] = useState<Set<AssetType>>(new Set())
  const [screenId, setScreenId] = useState('all')
  const [openGroups, setOpenGroups] = useState<Set<AssetType>>(
    new Set(TYPE_ORDER),
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return manifest.assets.filter((a) => {
      if (types.size > 0 && !types.has(a.type)) return false
      if (screenId !== 'all' && !a.screens.includes(screenId)) return false
      if (q && !`${a.path} ${a.note} ${a.role}`.toLowerCase().includes(q))
        return false
      return true
    })
  }, [manifest, query, types, screenId])

  const byType = useMemo(() => {
    const groups = new Map<AssetType, Asset[]>()
    for (const a of filtered) {
      if (!groups.has(a.type)) groups.set(a.type, [])
      groups.get(a.type)!.push(a)
    }
    return groups
  }, [filtered])

  const toggleType = (t: AssetType) => {
    setTypes((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }

  const toggleGroup = (t: AssetType) => {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-r border-zinc-800 bg-zinc-900">
      {/* Intestazione */}
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-zinc-100">
            Asset · {manifest.name}
          </p>
          <p className="text-xs text-zinc-500">
            {filtered.length} / {manifest.assets.length} elementi
          </p>
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Chiudi pannello asset"
            className="h-8 w-8 shrink-0 text-zinc-400 lg:hidden"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Filtri */}
      <div className="space-y-2 border-b border-zinc-800 px-3 py-2.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca asset…"
            aria-label="Cerca asset"
            className="h-9 border-zinc-700 bg-zinc-800 pl-8 text-sm text-zinc-200 placeholder:text-zinc-500"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {TYPE_ORDER.map((t) => {
            const count = manifest.totals[t] ?? 0
            const active = types.size === 0 || types.has(t)
            return (
              <button
                key={t}
                onClick={() => toggleType(t)}
                aria-pressed={types.has(t)}
                className={cn(
                  'flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                  active
                    ? 'border-red-500/60 bg-red-500/10 text-red-300'
                    : 'border-zinc-700 bg-zinc-800 text-zinc-500 line-through',
                )}
              >
                {TYPE_ICONS[t]} {TYPE_LABELS[t]}
                <span className="text-zinc-500">{count}</span>
              </button>
            )
          })}
        </div>

        <select
          value={screenId}
          onChange={(e) => setScreenId(e.target.value)}
          aria-label="Filtra per schermata"
          className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 text-sm text-zinc-200"
        >
          <option value="all">Tutte le schermate</option>
          {manifest.screens.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        {/* Download */}
        <div className="flex gap-1.5 pt-0.5">
          <Button
            size="sm"
            variant="outline"
            className="h-8 flex-1 border-zinc-700 bg-zinc-800 text-xs text-zinc-300 hover:bg-zinc-700"
            onClick={() =>
              downloadJson(`${manifest.game}-assets-filtrati.json`, {
                game: manifest.game,
                filtro: { query, types: [...types], screen: screenId },
                totale: filtered.length,
                assets: filtered,
              })
            }
          >
            <Download className="mr-1 h-3.5 w-3.5" /> JSON filtrati
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 flex-1 border-zinc-700 bg-zinc-800 text-xs text-zinc-300 hover:bg-zinc-700"
            onClick={() =>
              downloadJson(`${manifest.game}-assets-manifest.json`, manifest)
            }
          >
            <Download className="mr-1 h-3.5 w-3.5" /> JSON tutto
          </Button>
        </div>
      </div>

      {/* Lista */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="pb-4">
          {TYPE_ORDER.map((t) => {
            const items = byType.get(t) ?? []
            if (items.length === 0) return null
            const open = openGroups.has(t)
            return (
              <div key={t}>
                <button
                  onClick={() => toggleGroup(t)}
                  className="flex w-full items-center gap-1.5 border-b border-zinc-800/70 px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-zinc-400 hover:bg-zinc-800/60"
                  aria-expanded={open}
                >
                  {open ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                  {TYPE_LABELS[t]}
                  <span className="ml-auto font-normal text-zinc-600">
                    {items.length}
                  </span>
                </button>
                {open && (
                  <ul className="divide-y divide-zinc-800/50">
                    {items.map((a) => (
                      <li key={a.path}>
                        <button
                          onClick={() => onSelect(a)}
                          className={cn(
                            'flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors',
                            selected?.path === a.path
                              ? 'bg-red-500/15'
                              : 'hover:bg-zinc-800/60',
                          )}
                        >
                          <span
                            className={cn(
                              'truncate text-xs font-medium',
                              selected?.path === a.path
                                ? 'text-red-300'
                                : 'text-zinc-300',
                            )}
                            title={a.path}
                          >
                            {TYPE_ICONS[t]} {a.name}
                          </span>
                          <span className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                            <span>{formatBytes(a.bytes)}</span>
                            {a.width && (
                              <span>
                                · {a.width}×{a.height}
                              </span>
                            )}
                            {a.durationSec !== undefined && (
                              <span>· {a.durationSec}s</span>
                            )}
                            {a.frames && (
                              <span>· {a.frames.count} frame</span>
                            )}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
          {filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-zinc-500">
              Nessun asset corrisponde ai filtri.
            </p>
          )}
        </div>
      </ScrollArea>
    </aside>
  )
}
