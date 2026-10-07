import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { reportError, watchErrors } from './services/telemetry'

watchErrors()

createRoot(document.getElementById('root'), {
  onUncaughtError: (error, info) => {
    console.error(error)
    reportError(error?.message, `${error?.stack || ''}\n${info?.componentStack || ''}`)
  },
}).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
