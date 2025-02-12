import {
  DefaultError,
  UseMutationOptions,
  UseMutationResult,
  useMutation,
} from "@tanstack/react-query";
import { OrderCloudError } from "ordercloud-javascript-sdk";
import { useMemo } from "react";
import useOrderCloudContext from "./useOrderCloudContext";

export type UseOcMutationOptions<TData = unknown, TError = DefaultError, TVariables = void, TContext = unknown> = Omit<UseMutationOptions<TData, TError, TVariables, TContext>, 'enable'> & {
  disabled?: boolean;
}

export default function useAuthMutation<
  TData = unknown,
  TError = unknown,
  TVariables = void,
  TContext = unknown
>(
  options: UseOcMutationOptions<TData, TError, TVariables, TContext>
): UseMutationResult<TData, TError, TVariables, TContext> {
  const { isAuthenticated, defaultErrorHandler, ...rest } = useOrderCloudContext();
  const { disabled, ...restOptions} = options;

  const authMutationOptions: Omit<
    UseMutationOptions<TData, TError, TVariables, TContext>,
    "mutationFn"
  > = useMemo(() => {
    return {
      enabled: isAuthenticated && !disabled,
      onError: (error: TError) => {
        const e = error as OrderCloudError;
        return options.onError
        ? options.onError
        : defaultErrorHandler
        ? defaultErrorHandler(e, {isAuthenticated, ...rest})
        : undefined
      }
    };
  }, [isAuthenticated, disabled, options.onError, defaultErrorHandler, rest]);

  return useMutation({ ...restOptions, ...authMutationOptions });
}