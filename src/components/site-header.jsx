import React from 'react'
import { ExternalLink, Palette } from 'lucide-react'
import { CHAIN, shortenAddress } from '../lib/psyrob'
import { DEPLOYED_POOL_ADDRESS } from '../App'

export function SiteHeader() {
  return <header className="border-b border-paper/10 bg-ink/90 backdrop-blur sticky top-0 z-20">
    <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between gap-4">
      <a href="#/" className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-cinnabar text-ink grid place-items-center shadow-lg"><Palette size={21}/></div>
        <div><div className="font-display text-xl font-bold tracking-tight">Chroma Pool</div><div className="text-xs text-paper/50">PSYROB · on-chain color guessing</div></div>
      </a>
      <div className="hidden sm:flex items-center gap-3 text-xs">
        <span className="px-3 py-1.5 rounded-full border border-paper/10 text-paper/65">Chain {CHAIN.id}</span>
        <a className="text-paper/60 hover:text-paper flex items-center gap-1" href={`${CHAIN.explorer}/address/${DEPLOYED_POOL_ADDRESS}`} target="_blank" rel="noreferrer">Contract <ExternalLink size={13}/></a>
      </div>
    </div>
  </header>
}
