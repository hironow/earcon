import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { exposeDebug } from './debug'
import { engine } from './engine'
import './styles.css'

exposeDebug(engine)

const root = document.getElementById('root')
if (!root) throw new Error('#root not found')
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
