import { render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  OrderCloudProvider,
  useAuthMutation,
  useAuthQuery,
  useOcForm,
  useOrderCloudContext,
} from "../index";

const mockAnonToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c3IiOiJhbm9uIiwiY2lkIjoidGVzdC1jbGllbnQiLCJ1aWQiOiJhbm9uLXVpZCIsInJvbGUiOltdLCJhdWQiOiJhcGkub3JkZXJjbG91ZC5pbyIsImlzcyI6ImFwaS5vcmRlcmNsb3VkLmlvIiwibmJmIjoxNjAwMDAwMDAwLCJleHAiOjQxMDI0NDQ4MDAsImp0aSI6ImFub24tand0In0.signature";

const mockAccessToken = {
  access_token: mockAnonToken,
  refresh_token: "refresh-token",
  expires_in: 3600,
  token_type: "Bearer",
};

const { Tokens, Auth, Configuration } = vi.hoisted(() => {
  const Tokens = {
    SetAccessToken: vi.fn(),
    SetRefreshToken: vi.fn(),
    RemoveAccessToken: vi.fn(),
    RemoveRefreshToken: vi.fn(),
    GetAccessToken: vi.fn(),
    GetValidToken: vi.fn(),
  };

  const Auth = {
    Anonymous: vi.fn(),
    Login: vi.fn(),
  };

  const Configuration = {
    Set: vi.fn(),
  };

  return { Tokens, Auth, Configuration };
});

vi.mock("ordercloud-javascript-sdk", () => ({
  Auth,
  Tokens,
  Configuration,
  OrderCloudError: class OrderCloudError extends Error {
    constructor(message?: string) {
      super(message);
      this.name = "OrderCloudError";
    }
  },
}));

vi.mock("../hooks/useOperations", () => ({
  default: () => ({
    saveOperation: {
      requestBody: {
        content: {
          "application/json": {
            schema: {
              required: ["Name"],
              allOf: [
                {
                  properties: {
                    Name: { type: "string", example: "Example" },
                  },
                  example: { Name: "Example" },
                },
              ],
            },
          },
        },
      },
    },
    createOperation: {
      requestBody: {
        content: {
          "application/json": {
            schema: {
              required: ["Name"],
              allOf: [
                {
                  properties: {
                    Name: { type: "string", example: "Example" },
                  },
                  example: { Name: "Example" },
                },
              ],
            },
          },
        },
      },
    },
    assignmentSaveOperation: undefined,
  }),
}));

const defaultProviderProps = {
  baseApiUrl: "https://sandboxapi.ordercloud.io",
  clientId: "test-client",
  allowAnonymous: true,
  scope: [] as never[],
};

function ContextProbe() {
  const ctx = useOrderCloudContext();
  return (
    <div>
      <span data-testid="client-id">{ctx.clientId}</span>
      <span data-testid="authenticated">{String(ctx.isAuthenticated)}</span>
      <span data-testid="auth-loading">{String(ctx.authLoading)}</span>
    </div>
  );
}

function SsoProbe() {
  const { loginWithOpenIdConnect } = useOrderCloudContext();
  return (
    <button type="button" onClick={() => loginWithOpenIdConnect("idp-1")}>
      sso
    </button>
  );
}

function AuthQueryProbe({
  onError,
  disabled,
  queryKey = ["auth-query-probe"],
}: {
  onError?: (error: unknown) => void;
  disabled?: boolean;
  queryKey?: string[];
}) {
  const query = useAuthQuery(
    {
      queryKey,
      queryFn: async () => ({ ok: true }),
      disabled,
      retry: false,
    },
    onError as never
  );

  return (
    <div>
      <span data-testid="query-status">{query.status}</span>
      <span data-testid="query-fetch-status">{query.fetchStatus}</span>
      <span data-testid="query-data">{JSON.stringify(query.data ?? null)}</span>
      <span data-testid="query-error">{query.error ? "yes" : "no"}</span>
    </div>
  );
}

