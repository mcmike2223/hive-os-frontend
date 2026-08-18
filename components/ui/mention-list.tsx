"use client";

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react'
import { cn } from '@/lib/utils'
import { Loader2, AtSign } from 'lucide-react'

export interface MentionNode {
  id: string
  name: string
  email: string
  avatar_path?: string | null
}

function Avatar({ user }: { user: MentionNode }) {
  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  if (user.avatar_path) {
    return (
      <img
        src={user.avatar_path}
        alt={user.name}
        className="w-7 h-7 rounded-full object-cover shrink-0 border border-border"
      />
    )
  }

  return (
    <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[11px] font-bold shrink-0 border border-primary/30">
      {initials}
    </div>
  )
}

export const MentionList = forwardRef((props: any, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0)

  const selectItem = (index: number) => {
    const item = props.items[index]
    if (item) {
      props.command({ id: item.id, label: item.name })
    }
  }

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length)
  }

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length)
  }

  const enterHandler = () => {
    selectItem(selectedIndex)
  }

  useEffect(() => {
    setSelectedIndex(0)
  }, [props.items])

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (props.loading) return false

      if (event.key === 'ArrowUp') {
        upHandler()
        return true
      }
      if (event.key === 'ArrowDown') {
        downHandler()
        return true
      }
      if (event.key === 'Enter') {
        enterHandler()
        return true
      }
      return false
    },
  }))

  return (
    <div className="bg-popover text-popover-foreground rounded-lg shadow-xl border border-border overflow-hidden min-w-[240px] max-w-[320px] max-h-[280px] flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border bg-muted/30">
        <AtSign className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mention</span>
      </div>

      {props.loading ? (
        <div className="p-4 flex items-center justify-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span>Searching users...</span>
        </div>
      ) : props.items.length > 0 ? (
        <div className="overflow-y-auto">
          {props.items.map((item: MentionNode, index: number) => (
            <button
              key={item.id}
              className={cn(
                "w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 outline-none transition-colors",
                index === selectedIndex
                  ? "bg-primary/10 text-foreground"
                  : "hover:bg-muted/50 text-foreground"
              )}
              onClick={() => selectItem(index)}
              onMouseEnter={() => setSelectedIndex(index)}
              type="button"
            >
              <Avatar user={item} />
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-sm leading-tight truncate">{item.name}</span>
                <span className="text-xs text-muted-foreground truncate">{item.email}</span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="p-4 text-sm text-center text-muted-foreground">
          No users found
        </div>
      )}
    </div>
  )
})

MentionList.displayName = 'MentionList'
