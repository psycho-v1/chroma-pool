import React from 'react'
import { ExternalLink, Palette } from 'lucide-react'
import { POOL_ADDRESS, explorerAddress, shortenAddress } from '../lib/psyrob'

export function SiteHeader({ path }) {
  const link = (href, label) => {
    const active = href === '#/deploy' ? path === '/deploy' : path !== '/deploy'
    return (
      <a href={href} className={`px-3 py-1.5 rounded-full ${active ? 'bg-paper text-ink' : 'text-paper/70 hover:text-paper'}`}>
        {label}
      </a>
    )
  }
  return (
    <header className="border-b border-paper/10 bg-ink/90 backdrop-blur sticky top-0 z-20">
      <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between gap-4">
        <a href="#/" className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-cinnabar text-ink grid place-items-center shadow-lg shrink-0"><Palette size={21} /></div>
          <div className="min-w-0">
            <div className="font-display text-xl font-bold tracking-tight">Chroma Pool</div>
            <div className="text-xs text-paper/50 truncate">PSYROB · on-chain color guessing</div>
          </div>
        </a>
        <nav className="flex items-center gap-2 text-xs font-semibold">
          {link('#/', 'Play')}
          {link('#/deploy', 'Deploy')}
          <a className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 text-paper/60 hover:text-paper" href={explorerAddress(POOL_ADDRESS)} target="_blank" rel="noreferrer">
            {shortenAddress(POOL_ADDRESS)} <ExternalLink size={13} />
          </a>
        </nav>
      </div>
    </header>
  )
}
