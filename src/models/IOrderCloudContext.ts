import {
  AccessToken,
  ApiRole,
  OrderCloudError,
} from "ordercloud-javascript-sdk";
import { IOrderCloudErrorContext } from "./IOrderCloudErrorContext";
import { OpenAPIV3 } from "openapi-types";

export interface IOrderCloudContext {
  /**
   * Signifies when a valid token is available.
   * This will block all auth queries by default, mutation interaction will
   * be blocked by the login modal.
   */
  isAuthenticated: boolean;
  /**
   * Signifies when an authenticated user is registered.
   */
  isLoggedIn: boolean;
  /**
   * Clears all tokens from the OrderCloud JS SDK and conditionally will
   * get a new anonymous token based on allowAnonymous
   */
  logout: () => void;
  /**
   * authenticates using the configured client ID and username / password
   */
  login: (
    username: string,
    password: string,
    rememberMe?: boolean
  ) => Promise<AccessToken>;
  /**
   * authenticates using the configured OpenID Connect settings
   */
  loginWithOpenIdConnect: (
    openIdConnectId: string,
    options?: {
      appStartPath?: string;
      customParams?: string;
    }
  ) => void;
  /**
   * authenticates using the provided OrderCloud access token
   */
  setToken: (accessToken: string) => void;
  /**
   * Signifies when authorization is in a loading state
   */
  authLoading: boolean;

  /**
   * If anonymous, this will retrieve a new anon token, useful for anonymous
   * users who want to submit more than one order.
   * @returns empty promise
   */
  newAnonSession: () => Promise<void>;

  baseApiUrl: string;
  clientId: string;
  scope?: ApiRole[];
  customScope?: string[];
  allowAnonymous: boolean;
  defaultErrorHandler?: (
    error: OrderCloudError,
    context: IOrderCloudErrorContext
  ) => void;
  token?: string;
  idpToken?: string;
  xpSchemas?: OpenAPIV3.SchemaObject;
  autoApplyPromotions?: boolean;
  currencyDefaults: { currencyCode: string; language: string };
}
