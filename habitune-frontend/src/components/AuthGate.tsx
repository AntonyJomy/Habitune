import type { ReactElement } from 'react'
import { Authenticator } from '@aws-amplify/ui-react'
import HabituneBrand from './HabituneBrand'
import '../auth.css'

type AuthGateProps = {
  children: ReactElement
}

const authenticatorComponents = {
  Header() {
    return (
      <header className="auth-header">
        <div className="auth-brand">
          <HabituneBrand />
        </div>
        <h1>Welcome back</h1>
        <p>Sign in to explore your local urban ecosystem.</p>
      </header>
    )
  },
  Footer() {
    return <p className="auth-footer">Protected Habitune preview</p>
  },
}

export default function AuthGate({ children }: AuthGateProps) {
  return (
    <Authenticator
      className="habitune-authenticator"
      components={authenticatorComponents}
      hideSignUp
      loginMechanisms={['username']}
    >
      {() => children}
    </Authenticator>
  )
}
