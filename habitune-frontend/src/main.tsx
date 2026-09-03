import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Authenticator } from '@aws-amplify/ui-react'
import '@aws-amplify/ui-react/styles.css'
import 'leaflet/dist/leaflet.css'
import './auth'
import './habitune.css'
import App from './App'

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <Authenticator hideSignUp loginMechanisms={['username']}>
      {() => <App />}
    </Authenticator>
  </StrictMode>,
)
