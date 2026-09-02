import { ReactRenderer } from '@tiptap/react'
import tippy from 'tippy.js'
import { MentionList } from './mention-list'
import api from '@/lib/api'

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let cancelPrevious: (() => void) | null = null

const mentionSuggestion = {
  items: ({ query }: { query: string }): Promise<any[]> => {
    return new Promise((resolve) => {
      // If there's an ongoing debounce, cancel the previous promise by resolving it empty
      if (cancelPrevious) cancelPrevious()
      cancelPrevious = () => resolve([])

      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(async () => {
        try {
          const { data } = await api.get(`/directory/users?search=${encodeURIComponent(query)}`)
          resolve(Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [])
        } catch {
          resolve([])
        }
      }, 300)
    })
  },

  render: () => {
    let component: ReactRenderer
    let popup: any

    return {
      onStart: (props: any) => {
        component = new ReactRenderer(MentionList, {
          props: { ...props, items: [], loading: true },
          editor: props.editor,
        })

        if (!props.clientRect) return

        popup = tippy('body', {
          getReferenceClientRect: props.clientRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
        })
      },

      onUpdate(props: any) {
        // items have resolved — mark loading done
        component.updateProps({ ...props, loading: false })

        if (!props.clientRect) return

        popup[0].setProps({
          getReferenceClientRect: props.clientRect,
        })
      },

      onKeyDown(props: any) {
        if (props.event.key === 'Escape') {
          popup[0].hide()
          return true
        }
        return (component.ref as any)?.onKeyDown(props)
      },

      onExit() {
        if (debounceTimer) {
          clearTimeout(debounceTimer)
          debounceTimer = null
        }
        popup[0].destroy()
        component.destroy()
      },
    }
  },
}

export default mentionSuggestion
