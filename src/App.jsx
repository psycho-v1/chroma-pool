import React, { useEffect, useState } from 'react'
import { SiteHeader } from './components/site-header'
import Play from './routes/Play'
import Deploy from './routes/Deploy'

export const DEPLOYED_POOL_ADDRESS = '0x8202C6768562BEBe8A138E4A6e67363BeE552f98'

function currentPath() {
  const raw = window.location.hash.replace(/^#/, '') || '/'
  if (raw === '/deploy' || raw.startsWith('/deploy')) return '/deploy'
  return '/'
}

export default function App() {
  const [path, setPath] = useState(currentPath)
  useEffect(() => {
    const onHash = () => setPath(currentPath())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return (
    <div className="min-h-screen bg-ink text-paper grain">
      <SiteHeader path={path} />
      {path === '/deploy' ? <Deploy /> : <Play />}
    </div>
  )
}
