import { jwtDecode } from "jwt-decode";
import { DecodedToken, OrderCloudError } from "ordercloud-javascript-sdk";
import { ServiceListOptions } from "./hooks/useOcResource";

export const parseToken = (token: string) => {
  const parsed = jwtDecode<DecodedToken>(token);
  return parsed;
};

export const isAnonToken = (token: string) => {
  const parsed = jwtDecode<DecodedToken>(token);
  return !!parsed.orderid;
};

export const getRoles = (token: string) => {
  if(!token) return undefined
  const parsed = jwtDecode<DecodedToken>(token);
  return parsed.role;
};

export const defaultRetryFn = (failureCount: number, error: unknown) => {
  const { status } = error as OrderCloudError;
  switch (status) {
    case 401:
    case 403:
      return false;
  }
  return failureCount < 3;
};

export const isRouteParam = (operation: any, paramName: string) => {
  return (
    operation.parameters &&
    operation.parameters
      .filter((param: any) => {
        return param.in === 'path'
      })
      .map((param: any) => param.name)
      .includes(paramName)
  )
}

export const getRoutingUrl = (operation: any, params: any)=> {
  let url = operation?.path
  if(!url) return ""
  const paramsTest = params
  if (url.indexOf('{') > -1) {
    Object.entries(paramsTest)
      .filter(([key]: [string, any]) => {
        return isRouteParam(operation, key)
      })
      .forEach(([key, value]: [string, any]) => {
        if (value) {
          url = url.replace(`{${key}}`, value)
        }
      })
    return url
  }
  return url
}

export const makeQueryString = (params: ServiceListOptions | undefined) => {
  if(!params) return
  return `${Object.entries(params)
    .filter(([, val]: [string, any]) => {
      return typeof val === 'object'
        ? Boolean(val.length) || Boolean(Object.values(val).length)
        : Boolean(val)
    })
    .map(([key, val]: [string, any]) => {
      /**
       * TODO: Figure out a more dynamic way of checking the openapi spec for
       * identifying how to parse object values into the query string. Right now
       * we know that searchOn & sortBy are supposed have 1 key - but there could
       * be others (right now, or in the future)
       */
      if (key === 'filters') {
        return Object.entries(val)
          .filter(([fkey, fval]: [string, any]) => {
            return fkey.length && fval.length
          })
          .map(([fkey, fval]: [string, any]) => {
            return `${fkey}=${encodeURIComponent(fval)}`
          })
          .join('&')
      } else {
        if (typeof val === 'object' && (key === 'searchOn' || key === 'sortBy')) {
          return `${key}=${val.map(encodeURIComponent).join(',')}`
        } else if (typeof val === "object") {
          return `${key}=${val
            .map((v: string) => encodeURIComponent(v))
            .join("|")}`
        } else {
          return `${key}=${encodeURIComponent(val)}`
        }
      }
    })
    .join('&')}`
}

export const getRequiredParamsInPath = (getOperation: any) => {
  const result =
    getOperation && getOperation?.parameters
      ? getOperation.parameters.filter((p: any) => p.in === 'path' && p.required).map((p: any) => p.name)
      : []
  return result
}



