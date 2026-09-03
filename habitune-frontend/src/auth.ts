import { Amplify } from 'aws-amplify'

// CloudFormation outputs supply these non-secret identifiers to the frontend build.
const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID
const userPoolClientId = import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID

if (!userPoolId || !userPoolClientId) {
  throw new Error('Cognito configuration is missing. Set VITE_COGNITO_USER_POOL_ID and VITE_COGNITO_USER_POOL_CLIENT_ID.')
}

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId,
      userPoolClientId,
      loginWith: {
        // Iteration 1 uses a username/password preview account rather than email login.
        username: true,
      },
    },
  },
})
