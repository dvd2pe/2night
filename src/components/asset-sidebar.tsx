'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Download, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  AssetKind,
  KIND_LABELS,
  RegistryAsset,
  downloadJson,
  formatBytes,
} from '@/lib/asset-types'
import { NormalizedGame } from '@/lib/registry'

interface Props {
  gameId: string
  gameName: string
  normalized: NormalizedGame
  selected: RegistryAsset | null
  onSelect: (a: RegistryAsset) => void
  onClose?: () => void
}

export function AssetSidebar({
  gameId,
  gameName,
  normalized,
  selected,
  onSelect,
  onClose,
}: Props) {
  const [query, setQuery] = useState('')
  const [kinds, setKinds] = useState<Set<AssetKind>>(new Set())
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(normalized.sections.map((s) => s.kind)),
  )

  const kindCounts = useMemo(() => {
    const m = new Map<AssetKind, number>()
    for (const s of normalized.sections) {
      m.set(s.kind, (m.get(s.kind) ?? 0) + s.items.length)
    }
    return m
  }, [normalized])

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase()
    return normalized.sections
      .filter((s) => s.items.length > 0)
      .map((s) => ({
        ...s,
        items: s.items.filter((a) => {
          if (kinds.size > 0 && !kinds.has(a.kind)) return false
          if (!q) return true
          const hay = `${a.name} ${a.sub ?? ''} ${(a.files ?? []).join(' ')}`.toLowerCase()
          return hay.includes(q)
        }),
      }))
      .filter((s) => s.items.length > 0)
  }, [normalized, query, kinds])

  const filteredTotal = filteredSections.reduce((n, s) => n + s.items.length, 0)

  const toggleKind = (k: AssetKind) => {
    setKinds((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  const toggleSection = (k: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-r border-zinc-800 bg-zinc-900">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-zinc-100">
            Registro asset · {gameName}
          </p>
          <p className="text-xs text-zinc-500">
            {filteredTotal} / {normalized.totalItems} elementi · dati originali
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
          {[...kindCounts.entries()].map(([k, count]) => {
            const active = kinds.size === 0 || kinds.has(k)
            return (
              <button
                key={k}
                onClick={() => toggleKind(k)}
                aria-pressed={kinds.has(k)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                  active
                    ? 'border-red-500/60 bg-red-500/10 text-red-300'
                    : 'border-zinc-700 bg-zinc-800 text-zinc-500 line-through',
                )}
              >
                {KIND_LABELS[k]}
                <span className="ml-1 text-zinc-500">{count}</span>
              </button>
            )
          })}
        </div>

        <div className="flex gap-1.5 pt-0.5">
          <Button
            size="sm"
            variant="outline"
            className="h-8 flex-1 border-zinc-700 bg-zinc-800 text-xs text-zinc-300 hover:bg-zinc-700"
            onClick={() =>
              downloadJson(`${gameId}-registro-filtrato.json`, {
                game: gameId,
                filtro: { query, tipi: [...kinds] },
                totale: filteredTotal,
                sezioni: filteredSections,
              })
            }
          >
            <Download className="mr-1 h-3.5 w-3.5" /> JSON filtrato
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 flex-1 border-zinc-700 bg-zinc-800 text-xs text-zinc-300 hover:bg-zinc-700"
            onClick={() =>
              downloadJson(`${gameId}-registro-completo.json`, normalized)
            }
          >
            <Download className="mr-1 h-3.5 w-3.5" /> JSON completo
          </Button>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="pb-4">
          {filteredSections.map((s) => {
            const open = openSections.has(s.kind) || query.length > 0
            return (
              <div key={s.kind + s.label}>
                <button
                  onClick={() => toggleSection(s.kind)}
                  className="flex w-full items-center gap-1.5 border-b border-zinc-800/70 px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-zinc-400 hover:bg-zinc-800/60"
                  aria-expanded={open}
                >
                  {open ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                  {s.label}
                  <span className="ml-auto font-normal text-zinc-600">
                    {s.items.length}
                  </span>
                </button>
                {open && (
                  <ul className="divide-y divide-zinc-800/50">
                    {s.items.slice(0, 400).map((a) => (
                      <li key={a.id}>
                        <button
                          onClick={() => onSelect(a)}
                          className={cn(
                            'flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors',
                            selected?.id === a.id
                              ? 'bg-red-500/15'
                              : 'hover:bg-zinc-800/60',
                          )}
                        >
                          <span
                            className={cn(
                              'truncate text-xs font-medium',
                              selected?.id === a.id
                                ? 'text-red-300'
                                : 'text-zinc-300',
                            )}
                            title={a.name}
                          >
                            {a.name}
                          </span>
                          <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                            {a.sub && <span className="truncate">{a.sub}</span>}
                            {a.sizeBytes != null && (
                              <span>· {formatBytes(a.sizeBytes)}</span>
                            )}
                          </span>
                        </button>
                      </li>
                    ))}
                    {s.items.length > 400 && (
                      <li className="px-3 py-2 text-[10px] text-zinc-500">
                        …e altri {s.items.length - 400} (affina la ricerca)
                      </li>
                    )}
                  </ul>
                )}
              </div>
            )
          })}
          {filteredTotal === 0 && (
            <p className="px-3 py-6 text-center text-xs text-zinc-500">
              Nessun elemento corrisponde ai filtri.
            </p>
          )}
        </div>
      </ScrollArea>
    </aside>
  )
}
