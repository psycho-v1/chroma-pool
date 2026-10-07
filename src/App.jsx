import React from 'react'
import { SiteHeader } from './components/site-header'
import Play from './routes/Play'

export default function App() {
  return (
    <div className="min-h-screen bg-ink text-paper grain">
      <SiteHeader />
      <Play />
    </div>
  )
}
