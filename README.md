# OrderCloud React
This is a developer library for OrderCloud developers utilizing React for their frontend development. It is essentially a wrapper for Tanstack query, which provides a lot of good functionality out of the box for background refreshes, request de-duplication, and caching. You configure your API client settings on the `OrderCloudProvider` which will provide you with a global context accessible though the `useOrderCloudContext()` hook. In addition to this context hook, it provides "authenticated" versions of `useQuery` and `useMutation` for reading and manipulating OrderCloud data in an efficient manner.

# Peer Dependencies
To keep this package small, there are some required peer dependencies that are typical of an OrderCloud React application that utilizies tanstack libraries:

- @tanstack/react-query@^5.20.1
- @tanstack/react-table@^8.11.8
- ordercloud-javascript-sdk@^5.3.0
- react@^18.2.0
- react-dom@^18.2.0

# Usage

## `OrderCloudProvider`
It is recommended that the `OrderCloudProvider` be configured as close to the root of your application as possible. At the very least it needs to wrap any part of your application that will need to communicate with the OrderCloud API.

### Options

#### **baseApiUrl**: `string`
The OrderCloud base API URL for your marketplace. Usually found in the OrderCloud Portal.

#### **clientId**: `string`
The OrderCloud API Client ID that will be used for authentication

#### **scope**: `string[]`
An array of OrderCloud API Roles that will be requested upon authentication

#### **customScope**: `string[]`
An **optional** array of Custom Roles (strings) that will be requested upon authentication. Generally only needed if you are using Custom Roles in your marketplace's Security Profiles.

#### **allowAnonymous**: `boolean`
True will enable anonymous authentication (when the API client is properly configured). False will remain unauthenticated until the `login()` method is called by your application.

