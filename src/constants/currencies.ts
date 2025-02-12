import {
  LineItem,
  Order,
  OrderReturn,
  Payment,
  PriceSchedule,
  ShipmentItem,
} from "ordercloud-javascript-sdk";
import { useOcResourceGet, useOrderCloudContext } from "../hooks";

interface CurrencyValues {
  languageType: string;
  currencyType: string;
}

interface ICurrencyData {
  currencyProperties: Array<string>;
  dependencies?: Array<string>;
  renderCurrencyInputs(
    tableRow?: unknown,
    params?: Array<string>
  ): CurrencyValues;
}

const getCurrencyValues = (
  language?: string | null,
  currency?: string | null
) => {
  // if no value passed in, use default from the provider
  const { currencyDefaults } = useOrderCloudContext();
  return {
    languageType: language || currencyDefaults.language,
    currencyType: currency || currencyDefaults.currencyCode,
  };
};

const OrderCurrency: ICurrencyData = {
  currencyProperties: [
    "Subtotal",
    "ShippingCost",
    "TaxCost",
    "Gratuity",
    "PromotionDiscount",
    "Total",
  ],
  renderCurrencyInputs: (order: any) => {
    const language = order?.FromUser?.Locale?.Language;
    const currency = order?.Currency;
    return getCurrencyValues(language, currency);
  },
};

const LineItemCurrency: ICurrencyData = {
  currencyProperties: [
    "UnitPrice",
    "PromotionDiscount",
    "LineTotal",
    "LineSubtotal",
    "PriceMarkup",
  ],
  dependencies: ["direction"],
  renderCurrencyInputs: (lineItem: LineItem, params: Array<string>) => {
    var orderResult = useOcResourceGet<Order>("Orders", {
      direction: params[0]!,
      orderID: lineItem.IncomingOrderID!,
    });
    const language = orderResult?.data?.FromUser?.Locale?.Language;
    const currency = orderResult?.data?.Currency;
    return getCurrencyValues(language, currency);
  },
};

const PriceScheduleCurrency: ICurrencyData = {
  currencyProperties: [
    "Price",
    "SalePrice",
    "SubscriptionPrice",
    "BundlePrice",
  ],
  renderCurrencyInputs: (ps: PriceSchedule) => {
    const currency = ps?.Currency;
    return getCurrencyValues(null, currency);
  },
};

const SpecCurrency: ICurrencyData = {
  currencyProperties: ["PriceMarkup"],
  renderCurrencyInputs: () => getCurrencyValues(),
};

const SpendingAccountCurrency: ICurrencyData = {
  currencyProperties: ["Balance"],
  renderCurrencyInputs: () => getCurrencyValues(),
};

const ShipmentCurrency: ICurrencyData = {
  currencyProperties: ["Cost"],
  renderCurrencyInputs: () => getCurrencyValues(),
};

const ShipmentItemCurrency: ICurrencyData = {
  currencyProperties: ["UnitPrice"],
  // note: if multiple order IDs exist on a list of shipment items, this will make a call for each
  renderCurrencyInputs: (shipmentItem: ShipmentItem) => {
    var orderResult = useOcResourceGet<Order>("Orders", {
      direction: "Incoming",
      orderID: shipmentItem.OrderID!,
    });
    const language = orderResult?.data?.FromUser?.Locale?.Language;
    const currency = orderResult?.data?.Currency;
    return getCurrencyValues(language, currency);
  },
};

const OrderReturnCurrency: ICurrencyData = {
  currencyProperties: ["RefundAmount"],
  renderCurrencyInputs: (orderReturn: OrderReturn) => {
    var orderResult = useOcResourceGet<Order>("Orders", {
      direction: "Incoming",
      orderID: orderReturn.OrderID,
    });
    const language = orderResult?.data?.FromUser?.Locale?.Language;
    const currency = orderResult?.data?.Currency;
    return getCurrencyValues(language, currency);
  },
};

const PaymentCurrency: ICurrencyData = {
  currencyProperties: ["Amount"],
  dependencies: ["direction", "orderID"], // order ID only available in parameters
  renderCurrencyInputs: (_payment: Payment, params: Array<string>) => {
    var orderResult = useOcResourceGet<Order>("Orders", {
      direction: params[0]!,
      orderID: params[1]!,
    });
    const language = orderResult?.data?.FromUser?.Locale?.Language;
    const currency = orderResult?.data?.Currency;
    return getCurrencyValues(language, currency);
  },
};

const PromotionsCurrency: ICurrencyData = {
  currencyProperties: ["Amount"],
  dependencies: ["direction", "orderID"], // order ID only available in parameters
  renderCurrencyInputs: (_promotion: Payment, params: Array<string>) => {
    var orderResult = useOcResourceGet<Order>("Orders", {
      direction: params[0]!,
      orderID: params[1]!,
    });
    const language = orderResult?.data?.FromUser?.Locale?.Language;
    const currency = orderResult?.data?.Currency;
    return getCurrencyValues(language, currency);
  },
};

export const currencyFormats: {
  [resourceID: string]: ICurrencyData;
} = {
  Orders: OrderCurrency,
  LineItems: LineItemCurrency,
  SpecOptions: SpecCurrency,
  Shipments: ShipmentCurrency,
  OrderShipment: ShipmentCurrency,
  ShipmentItems: ShipmentItemCurrency,
  Payments: PaymentCurrency,
  OrderReturns: OrderReturnCurrency,
  SpendingAccounts: SpendingAccountCurrency,
  PriceSchedules: PriceScheduleCurrency,
  SubscriptionItems: LineItemCurrency,
  Promotions: PromotionsCurrency,
  OrderPromotions: PromotionsCurrency,
};
