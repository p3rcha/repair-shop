import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDown01Icon, Cancel01Icon } from "@hugeicons/core-free-icons"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type Props = {
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
  id?: string
  className?: string
}

type Position = { top: number; left: number; width: number }

export function YearCombobox({
  value,
  onChange,
  options,
  placeholder = "Year",
  id,
  className,
}: Props) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const listboxId = `${inputId}-listbox`

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const [activeIndex, setActiveIndex] = useState(0)
  const [position, setPosition] = useState<Position | null>(null)

  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLUListElement | null>(null)

  useEffect(() => {
    setQuery(value)
  }, [value])

  const filtered = useMemo(() => {
    const q = query.trim()
    if (!q) return options
    return options.filter((y) => y.includes(q))
  }, [options, query])

  useEffect(() => {
    if (activeIndex >= filtered.length) setActiveIndex(0)
  }, [filtered, activeIndex])

  const updatePosition = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPosition({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    updatePosition()
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    const handle = () => updatePosition()
    window.addEventListener("scroll", handle, true)
    window.addEventListener("resize", handle)
    return () => {
      window.removeEventListener("scroll", handle, true)
      window.removeEventListener("resize", handle)
    }
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    const onDocPointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      const inWrapper = wrapperRef.current?.contains(target)
      const inList = listRef.current?.contains(target)
      if (inWrapper || inList) return
      commit(query)
      setOpen(false)
    }
    document.addEventListener("pointerdown", onDocPointerDown)
    return () => document.removeEventListener("pointerdown", onDocPointerDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query])

  useEffect(() => {
    if (!open) return
    const list = listRef.current
    if (!list) return
    const item = list.children[activeIndex] as HTMLElement | undefined
    if (item) item.scrollIntoView({ block: "nearest" })
  }, [activeIndex, open])

  function commit(next: string) {
    const trimmed = next.trim()
    if (!trimmed) {
      onChange("")
      setQuery("")
      return
    }
    if (options.includes(trimmed)) {
      onChange(trimmed)
      setQuery(trimmed)
      return
    }
    onChange(value)
    setQuery(value)
  }

  function handleSelect(year: string) {
    onChange(year)
    setQuery(year)
    setOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      if (!open) setOpen(true)
      setActiveIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      if (!open) setOpen(true)
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      if (open && filtered[activeIndex]) {
        e.preventDefault()
        handleSelect(filtered[activeIndex])
      }
    } else if (e.key === "Escape") {
      e.preventDefault()
      setQuery(value)
      setOpen(false)
    } else if (e.key === "Tab") {
      commit(query)
      setOpen(false)
    }
  }

  function handleClear(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    onChange("")
    setQuery("")
    setOpen(false)
  }

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <div ref={triggerRef} className="relative">
        <Input
          id={inputId}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={
            open && filtered[activeIndex]
              ? `${listboxId}-${filtered[activeIndex]}`
              : undefined
          }
          inputMode="numeric"
          autoComplete="off"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            const next = e.target.value.replace(/\D+/g, "").slice(0, 4)
            setQuery(next)
            setOpen(true)
            setActiveIndex(0)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="pr-16"
        />
        <div className="absolute inset-y-0 right-1 flex items-center gap-1 text-muted-foreground">
          {query && (
            <button
              type="button"
              onMouseDown={handleClear}
              className="grid size-7 place-items-center hover:text-foreground"
              aria-label="Clear year"
              tabIndex={-1}
            >
              <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
            </button>
          )}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              setOpen((o) => !o)
            }}
            className="grid size-7 place-items-center hover:text-foreground"
            aria-label="Toggle year list"
            tabIndex={-1}
          >
            <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5" />
          </button>
        </div>
      </div>

      {open &&
        position &&
        createPortal(
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              width: position.width,
            }}
            className="z-[1000] max-h-60 overflow-y-auto border border-border bg-popover py-1 text-sm shadow-md"
          >
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-xs uppercase tracking-widest text-muted-foreground">
                No matches
              </li>
            )}
            {filtered.map((year, idx) => {
              const isActive = idx === activeIndex
              const isSelected = year === value
              return (
                <li
                  key={year}
                  id={`${listboxId}-${year}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    handleSelect(year)
                  }}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={cn(
                    "cursor-pointer px-3 py-1.5 tabular-nums",
                    isActive && "bg-muted",
                    isSelected && "font-semibold text-primary",
                  )}
                >
                  {year}
                </li>
              )
            })}
          </ul>,
          document.body,
        )}
    </div>
  )
}
