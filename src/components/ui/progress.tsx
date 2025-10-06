
import React from 'react'
export function Progress({ value=0, className='' }: { value?: number, className?: string }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className={`h-2 w-40 rounded bg-slate-200 overflow-hidden ${className}`}>
      <div className="h-full bg-emerald-500" style={{width: `${v}%`}} />
    </div>
  )
}
