import { createContext } from "react";
import { IOrderCloudContext } from "./models/IOrderCloudContext";
import { OpenAPIV3 } from "openapi-types";

const INITIAL_ORDERCLOUD_CONTEXT: IOrderCloudContext = {
  isAuthenticated: false,
  isLoggedIn: false,
  logout: () => {},
  login: async (username: string, password: string, rememberMe?: boolean) => {
    return Promise.reject({username, password, rememberMe})
  },
  loginWithOpenIdConnect: (
    openIdConnectId: string
  ) => {
    throw new Error(
      `loginWithOpenIdConnect is not implemented. ${openIdConnectId}`
    );
  },
  setToken: async (accessToken: string ) => {
    return Promise.reject({accessToken})
  },
  newAnonSession: async () => {
    return Promise.reject();
  },
  baseApiUrl: "https://api.ordercloud.io/v1",
  clientId: "",
  allowAnonymous: false,
  token: undefined,
  autoApplyPromotions: false,
  xpSchemas: {} as OpenAPIV3.SchemaObject,
  authLoading: true,
  currencyDefaults: {} as { currencyCode: string, language: string }
};

export const OrderCloudContext = createContext<IOrderCloudContext>(
  INITIAL_ORDERCLOUD_CONTEXT
);
