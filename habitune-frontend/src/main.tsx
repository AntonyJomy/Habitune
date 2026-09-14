import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@aws-amplify/ui-react/styles.css'
import 'leaflet/dist/leaflet.css'
import './auth'
import './habitune.css'
import App from './App'
import AuthGate from './components/AuthGate'

// Map selections belong to one browser document session. A direct load or
// refresh always starts from the default map before React reads the URL.
if (window.location.pathname === '/biodiversity' || window.location.pathname.startsWith('/biodiversity/')) {
  window.history.replaceState(window.history.state, '', '/biodiversity')
}

// AuthGate is outside App, so every application page requires a Cognito session.
createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <AuthGate>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AuthGate>
  </StrictMode>,
)
