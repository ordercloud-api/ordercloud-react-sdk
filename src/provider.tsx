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

let interceptorSetup = false;
const OrderCloudProvider: FC<PropsWithChildren<IOrderCloudProvider>> = ({
  children,
  baseApiUrl,
  clientId,
  scope,
  customScope,
  allowAnonymous,
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

  const handleLogout = useCallback(() => {
    queryClient.clear();
    setIsAuthenticated(false);
    setIsLoggedIn(false);
    setToken(undefined);
    Tokens.RemoveAccessToken();
    Tokens.RemoveRefreshToken();
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

  const verifyToken = useCallback(
    async (accessToken?: string) => {
      setAuthLoading(true);
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
    } else {
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
