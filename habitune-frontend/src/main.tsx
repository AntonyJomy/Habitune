import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@aws-amplify/ui-react/styles.css'
import 'leaflet/dist/leaflet.css'
import './auth'
import './habitune.css'
import App from './App'
import AuthGate from './components/AuthGate'

// AuthGate is outside App, so every application page requires a Cognito session.
createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <AuthGate>
      <App />
    </AuthGate>
  </StrictMode>,
)
