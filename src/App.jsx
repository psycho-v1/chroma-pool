import React, { useEffect, useState } from 'react'
import { SiteHeader } from './components/site-header'
import Play from './routes/Play'
import Deploy from './routes/Deploy'

function currentPath() {
  const raw = window.location.hash.replace(/^#/, '') || '/'
  return /^\/deploy(\/|\?|$)/.test(raw) ? '/deploy' : '/'
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
