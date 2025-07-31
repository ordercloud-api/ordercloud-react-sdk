export interface IOpenIdConnectSettings
{
  /**
   * Enables or disables OpenID Connect authentication.
   * 
   * Set to `true` to activate OIDC support in your application. If `false`, all OIDC logic
   * (such as login redirects and token handling) will be disabled, even if configs are defined.
   */
  enabled: boolean
  /**
   * An array of OpenID Connect configuration objects. 
   * Each defines the settings required to authenticate against a specific identity provider. 
   * At least one configuration must be provided.
   */
  configs: IOpenIdConnectConfig[]
  /**
   * True will automatically redirect the user to the 
   * first openIdConnect config stored if the token is expired, or invalid. 
   * This is a simplified use case. For more control, or when you need to 
   * handle multiple identity providers set this to false and handle redirect on your 
   * own by calling `loginWithOpenIdConnect`
   */
  autoRedirect?: boolean
  /**
   * The name of the query parameter under which the ordercloud access token will be stored under after successful login. 
   * This will vary based on your [OpenIdConnect.AppStartUrl](https://ordercloud.io/api-reference/authentication-and-authorization/open-id-connects/create). 
   * For example if your `AppStartUrl` is `https://my-buyer-application.com/login?token={0}` then the value should be `token`
   */
  accessTokenQueryParamName: string
  /**
   * The **optional** name of the query parameter under which the ordercloud refresh token will be stored 
   * under after successful login. This will vary based on your [OpenIdConnect.AppStartUrl](https://ordercloud.io/api-reference/authentication-and-authorization/open-id-connects/create). 
   * For example if your `AppStartUrl` is `https://my-buyer-application.com/login?token={0}&refresh={3}` then the value should be `refresh`
   */
  refreshTokenQueryParamName?: string
  /**
   * The **optional** name of the query parameter under which the idp access token will be stored 
   * under after successful login. This will vary based on your [OpenIdConnect.AppStartUrl](https://ordercloud.io/api-reference/authentication-and-authorization/open-id-connects/create). 
   * For example if your `AppStartUrl` is `https://my-buyer-application.com/login?token={0}&idptoken={1}` then the value should be `idptoken`
   */
  idpAccessTokenQueryParamName?: string
  /**
   * An **optional** path to redirect the user to after returning from the identity provider.
   * See [here](https://ordercloud.io/knowledge-base/sso-via-openid-connect#deep-linking) for more information
   * This global setting will be used if not overridden by the `appStartPath` in the individual OpenID Connect configurations.
   * Call `setAppStartPath()` to change this value at runtime.
   */
  appStartPath?: string
  /**
   * **optional** query parameters passed along to the `AuthorizationEndpoint`.
   * See [here](https://ordercloud.io/knowledge-base/sso-via-openid-connect) for more information
   * This global setting will be used if not overridden by the `customParams` in the individual OpenID Connect configurations.
   * Call `setCustomParams()` to change this value at runtime.
   */
  customParams?: string
}

export interface IOpenIdConnectConfig
{
  /**
   * The ID of the [OpenID connect configuration](https://ordercloud.io/api-reference/authentication-and-authorization/open-id-connects/create)
   * that should be targeted for authentication
   */
  id: string
  /**
   * An **optional** array of roles that will be requested when authenticating. 
   * If excluded, the token generated will contain any roles assigned to the user. 
   * Unless you have a specific reason for limiting roles, we recommend omitting this option.
   */
  roles?: string[]
  /**
   * An **optional** OrderCloud clientId to authenticate against. 
   * By default, will use `clientId` at the root of the provider settings.
   */
  clientId?: string
  /**
   * An **optional** path to redirect the user to after returning from the identity provider. 
   * See [here](https://ordercloud.io/knowledge-base/sso-via-openid-connect#deep-linking) for more information
   * call `setAppStartPath(openIdConnectConfigId)` to change this value at runtime.
   */
  appStartPath?: string

  /**
   * **optional** query parameters passed along to the `AuthorizationEndpoint`.
   * See [here](https://ordercloud.io/knowledge-base/sso-via-openid-connect) for more information
   * call `setCustomParams(openIdConnectConfigId)` to change this value at runtime.
   */
  customParams?: string
}