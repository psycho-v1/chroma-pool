import React from 'react'
import { ExternalLink } from 'lucide-react'
import { DEPLOYED_POOL_ADDRESS } from '../App'
import { CHAIN } from '../lib/psyrob'

export default function Deploy() {
  return <main className="max-w-3xl mx-auto px-5 py-14">
    <div className="rounded-3xl border border-paper/10 bg-clay p-7 sm:p-10">
      <div className="text-xs uppercase tracking-[.2em] text-paper/40">Optional deployment</div>
      <h1 className="font-display text-4xl mt-2">ColorPool is already live.</h1>
      <p className="mt-4 text-paper/60 leading-relaxed">Players should use the deployed pool directly. This route intentionally does not compile or deploy a second contract, preventing accidental duplicate pools from the public game UI.</p>
      <div className="mt-7 p-5 rounded-2xl bg-ink border border-paper/10 break-all font-mono text-sm">{DEPLOYED_POOL_ADDRESS}</div>
      <a className="mt-5 inline-flex items-center gap-2 text-cinnabar hover:underline" href={`${CHAIN.explorer}/address/${DEPLOYED_POOL_ADDRESS}`} target="_blank" rel="noreferrer">Open contract in explorer <ExternalLink size={15}/></a>
      <div className="mt-8 text-sm text-paper/45">If you want a browser-based owner deployment page, supply the exact ColorPool.sol source/ABI so the deployment flow can be kept byte-for-byte compatible with the deployed contract.</div>
    </div>
  </main>
}
