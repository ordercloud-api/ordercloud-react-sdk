import { UseQueryResult } from "@tanstack/react-query";
import {
  Address,
  Cart,
  IntegrationEvents,
  LineItem,
  OrderCloudError,
  Orders,
  OrderShipMethodSelection,
  OrderWorksheet,
  PartialDeep,
  RequiredDeep,
  Tokens,
} from "ordercloud-javascript-sdk";
import { useCallback, useMemo } from "react";
import { queryClient, useOrderCloudContext } from "..";
import { isAnonToken } from "../utils";
import useAuthMutation from "./useAuthMutation";
import useAuthQuery from "./useAuthQuery";

const useShopper = () => {
  const { autoApplyPromotions, newAnonSession } = useOrderCloudContext();

  const invalidateWorksheet = useCallback(async () => {
    queryClient.invalidateQueries({
      queryKey: ["worksheet"],
    });
  }, []);

  const {
    data: orderWorksheet,
    isLoading,
    isPending,
  } = useAuthQuery({
    queryKey: ["worksheet"],
    queryFn: async () => await Cart.GetOrderWorksheet(),
  }) as UseQueryResult<RequiredDeep<OrderWorksheet>, OrderCloudError>;

  const { mutateAsync: applyPromotions } = useAuthMutation({
    mutationKey: ["applyPromos"],
    mutationFn: async () => {
      await Cart.ApplyPromotions();
      return;
    },
    onSuccess: () => invalidateWorksheet(),
  });

  const { mutateAsync: addCartLineItem } = useAuthMutation({
    mutationKey: ["addCartLineItem"],
    mutationFn: async (lineItem: LineItem) =>
      await Cart.CreateLineItem(lineItem),
    onSuccess: () => {
      if (autoApplyPromotions) applyPromotions();
      invalidateWorksheet();
    },
  });

  const { mutateAsync: patchCartLineItem } = useAuthMutation({
    mutationKey: ["patchCartLineItem"],
    mutationFn: async ({
      ID,
      lineItem,
    }: {
      ID: string;
      lineItem: PartialDeep<LineItem>;
    }) => await Cart.PatchLineItem(ID, lineItem),
    onSuccess: () => {
      if (autoApplyPromotions) applyPromotions();
      invalidateWorksheet();
    },
  });

  const { mutateAsync: deleteCartLineItem } = useAuthMutation({
    mutationKey: ["deleteCartLineItem"],
    mutationFn: async (ID: string) => await Cart.DeleteLineItem(ID),
    onSuccess: () => {
      if (autoApplyPromotions) applyPromotions();
      invalidateWorksheet();
    },
  });

  const { mutateAsync: setShippingAddress } = useAuthMutation({
    mutationKey: ["setShippingAddress"],
    mutationFn: async (address: Address) =>
      await Cart.SetShippingAddress(address),
    onSuccess: () => {
      if (autoApplyPromotions) applyPromotions();
      invalidateWorksheet();
    },
  });

  const { mutateAsync: setShippingAddressByID } = useAuthMutation({
    mutationKey: ["setShippingAddressByID"],
    mutationFn: async (addressID: string) => {
      if (!orderWorksheet)
        return Promise.reject("Order worksheet was not retrieved yet.");
      return await Orders.Patch("Outgoing", orderWorksheet?.Order.ID, {
        ShippingAddressID: addressID,
      });
    },
    onSuccess: () => {
      if (autoApplyPromotions) applyPromotions();
      invalidateWorksheet();
    },
  });

  const { mutateAsync: setBillingAddress } = useAuthMutation({
    mutationKey: ["setBillingAddress"],
    mutationFn: async (address: Address) =>
      await Cart.SetBillingAddress(address),
    onSuccess: () => {
      if (autoApplyPromotions) applyPromotions();
      invalidateWorksheet();
    },
  });

  const { mutateAsync: estimateShipping } = useAuthMutation({
    mutationKey: ["estimateShipping"],
    mutationFn: async () => {
      if (!orderWorksheet) {
        return Promise.reject("Order worksheet was not retrieved yet.");
      }
      return await IntegrationEvents.EstimateShipping(
        "Outgoing",
        orderWorksheet.Order.ID
      );
    },
    onSuccess: () => {
      if (autoApplyPromotions) applyPromotions();
      invalidateWorksheet();
    },
  });

  const { mutateAsync: selectShipMethods } = useAuthMutation({
    mutationKey: ["selectShipMethods"],
    mutationFn: async (selection:OrderShipMethodSelection) => {
      if (!orderWorksheet) {
        return Promise.reject("Order worksheet was not retrieved yet.");
      }
      return await IntegrationEvents.SelectShipmethods(
        "Outgoing",
        orderWorksheet.Order.ID,
        selection
      );
    },
    onSuccess: () => {
      if (autoApplyPromotions) applyPromotions();
      invalidateWorksheet();
    },
  });

  const { mutateAsync: setBillingAddressByID } = useAuthMutation({
    mutationKey: ["setBillingAddressByID"],
    mutationFn: async (addressID: string) => {
      if (!orderWorksheet)
        return Promise.reject("Order worksheet was not retrieved yet.");
      return await Orders.Patch("Outgoing", orderWorksheet?.Order.ID, {
        BillingAddressID: addressID,
      });
    },
    onSuccess: () => {
      if (autoApplyPromotions) applyPromotions();
      invalidateWorksheet();
    },
  });

  // const { mutateAsync: clearShipping } = useAuthMutation({
  //   mutationKey: ["clearShipping"],
  //   mutationFn: async (addressID: string) => {
  //     if (!orderWorksheet)
  //       return Promise.reject("Order worksheet was not retrieved yet.");
  //     //TODO: unsure about how to do this using the SDK
  //     // return await Orders.Patch("Outgoing", orderWorksheet?.Order.ID, {
  //     //   ShippingAddressID: null,
  //     //   ShippingAddress: null
  //     // });
  //   },
  //   onSuccess: () => {
  //     if (autoApplyPromotions) applyPromotions();
  //     invalidateWorksheet();
  //   },
  // });

  const { mutateAsync: addCartPromo } = useAuthMutation({
    mutationKey: ["addCartPromo"],
    mutationFn: async (promoCode: string) => await Cart.AddPromotion(promoCode),
    onSuccess: () => invalidateWorksheet(),
  });

  const { mutateAsync: removeCartPromo } = useAuthMutation({
    mutationKey: ["removeCartPromo"],
    mutationFn: async (promoCode: string) =>
      await Cart.DeletePromotion(promoCode),
    onSuccess: () => invalidateWorksheet(),
  });

  const { mutateAsync: listEligiblePromotions } = useAuthMutation({
    mutationKey: ["listPromotions"],
    mutationFn: async () => await Cart.ListEligiblePromotions(),
    onSuccess: () => invalidateWorksheet(),
  });

  const { mutateAsync: calculateOrder } = useAuthMutation({
    mutationKey: ["calculateOrder"],
    mutationFn: async () => {
      if (!orderWorksheet)
        return Promise.reject("Order worksheet was not retrieved yet.");
      return await IntegrationEvents.Calculate('Outgoing', orderWorksheet.Order.ID);
    },
    onSuccess: async () => {
      if (autoApplyPromotions) applyPromotions();
      invalidateWorksheet();
    },
  });

  const { mutateAsync: submitCart } = useAuthMutation({
    mutationKey: ["submitCart"],
    mutationFn: async () => {
      await Cart.Submit();
      return;
    },
    onSuccess: async () => {
      const token = await Tokens.GetValidToken();
      const isAnon = isAnonToken(token);
      if (!isAnon) {
        invalidateWorksheet();
      }
    },
  });

  const continueShopping = useCallback(async () => {
    await newAnonSession();
    invalidateWorksheet();
  }, [invalidateWorksheet, newAnonSession]);

  const { mutateAsync: deleteCart } = useAuthMutation({
    mutationKey: ["deleteCart"],
    mutationFn: async () => await Cart.Delete(),
    onSuccess: () => invalidateWorksheet(),
  });

  return useMemo(() => {
    return {
      orderWorksheet,
      worksheetLoading: isPending || isLoading,
      refreshWorksheet: invalidateWorksheet,
      addCartLineItem,
      patchCartLineItem,
      deleteCartLineItem,
      setShippingAddress,
      setShippingAddressByID,
      estimateShipping,
      selectShipMethods,
      setBillingAddress,
      setBillingAddressByID,
      addCartPromo,
      calculateOrder,
      submitCart,
      continueShopping,
      deleteCart,
      removeCartPromo,
      applyPromotions,
      listEligiblePromotions,
    };
  }, [
    orderWorksheet,
    isPending,
    isLoading,
    invalidateWorksheet,
    addCartLineItem,
    patchCartLineItem,
    deleteCartLineItem,
    setShippingAddress,
    setShippingAddressByID,
    estimateShipping,
    selectShipMethods,
    setBillingAddress,
    setBillingAddressByID,
    addCartPromo,
    calculateOrder,
    submitCart,
    continueShopping,
    deleteCart,
    removeCartPromo,
    applyPromotions,
    listEligiblePromotions,
  ]);
};

export default useShopper;