function AuthQueryErrorProbe({
  onError,
}: {
  onError?: (error: unknown) => void;
}) {
  const query = useAuthQuery(
    {
      queryKey: ["auth-query-error"],
      queryFn: async () => {
        throw Object.assign(new Error("boom"), { name: "OrderCloudError" });
      },
      retry: false,
    },
    onError as never
  );

  return <span data-testid="query-error">{query.error ? "yes" : "no"}</span>;
}

function AuthMutationProbe({
  onError,
}: {
  onError?: (error: unknown) => void;
}) {
  const mutation = useAuthMutation({
    mutationKey: ["auth-mutation-probe"],
    mutationFn: async () => {
      throw Object.assign(new Error("mutate-boom"), {
        name: "OrderCloudError",
      });
    },
    onError: onError as never,
  });

  return (
    <button type="button" onClick={() => mutation.mutate()}>
      mutate
    </button>
  );
}

function OcFormProbe() {
  const { methods } = useOcForm("Products", {
    body: { Name: "Starter" },
  });

  return (
    <form>
      <span data-testid="form-ready">{String(Boolean(methods))}</span>
      <span data-testid="form-name">
        {String(methods.getValues("body.Name") ?? "")}
      </span>
    </form>
  );
}

function activeRequestInterceptorCount() {
  const handlers = (
    axios.interceptors.request as unknown as {
      handlers: Array<unknown | null>;
    }
  ).handlers;
  return handlers.filter(Boolean).length;
}

describe("public exports", () => {
  it("exposes the primary SDK surface", async () => {
    const sdk = await import("../index");
    expect(sdk.OrderCloudProvider).toBeTypeOf("function");
    expect(sdk.useOrderCloudContext).toBeTypeOf("function");
    expect(sdk.useAuthQuery).toBeTypeOf("function");
    expect(sdk.useAuthMutation).toBeTypeOf("function");
    expect(sdk.useOcForm).toBeTypeOf("function");
    expect(sdk.queryClient).toBeTruthy();
  });
});

describe("OrderCloudProvider", () => {
  beforeEach(() => {
    Tokens.GetValidToken.mockResolvedValue(mockAnonToken);
    Tokens.GetAccessToken.mockReturnValue(mockAnonToken);
    Auth.Anonymous.mockResolvedValue(mockAccessToken);
    Auth.Login.mockResolvedValue(mockAccessToken);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders children and supplies useOrderCloudContext", async () => {
    render(
      <OrderCloudProvider {...defaultProviderProps}>
        <ContextProbe />
      </OrderCloudProvider>
    );

    expect(screen.getByTestId("client-id")).toHaveTextContent("test-client");

    await waitFor(() => {
      expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
    });
    expect(Configuration.Set).toHaveBeenCalled();
  });

  it("does not register a second Axios request interceptor under StrictMode", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const consoleWarn = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    const before = activeRequestInterceptorCount();

    render(
      <StrictMode>
        <OrderCloudProvider {...defaultProviderProps}>
          <ContextProbe />
        </OrderCloudProvider>
      </StrictMode>
    );

    await waitFor(() => {
      expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
    });

    expect(activeRequestInterceptorCount()).toBeLessThanOrEqual(before + 1);

    const reactNoise = [...consoleError.mock.calls, ...consoleWarn.mock.calls]
      .flat()
      .map(String)
      .filter(
        (message) =>
          /Warning:|ReactDOM.render|findDOMNode|defaultProps|React\.createFactory|react-dom\/test-utils/i.test(
            message
          )
      );

    expect(reactNoise).toEqual([]);
    consoleError.mockRestore();
    consoleWarn.mockRestore();
  });

  it("redirects to the OpenID Connect login URL", () => {
    const assign = vi.fn();
    const location = window.location;
    vi.stubGlobal("location", { ...location, assign, search: "" });

    render(
      <OrderCloudProvider
        {...defaultProviderProps}
        allowAnonymous={false}
        openIdConnect={{
          enabled: true,
          accessTokenQueryParamName: "token",
          configs: [{ id: "idp-1" }],
        }}
      >
        <SsoProbe />
      </OrderCloudProvider>
    );

    screen.getByRole("button", { name: "sso" }).click();

    expect(assign).toHaveBeenCalledWith(
      "https://sandboxapi.ordercloud.io/ocrplogin?id=idp-1&cid=test-client"
    );
    vi.unstubAllGlobals();
  });
});

