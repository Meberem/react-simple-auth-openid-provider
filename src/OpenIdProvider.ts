import { UriBuilder } from 'uribuilder'
import { IProvider } from 'react-simple-auth'
import { Session } from './Session'
import { OpenIdConfiguration } from './OpenIdConfiguration'
import { SecurityOptions } from './SecurityOptions'

class OpenIdProvider implements IProvider<Session> {
  constructor(
    private config: OpenIdConfiguration,
    private options: SecurityOptions
  ) {}

  static async FromOpenIdConfigurationUrl(options: SecurityOptions) {
    const config = await fetch(
      `${options.authority}/.well-known/openid-configuration`
    )
      .then(r => r.json())
      .then(r => r as OpenIdConfiguration)
    return new OpenIdProvider(config, options)
  }

  buildAuthorizeUrl() {
    const uri = UriBuilder.updateQuery(this.config.authorization_endpoint, {
      client_id: this.options.clientId,
      scope: this.options.scope,
      redirect_uri:
        this.options.redirectUri || `${window.location.origin}/redirect.html`,
      response_type: 'token'
    })

    return uri
  }

  extractError(redirectUrl: string): Error | undefined {
    const errorMatch = redirectUrl.match(/error=([^&]+)/)
    if (!errorMatch) {
      return undefined
    }

    const errorReason = errorMatch[1]
    const errorDescriptionMatch = redirectUrl.match(/error_description=([^&]+)/)
    const errorDescription = errorDescriptionMatch
      ? errorDescriptionMatch[1]
      : ''
    return new Error(
      `Error during login. Reason: ${errorReason} Description: ${errorDescription}`
    )
  }

  extractSession(redirectUrl: string): Session {
    let accessToken: string = null!
    const accessTokenMatch = redirectUrl.match(/access_token=([^&]+)/)
    if (accessTokenMatch) {
      accessToken = accessTokenMatch[1]
    }

    let idToken: string = null!
    let decodedIdToken: string = null!
    const idTokenMatch = redirectUrl.match(/id_token=([^&]+)/)
    if (idTokenMatch) {
      idToken = idTokenMatch[1]
      decodedIdToken = JSON.parse(atob(idToken.split('.')[1]))
    }

    let expireDurationSeconds: number = 3600
    const expireDurationSecondsMatch = redirectUrl.match(/expires_in=([^&]+)/)
    if (expireDurationSecondsMatch) {
      expireDurationSeconds = parseInt(expireDurationSecondsMatch[1], 10)
    }

    return {
      accessToken,
      expireDurationSeconds,
      idToken,
      decodedIdToken
    }
  }

  validateSession(session: Session): boolean {
    if (!session || !session.accessToken) {
      return false
    }

    const [header, bodyPart, sig] = session.accessToken.split('.')
    if (!header || !bodyPart || !sig) {
      return false
    }

    try {
      const body = JSON.parse(window.atob(bodyPart))
      const nowInSeconds = Date.now() / 1000
      if (body.nbf && nowInSeconds < body.nbf) {
        return false
      }
      if (body.exp && body.exp < nowInSeconds) {
        return false
      }

      return true
    } catch (err) {
      return false
    }
  }

  getAccessToken(session: Session, resourceId: string): string {
    return session.accessToken
  }

  getSignOutUrl(redirectUrl: string): string {
    const uri = UriBuilder.updateQuery(this.config.authorization_endpoint, {
      post_logout_redirect_uri: redirectUrl
    })

    return uri
  }
}
