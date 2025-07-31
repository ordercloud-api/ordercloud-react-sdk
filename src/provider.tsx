import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import {
  Auth,
  Configuration,
  OrderCloudError,
  Tokens,
} from "ordercloud-javascript-sdk";
import {
  FC,
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { OrderCloudContext } from "./context";
import { IOrderCloudProvider } from "./models/IOrderCloudProvider";
import { asyncStoragePersister, queryClient } from "./query";
import { isAnonToken } from "./utils";
import axios from "axios";
import { IOpenIdConnectConfig } from "./models/IOpenIdConnectSettings";
import { useOnceAtATime } from "./hooks/useOnceAtATime";

let interceptorSetup = false;
const OrderCloudProvider: FC<PropsWithChildren<IOrderCloudProvider>> = ({
  children,
  baseApiUrl,
  clientId,
  scope,
  customScope,
  allowAnonymous,
  openIdConnect,
  xpSchemas,
  autoApplyPromotions,
  configurationOverrides,
  currencyDefaults = { currencyCode: "USD", language: "en-US" },
  defaultErrorHandler,
}) => {
  const ocConfig = useMemo(() => {
    const { cookieOptions, ...rest } = configurationOverrides || {};
    return {
      cookieOptions: {
        prefix: clientId,
        ...cookieOptions,
      },
      baseApiUrl,
      clientID: clientId,
      ...rest,
    };
  }, [baseApiUrl, clientId, configurationOverrides]);

  Configuration.Set(ocConfig);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState<string | undefined>();
  const [authLoading, setAuthLoading] = useState(true);

  if (openIdConnect?.enabled) {
    if (
      !openIdConnect ||
      !openIdConnect.configs ||
      openIdConnect.configs.length === 0
    ) {
      throw new Error(
        "OpenID Connect is enabled, but no configurations were provided."
      );
    }

    if (!openIdConnect.accessTokenQueryParamName) {
      throw new Error(
        "OpenID Connect is enabled, but accessTokenQueryParamName is missing."
      );
    }
  }

  const handleLogout = useCallback(() => {
    queryClient.clear();
    Tokens.RemoveAccessToken();
    Tokens.RemoveRefreshToken();
    setIsAuthenticated(false);
    setIsLoggedIn(false);
    setToken(undefined);
    setAuthLoading(false);
  }, []);

  const handleLogin = useCallback(
    async (username: string, password: string, rememberMe?: boolean) => {
      setAuthLoading(true);
      try {
        const response = await Auth.Login(
          username,
          password,
          clientId,
          scope,
          customScope
        );
        const { access_token, refresh_token } = response;
        Tokens.SetAccessToken(access_token);
        setToken(access_token);
        if (rememberMe && refresh_token) {
          Tokens.SetRefreshToken(refresh_token);
        }
        setIsAuthenticated(true);
        setIsLoggedIn(true);
        queryClient.clear();
        setAuthLoading(false);
        return response;
      } catch (ex) {
        return Promise.reject(ex as OrderCloudError);
      }
    },
    [clientId, scope, customScope]
  );

  const handleLoginWithOpenIdConnect = useCallback(
    (
      openIdConnectId: string,
      options?: {
        appStartPath?: string;
        customParams?: string;
      }
    ) => {
      const config = openIdConnect?.configs.find(
        (c) => c.id === openIdConnectId
      );
      if (!config) {
        throw new Error(
          `OpenID Connect configuration with id ${openIdConnectId} not found.`
        );
      }
      handleOpenIdConnectRedirect(
        config,
        options?.appStartPath,
        options?.customParams
      );
    },
    []
  );

  const handleOpenIdConnectAutoRedirect = useCallback(() => {
    const config = openIdConnect?.configs[0] as IOpenIdConnectConfig
    handleOpenIdConnectRedirect(config);
  }, [openIdConnect]);

  const handleOpenIdConnectRedirect = useCallback(
    (
      config: IOpenIdConnectConfig,
      overrideAppStartPath?: string,
      overrideCustomParams?: string
    ) => {
      const appRoles = [...(scope || []), ...(customScope || [])];
      let redirectUrl =
        `${baseApiUrl}/ocrplogin?id=${config.id}` +
        `&cid=${config.clientId || clientId}`;

      if (config.roles) {
        redirectUrl += `&roles=${encodeURIComponent(config.roles.join(" "))}`;
      } else if (appRoles.length > 0) {
        redirectUrl += `&roles=${encodeURIComponent(appRoles.join(" "))}`;
      }

      if (overrideAppStartPath) {
        redirectUrl += `&appstartpath=${encodeURIComponent(
          overrideAppStartPath
        )}`;
      } else if (config.appStartPath) {
        redirectUrl += `&appstartpath=${encodeURIComponent(
          config.appStartPath
        )}`;
      } else if (openIdConnect?.appStartPath) {
        redirectUrl += `&appstartpath=${encodeURIComponent(
          openIdConnect.appStartPath
        )}`;
      }

      if (overrideCustomParams) {
        redirectUrl += `&customParams=${encodeURIComponent(
          overrideCustomParams
        )}`;
      } else if (config.customParams) {
        redirectUrl += `&customParams=${encodeURIComponent(
          config.customParams
        )}`;
      } else if (openIdConnect?.customParams) {
        redirectUrl += `&customParams=${encodeURIComponent(
          openIdConnect.customParams
        )}`;
      }
      window.location.assign(redirectUrl);
    },
    [openIdConnect, clientId, scope, customScope, baseApiUrl]
  );

  const { run: verifyToken } = useOnceAtATime(
    useCallback(
      async (accessToken?: string) => {
        setAuthLoading(true);

        if (openIdConnect?.enabled && openIdConnect.accessTokenQueryParamName) {
          // User is being redirected to app after completing single-sign in flow
          const urlParams = new URLSearchParams(window.location.search);
          const accessTokenFromUrl = urlParams.get(
            openIdConnect.accessTokenQueryParamName
          );
          const refreshTokenFromUrl = openIdConnect.refreshTokenQueryParamName
            ? urlParams.get(openIdConnect.refreshTokenQueryParamName)
            : null;
          const idpAccessTokenFromUrl =
            openIdConnect.idpAccessTokenQueryParamName
              ? urlParams.get(openIdConnect.idpAccessTokenQueryParamName)
              : null;

          if (accessTokenFromUrl) {
            Tokens.SetAccessToken(accessTokenFromUrl);
            if (refreshTokenFromUrl)
              Tokens.SetRefreshToken(refreshTokenFromUrl);
            if (idpAccessTokenFromUrl)
              Tokens.SetIdpAccessToken(idpAccessTokenFromUrl);

            // Remove only token-related params
            urlParams.delete(openIdConnect.accessTokenQueryParamName);
            if (openIdConnect.refreshTokenQueryParamName)
              urlParams.delete(openIdConnect.refreshTokenQueryParamName);
            if (openIdConnect.idpAccessTokenQueryParamName)
              urlParams.delete(openIdConnect.idpAccessTokenQueryParamName);

            const url = new URL(window.location.href);
            url.search = urlParams.toString();
            window.history.replaceState({}, document.title, url.toString());

            setToken(accessTokenFromUrl);
            setIsAuthenticated(true);
            setIsLoggedIn(true);
            setAuthLoading(false);
            return;
          }
        }

        if (accessToken) {
          Tokens.SetAccessToken(accessToken);
          Tokens.RemoveRefreshToken();
        }

        const token = await Tokens.GetValidToken();

        if (token) {
          const isAnon = isAnonToken(token);
          if (isAnon && !allowAnonymous) {
            handleLogout();
            return;
          }

          setIsAuthenticated(true);
          setToken(token);
          if (!isAnon) setIsLoggedIn(true);
          setAuthLoading(false);
          return;
        }

        if (openIdConnect?.enabled && openIdConnect?.autoRedirect) {
          return handleOpenIdConnectAutoRedirect();
        }

        if (!allowAnonymous) {
          setAuthLoading(false);
          return;
        }

        const { access_token, refresh_token } = await Auth.Anonymous(
          clientId,
          scope,
          customScope
        );

        Tokens.SetAccessToken(access_token);
        Tokens.SetRefreshToken(refresh_token);
        setIsAuthenticated(true);
        setIsLoggedIn(false);
        setAuthLoading(false);
      },
      [allowAnonymous, clientId, scope, customScope, handleLogout]
    )
  );

  const newAnonSession = useCallback(async () => {
    const token = await Tokens.GetValidToken();
    const isAnon = isAnonToken(token);
    if (isAnon) {
      try {
        const { access_token, refresh_token } = await Auth.Anonymous(
          clientId,
          scope,
          customScope
        );

        Tokens.SetAccessToken(access_token);
        Tokens.SetRefreshToken(refresh_token);
        setIsAuthenticated(true);
        setIsLoggedIn(false);
      } catch (error) {
        console.log(error);
        setIsAuthenticated(false);
        setIsLoggedIn(false);
      }
    } else {
      console.warn(
        "Improper useage of `newAnonSession`: User is not anonymous."
      );
    }
  }, [clientId, customScope, scope]);

  useEffect(() => {
    if (!interceptorSetup) {
      axios.interceptors.request.use(
        async (config) => {
          await verifyToken();
          const verifiedToken = Tokens.GetAccessToken();
          config.headers.Authorization = `Bearer ${verifiedToken}`;
          // Do something before request is sent
          return config;
        },
        function (error) {
          // Do something with request error
          return Promise.reject(error);
        }
      );
      interceptorSetup = true;
    }

    if (!isAuthenticated) {
      verifyToken();
    }
  }, [baseApiUrl, clientId, isAuthenticated, verifyToken]);

  const handleProvidedToken = useCallback(
    async (accessToken: string) => {
      await verifyToken(accessToken);
    },
    [verifyToken]
  );

  const ordercloudContext = useMemo(() => {
    return {
      baseApiUrl,
      clientId,
      scope,
      customScope,
      allowAnonymous,
      isAuthenticated,
      isLoggedIn,
      newAnonSession,
      token,
      xpSchemas,
      autoApplyPromotions,
      authLoading,
      currencyDefaults,
      logout: handleLogout,
      login: handleLogin,
      loginWithOpenIdConnect: handleLoginWithOpenIdConnect,
      setToken: handleProvidedToken,
      defaultErrorHandler,
    };
  }, [
    baseApiUrl,
    clientId,
    scope,
    customScope,
    allowAnonymous,
    isAuthenticated,
    isLoggedIn,
    newAnonSession,
    token,
    xpSchemas,
    autoApplyPromotions,
    authLoading,
    currencyDefaults,
    handleLogout,
    handleLogin,
    handleLoginWithOpenIdConnect,
    handleProvidedToken,
    defaultErrorHandler,
  ]);

  return (
    <OrderCloudContext.Provider value={ordercloudContext}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: asyncStoragePersister }}
      >
        {children}
      </PersistQueryClientProvider>
    </OrderCloudContext.Provider>
  );
};

export default OrderCloudProvider;
