import { useEffect } from 'react'

/**
 * On small screens `.table` rows are rendered as stacked cards (see index.css).
 * The cards need each cell to know its column heading, so this hook copies the
 * header text onto every <td> as `data-label`. It watches the DOM (modals are
 * portaled into <body>) so tables rendered later or re-rendered stay labelled.
 * Purely presentational — it never touches React-managed state.
 */
export function useResponsiveTables() {
  useEffect(() => {
    let frame = 0

    const label = (table: HTMLTableElement) => {
      const head = table.tHead?.rows[0]
      if (!head) return
      const labels: string[] = []
      Array.from(head.cells).forEach((th) => {
        const text = (th.textContent ?? '').trim()
        for (let i = 0; i < Math.max(1, th.colSpan); i++) labels.push(text)
      })
      Array.from(table.rows).forEach((row) => {
        if (row.parentElement?.tagName === 'THEAD') return
        let col = 0
        let primarySet = false
        Array.from(row.cells).forEach((td) => {
          const text = labels[col] ?? ''
          if (td.dataset.label !== text) {
            if (text) td.dataset.label = text
            else delete td.dataset.label
          }
          // first labelled cell acts as the card heading
          const primary = !primarySet && !!text && td.colSpan === 1
          if (primary) primarySet = true
          if (primary) {
            if (td.dataset.primary !== '1') td.dataset.primary = '1'
          } else if (td.dataset.primary) delete td.dataset.primary
          col += Math.max(1, td.colSpan)
        })
      })
    }

    const run = () => {
      frame = 0
      document.querySelectorAll<HTMLTableElement>('table.table').forEach(label)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(run)
    }

    run()
    // childList/characterData only: we write attributes, so no feedback loop
    const mo = new MutationObserver(schedule)
    mo.observe(document.body, { childList: true, subtree: true, characterData: true })
    return () => {
      mo.disconnect()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])
}
