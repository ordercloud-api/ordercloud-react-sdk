import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import {
  OrderCloudProvider,
  useOrderCloudContext,
} from "@ordercloud/react-sdk";

function Probe() {
  const { clientId, allowAnonymous } = useOrderCloudContext();
  return (
    <div>
      <span data-client-id={clientId}>{clientId}</span>
      <span data-allow-anonymous={String(allowAnonymous)}>
        {String(allowAnonymous)}
      </span>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <OrderCloudProvider
      baseApiUrl="https://sandboxapi.ordercloud.io"
      clientId="consumer-fixture-client"
      allowAnonymous={false}
    >
      <Probe />
    </OrderCloudProvider>
  </StrictMode>
);