describe("useAuthQuery", () => {
  beforeEach(() => {
    Tokens.GetValidToken.mockResolvedValue(mockAnonToken);
    Tokens.GetAccessToken.mockReturnValue(mockAnonToken);
  });

  it("gates fetching on authentication and returns data when authenticated", async () => {
    render(
      <OrderCloudProvider {...defaultProviderProps}>
        <AuthQueryProbe />
      </OrderCloudProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("query-data")).toHaveTextContent(
        '{"ok":true}'
      );
    });
  });

  it("does not fetch when disabled", async () => {
    render(
      <OrderCloudProvider {...defaultProviderProps}>
        <AuthQueryProbe disabled queryKey={["auth-query-disabled"]} />
      </OrderCloudProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("query-fetch-status")).toHaveTextContent(
        "idle"
      );
    });
    expect(screen.getByTestId("query-data")).toHaveTextContent("null");
    expect(screen.getByTestId("query-status")).toHaveTextContent("pending");
  });

  it("prefers a per-call onError handler over the provider default", async () => {
    const onError = vi.fn();
    const defaultErrorHandler = vi.fn();

    render(
      <OrderCloudProvider
        {...defaultProviderProps}
        defaultErrorHandler={defaultErrorHandler}
      >
        <AuthQueryErrorProbe onError={onError} />
      </OrderCloudProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("query-error")).toHaveTextContent("yes");
    });

    expect(onError).toHaveBeenCalled();
    expect(defaultErrorHandler).not.toHaveBeenCalled();
  });

  it("delegates to defaultErrorHandler when no per-call handler is provided", async () => {
    const defaultErrorHandler = vi.fn();

    render(
      <OrderCloudProvider
        {...defaultProviderProps}
        defaultErrorHandler={defaultErrorHandler}
      >
        <AuthQueryErrorProbe />
      </OrderCloudProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("query-error")).toHaveTextContent("yes");
    });

    expect(defaultErrorHandler).toHaveBeenCalled();
  });
});

describe("useAuthMutation", () => {
  beforeEach(() => {
    Tokens.GetValidToken.mockResolvedValue(mockAnonToken);
    Tokens.GetAccessToken.mockReturnValue(mockAnonToken);
  });

  it("delegates errors to onError when provided", async () => {
    const onError = vi.fn();
    const defaultErrorHandler = vi.fn();

    render(
      <OrderCloudProvider
        {...defaultProviderProps}
        defaultErrorHandler={defaultErrorHandler}
      >
        <AuthMutationProbe onError={onError} />
      </OrderCloudProvider>
    );

    screen.getByRole("button", { name: "mutate" }).click();

    await waitFor(() => {
      expect(onError).toHaveBeenCalled();
    });
    expect(defaultErrorHandler).not.toHaveBeenCalled();
  });
});

describe("useOcForm", () => {
  beforeEach(() => {
    Tokens.GetValidToken.mockResolvedValue(mockAnonToken);
    Tokens.GetAccessToken.mockReturnValue(mockAnonToken);
  });

  it("wires react-hook-form methods for a resource", async () => {
    render(
      <OrderCloudProvider {...defaultProviderProps}>
        <OcFormProbe />
      </OrderCloudProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("form-ready")).toHaveTextContent("true");
      expect(screen.getByTestId("form-name")).toHaveTextContent("Starter");
    });
  });
});
