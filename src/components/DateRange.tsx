import { useState } from 'react'
import { PRESET_LABEL, PRESETS, presetRange, type Preset } from '../lib/analytics'

export interface RangeState {
  preset: Preset
  from: string
  to: string
}

export const initialRange = (p: Preset = '30d'): RangeState => ({ preset: p, ...presetRange(p) })

export function DateRangeBar({ value, onChange, presets }: { value: RangeState; onChange: (v: RangeState) => void; presets?: Preset[] }) {
  const list = presets ?? [...PRESETS]
  return (
    <div className="range-bar">
      <select
        className="select"
        value={value.preset}
        onChange={(e) => {
          const p = e.target.value as Preset
          onChange(p === 'custom' ? { ...value, preset: p } : { preset: p, ...presetRange(p) })
        }}
      >
        {list.map((p) => (
          <option key={p} value={p}>
            {PRESET_LABEL[p]}
          </option>
        ))}
      </select>
      <input className="input" type="date" value={value.from} max={value.to} onChange={(e) => onChange({ preset: 'custom', from: e.target.value, to: value.to })} />
      <span className="muted">to</span>
      <input className="input" type="date" value={value.to} min={value.from} onChange={(e) => onChange({ preset: 'custom', from: value.from, to: e.target.value })} />
    </div>
  )
}

export function useRange(p: Preset = '30d') {
  return useState<RangeState>(initialRange(p))
}
