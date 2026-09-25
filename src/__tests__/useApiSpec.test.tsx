import { renderHook, waitFor } from "@testing-library/react";
import { PropsWithChildren } from "react";
import { describe, expect, it, vi } from "vitest";
import { OrderCloudProvider } from "../index";
import useApiSpec from "../hooks/useApiSpec";

const { dereference, GetValidToken } = vi.hoisted(() => ({
  dereference: vi.fn(),
  GetValidToken: vi.fn(),
}));

vi.mock("@apidevtools/swagger-parser", () => ({
  default: { dereference },
}));

vi.mock("ordercloud-javascript-sdk", () => ({
  Configuration: { Set: vi.fn() },
  Tokens: {
    GetValidToken,
    GetAccessToken: vi.fn(),
    SetAccessToken: vi.fn(),
    SetRefreshToken: vi.fn(),
    RemoveAccessToken: vi.fn(),
    RemoveRefreshToken: vi.fn(),
  },
  Auth: { Anonymous: vi.fn(), Login: vi.fn() },
}));

const baseApiUrl = "https://sandboxapi.ordercloud.io";

function wrapper({ children }: PropsWithChildren) {
  return (
    <OrderCloudProvider
      baseApiUrl={baseApiUrl}
      clientId="openapi-test-client"
      allowAnonymous={false}
    >
      {children}
    </OrderCloudProvider>
  );
}

describe("useApiSpec", () => {
  it("dereferences the OpenAPI document and exposes its operations and schemas", async () => {
    GetValidToken.mockResolvedValue(undefined);
    dereference.mockResolvedValue({
      openapi: "3.0.0",
      info: { title: "OrderCloud", version: "1.2.3.4" },
      servers: [{ url: "https://stale.example.com/v1" }],
      paths: {
        "/products": {
          get: {
            operationId: "Products.List",
            tags: ["Products"],
          },
        },
      },
      components: {
        schemas: {
          Product: { type: "object" },
        },
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ BuildNumber: "1.2.3.4" }),
      })
    );

    const { result } = renderHook(() => useApiSpec(), { wrapper });

    await waitFor(() => {
      expect(result.current.operationsById["Products.List"]).toMatchObject({
        operationId: "Products.List",
        path: "/products",
        verb: "get",
      });
    });

    expect(result.current.schemas.Product).toMatchObject({ type: "object" });
    expect(dereference).toHaveBeenCalledWith(`${baseApiUrl}/v1/openapi/v3`);
  });
});