#### **xpSchemas**: `OpenAPIV3.SchemaObject`
An **optional** [Open API specification](https://swagger.io/specification/) object containing one or more xp schema definitions for OrderCloud resources.  Xp schemas will be used to generate resource property definitions in the `useColumns` hook as well as form fields in the `useOcForm` hook.  In the absence of a provided resource schema, xp data types will be inferred by default for individual items when using the `useOcForm` hook.

#### **defaultErrorHandler** `(error:OrderCloudError) => void`
An **optional** callback function for globally handling OrderCloud errors in your application. Useful for wiring up toast-like feedback.

## `useOrderCloudContext()` hook
This hook returns the OrderCloud context that the OrderCloudProvider sets up based on your provided options. If anonymous authentication is allowed the OrderCloud context will automatically be in an authenticated state on first page load (shortly after the first React lifecycle).

### Additional Properties
The OrderCloud context returns all of the information you configure on the OrderCloudProvider (`baseApiUrl`, `clientId`, etc.), along with some additional properties listed below.

#### **isAuthenticated**: `boolean`
When false, there is no valid OrderCloud access token available. Not to be confused with `isLoggedIn`.

#### **isLoggedIn**: `boolean`
When true, the currently active OrderCloud access token is a _registered_ user (not anonymous).

#### **login**: `(username:string, password:string, rememberMe:boolean) => Promise<AccessToken>`
An asyncrhonous callback method for building a login form for your application. When **rememberMe** is set to `true`, the `OrderCloudProvider` will attempt to store and use the `refresh_token` as long as it is valid. It is not necessary to do anything with the `AccessToken` response as this method will take care of managing the active token and authentication state for you.

#### **logout**: `() => void`
A callback for logging out a registered user from your application. This will also clear the Tanstack query client cache for OrderCloud API calls, forcing any actively used queries to refetch once anonymous auth takes over again or the user logs back in.

## `useAuthQuery()` hook
This is a wrapper for the `useQuery` Tanstack hook that utilizes the OrderCloud context to set `enabled` equal to `isAuthenticated`. It also checks for the presence of `query.error` and calls out to the supplied `defaultErrorHandler` if it was configured on the provider.

This hook supports all of the normal `UseQueryOptions` documented by Tanstack. In addition to these options, you can override the default error handler by passing a modified error handler as the second argument. Ultimately this hook will return the same `UseQueryResult` that is documented on Tanstack query.

### Usage
Here is an example of using the `useAuthQuery` hook to create a hook that returns the current user. 
```tsx
import { Me, MeUser, OrderCloudError, RequiredDeep } from "ordercloud-javascript-sdk";
import { useAuthQuery } from "@rwatt451/ordercloud-react";
import { UseMutationResult, UseQueryResult } from "@tanstack/react-query";

export function useCurrentUser():UseQueryResult<RequiredDeep<MeUser>, OrderCloudError> {
  return useAuthQuery({
    queryKey: ["currentUser"],
    queryFn: async () => await Me.Get(),
    retry: false,
    refetchOnMount:false,
  });
}
```
Specifying the `queryKey` is important here as it is what controls the query client caching and de-deuplication. This allows you to use the `useCurrentUser` hook anywhere in your application and it will only ever be called once.

## `useAuthMutation()` hook
This is a wrapper for the `useMutation` Tanstack hook that utilizes the OrderCloud context to set `enabled` equal to `isAuthenticated` - just like `useAuthQuery`.

This hook supports all of the normal `UseMutationOptions` documented by Tanstack. Because `useMutation` already has an option for `onError`, the wrapped `useAuthMutation` will utilize the `defaultErrorHandler` if configured at the provider level and a more specific `onError` callback hasn't been provided. This ultimately returns the same `UseMutationRestult` as Tanstack query.

### Usage
Here is an example of using the `useAuthMutation` hook to create a `UseMutationResult` for modifying the current user. 
```tsx
import { Me, MeUser, OrderCloudError, RequiredDeep } from "ordercloud-javascript-sdk";
import { queryClient, useAuthMutation } from "@rwatt451/ordercloud-react";
import { UseMutationResult } from "@tanstack/react-query";

export function useMutateCurrentUser():UseMutationResult<RequiredDeep<MeUser>, unknown, Partial<MeUser>, unknown> {
    return useAuthMutation({
        mutationKey: ["currentUser"],
        mutationFn: async (userData:Partial<MeUser>) => await Me.Patch(userData),
        onSuccess: (data) => {
            queryClient.setQueryData(["currentUser"], data)
        },
    })
}
```
Specifying the `mutationKey` is important here as it is what controls the query client caching and de-deuplication. The `onSuccess` option provides an avenue for updating the queryClient qury data cache. That way, any componenent that had used `useCurrentUser` will automatically get the updated value no matter where/when `mutate()` is called.

## `useOcResourceList()` hook
Returns an OrderCloud resource list query result from the resource List operation defined on the OrderCloud OpenAPI spec. This hook supports all of the normal `UseQueryOptions` documented by Tanstack. Ultimately this hook will return the same `UseQueryResult` that is documented on Tanstack query.

### Options

#### **resource**: `string`
The name of the OrderCloud resource to make a list call with.

#### **listOptions**: `ServiceListOptions`
An **optional** listOptions object for the OrderCloud list call.

#### **parameters**: `{ [key: string]: string }`
An **optional** parameters object for the OrderCloud list call.

#### **queryOptions**: `UseQueryOptions`
An **optional** `UseQueryOptions` object.  It is recommended to use a `staleTime` value .

### Usage
Here is an example of using the `useOcResourceList` hook to create a `UseQueryResult` for modifying the current user. 
```tsx
import { useOcResourceList } from "@rwatt451/ordercloud-react";

  const dataQuery = useOcResourceList('Orders', { IsSubmitted: true }, { direction: 'Incoming' }, {
    staleTime: 300000, // 5 min
  })
```

## `useOcResourceGet()` hook
Returns an OrderCloud resource get query result from the resource Get operation defined on the OrderCloud OpenAPI spec. This hook supports all of the normal `UseQueryOptions` documented by Tanstack. Ultimately this hook will return the same `UseQueryResult` that is documented on Tanstack query.

### Options

#### **resource**: `string`
The name of the OrderCloud resource to make a get call with.

#### **parameters**: `{ [key: string]: string }`
An **optional** parameters object for the OrderCloud get call.

#### **queryOptions**: `UseQueryOptions`
An **optional** `UseQueryOptions` object.  It is recommended to use a `staleTime` value .

### Usage
Here is an example of using the `useOcResourceGet` hook to create a `UseQueryResult` for modifying the current user. 
```tsx
import { useOcResourceGet } from "@rwatt451/ordercloud-react";

  const dataQuery = useOcResourceGet('Catalogs', { buyerID: 'BuyerA' }, {
    staleTime: 'Infinity',
  })
```

## `useMutateOcResource()` hook
Returns an OrderCloud resource save or create query result from the resource Save or Create operation defined on the OrderCloud OpenAPI spec. This hook supports all of the normal `UseMutationOptions` documented by Tanstack. Ultimately this hook will return the same `UseMutationResult` that is documented on Tanstack query.

### Options

#### **resource**: `string`
The name of the OrderCloud resource to make a save or create call with.

#### **parameters**: `{ [key: string]: string }`
An **optional** parameters object for the OrderCloud save or create call.

#### **mutationOptions**: `UseMutationOptions`
An **optional** `UseMutationOptions` object. 

#### **isNew**: `boolean`
An **optional** boolean that indicates if an item is new.  If new, the Create operation will be used.

### Usage
Here is an example of using the `useMutateOcResource` hook to create a `UseMutationResult` for modifying the current user. 
```tsx
import { useMutateOcResource } from "@rwatt451/ordercloud-react";
import { useCallback } from "react";

  const { mutateAsync: saveAsync } = useMutateOcResource('Products')
  
  const onSubmit = useCallback(
    async (values: any) => {
      await saveAsync(values.body);
    },
    [saveAsync]
  );
```

## `useDeleteOcResource()` hook
Returns an OrderCloud resource delete query result from the resource Delete operation defined on the OrderCloud OpenAPI spec. This hook supports all of the normal `UseMutationOptions` documented by Tanstack. Ultimately this hook will return the same `UseMutationResult` that is documented on Tanstack query.

### Options

#### **resource**: `string`
The name of the OrderCloud resource to make a delete call with.

#### **parameters**: `{ [key: string]: string }`
An **optional** parameters object for the OrderCloud delete call.

#### **mutationOptions**: `UseMutationOptions`
An **optional** `UseMutationOptions` object. 

### Usage
Here is an example of using the `useDeleteOcResource` hook to create a `UseMutationResult` for modifying the current user. 
```tsx
import { useDeleteOcResource } from "@rwatt451/ordercloud-react";
import { useCallback } from "react";

  const { mutateAsync: deleteAsync } = useDeleteOcResource('Orders', { direction: 'Outgoing' })
  
  const onDelete = useCallback(
    async (values: any) => {
      await deleteAsync();
    },
    [saveAsync]
  );
```

## `useListAssignments()` hook
Returns an OrderCloud resource delete query result from the resource Delete operation defined on the OrderCloud OpenAPI spec. This hook supports all of the normal `UseMutationOptions` documented by Tanstack. Ultimately this hook will return the same `UseMutationResult` that is documented on Tanstack query.

### Options

#### **resource**: `string`
The name of the OrderCloud resource to make a list call with.

#### **operationInclusion**: `string`
Optional string to be included in the resource operation name. ex. List{User}Assignments

#### **listOptions**: `ServiceListOptions`
An **optional** listOptions object for the OrderCloud list call.

#### **parameters**: `{ [key: string]: string }`
An **optional** parameters object for the OrderCloud list call.

#### **queryOptions**: `UseQueryOptions`
An **optional** `UseQueryOptions` object.  It is recommended to use a `staleTime` value .

### Usage
Here is an example of using the `useListAssignments` hook to create a `UseQueryResult` for modifying the current user. 
```tsx
import { useOcResourceList } from "@rwatt451/ordercloud-react";

  const dataQuery = useListAssignments('Catalogs', { ID: '100|101|102' }, {
    staleTime: 300000, // 5 min
  })
```

## `useMutateAssignment()` hook
Returns an OrderCloud resource save assignment query result from the resource SaveAssignment operation defined on the OrderCloud OpenAPI spec. This hook supports all of the normal `UseMutationOptions` documented by Tanstack. Ultimately this hook will return the same `UseMutationResult` that is documented on Tanstack query.

### Options

#### **resource**: `string`
The name of the OrderCloud resource to make a list call with.

#### **operationInclusion**: `string`
Optional string to be included in the resource operation name. ex. Save{User}Assignments

#### **parameters**: `{ [key: string]: string }`
An **optional** parameters object for the OrderCloud list call.

#### **mutationOptions**: `UseMutationOptions`
An **optional** `UseMutationOptions` object. 

### Usage
Here is an example of using the `useMutateAssignment` hook to create a `UseMutationResult` for modifying the current user. 
```tsx
import { useMutateAssignment } from "@rwatt451/ordercloud-react";
import { useCallback } from "react";

  const { mutateAsync: saveAssignmentAsync } = useMutateAssignment('Categories', { catalogID: 'DefaultCatalog', categoryID: 'SoftGoods' })
  
  const onDelete = useCallback(
    async (values: any) => {
      await saveAssignmentAsync();
    },
    [saveAsync]
  );
```

## `useDeleteAssignment()` hook
Returns an OrderCloud resource assignment delete query result from the resource DeleteAssignment operation defined on the OrderCloud OpenAPI spec. This hook supports all of the normal `UseMutationOptions` documented by Tanstack. Ultimately this hook will return the same `UseMutationResult` that is documented on Tanstack query.

### Options

#### **resource**: `string`
The name of the OrderCloud resource to make a delete call with.

#### **operationInclusion**: `string`
Optional string to be included in the resource operation name. ex. Delete{User}Assignment

#### **parameters**: `{ [key: string]: string }`
An **optional** parameters object for the OrderCloud delete call.

#### **mutationOptions**: `UseMutationOptions`
An **optional** `UseMutationOptions` object. 

### Usage
Here is an example of using the `useDeleteAssignment` hook to create a `UseMutationResult` for modifying the current user. 
```tsx
import { useDeleteAssignment } from "@rwatt451/ordercloud-react";
import { useCallback } from "react";

  const { mutateAsync: deleteAsync } = useDeleteAssignment('Categories', { catalogID: 'DefaultCatalog', categoryID: 'SoftGoods' })
  
  const onDelete = useCallback(
    async (values: any) => {
      await deleteAsync();
    },
    [saveAsync]
  );
```

## `useColumns()` hook
This hook utilizes the [Open API Spec](https://api.ordercloud.io/v1/openapi/v3) to generate properties, table headers, and `@tanstack/react-table` column groupings for a given OrderCloud resource. The dynamicColumns object returned from this hook are meant to be used as the `columns` option in `@tanstack/react-table`'s `useReactTable()` hook.  If a resource's xp schema is included in the `xpSchemas` option for `OrderCloudProvider`, these properties will be included in the resource's returned properties and column definitions. 

### Options

#### **resourceId**: `string`
The OrderCloud resource name used for generating column information.

#### **sortOrder**: `string[]`
An **optional** list that will be used to sort table header order if provided.

#### **cellCallback**: `(info: CellContext<unknown, unknown>, properties: OpenAPIV3.SchemaObject, resourceId: string) => JSX.Element`
An **optional** callback for defining custom elements for `@tanstack/react-table` table cells by data type.

## `useOcForm()` hook
This hook returns a `UseFormReturn` methods object and a "shallowed" resource schema. If a resource's xp schema is included in the `xpSchemas` option for `OrderCloudProvider`, these properties will be included in the form fields. 

### Options

#### **resourceId**: `string`
The OrderCloud resource name used for generating column information.

#### **initialValues**: `{ parameters?: {[key: string]: unknown}, body?: {[key: string]: unknown} }`
An **optional** object that contains initial parameter and body values for an item of a given resource ID.  The absence of body values indicates a new item.

#### **props**: `UseFormProps`
An **optional** `react-hook-form` `useForm` props object 

## `useHasAccess()` hook
This hook determines whether a user has read or admin access to an OrderCloud resource by comparing the user's token and application scope to the OAuth roles indicated on the OpenAPI spec.

### Options

#### **resource**: `string`
The OrderCloud resource name used for generating column information.


## Important Notes
While it is not necessary to use the actual OrderCloud SDK to communicate with the OrderCloud API, it definitely makes things easier. The `isAuthenticated` state is based on the returned value of SDKs `Tokens.GetValidToken()` method and the OrderCloud SDK `Configuration` object is set up using the values passed into the `OrderCloudProvider`. Additonally, the SDK provides typed responses which make working with `useAuthQuery` and `useMutationQuery` generics easier.

On the flip side, it is also not entirely necessary to use the wrapped Tanstack hooks. If you want to just use the normal OrderCloud SDK, just be certain that you aren't making any calls when `isAuthenticated` is false. Though, in doing so you will miss out on all of the benefits that Tanstack provides.