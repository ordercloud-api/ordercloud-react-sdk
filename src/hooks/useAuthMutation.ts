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
      onError: (
        error: TError,
        variables: TVariables,
        context: TContext | undefined,
        mutationContext
      ) => {
        if (options.onError) {
          return options.onError(error, variables, context, mutationContext);
        }
        if (defaultErrorHandler) {
          const e = error as OrderCloudError;
          return defaultErrorHandler(e, { isAuthenticated, ...rest });
        }
      },
    };
  }, [isAuthenticated, disabled, options, defaultErrorHandler, rest]);

  return useMutation({ ...restOptions, ...authMutationOptions });
}