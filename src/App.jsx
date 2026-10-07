import React from 'react'
import { SiteHeader } from './components/site-header'
import Play from './routes/Play'
import Deploy from './routes/Deploy'

export const DEPLOYED_POOL_ADDRESS = '0x8202C6768562BEBe8A138E4A6e67363BeE552f98'

export default function App() {
  const path = window.location.hash.replace(/^#/, '') || '/'
  return (
    <div className="min-h-screen bg-ink text-paper grain">
      <SiteHeader />
      {path === '/deploy' ? <Deploy /> : <Play />}
    </div>
  )
}
