import {useMemo} from "react"
import useOrderCloudContext from "./useOrderCloudContext"
import { getRoles } from "../utils"
import useOperations from "./useOperations"

export type AccessQualifier = string | string[]

export const isAllowedAccess = (assignedRoles: string[] | string | undefined, accessRoles: string[] | undefined ): boolean => {
  if(!assignedRoles || !accessRoles) return false

  if (assignedRoles.includes("FullAccess")) return true 

return accessRoles.some(role => assignedRoles.includes(role))
}

export const isResourceAdmin = (assignedRoles: string[] | string | undefined, accessRoles: string[] | undefined ): boolean => {
  if(!assignedRoles || !accessRoles) return false

  if (assignedRoles.includes("FullAccess")) return true 

  return accessRoles.some(role => assignedRoles.includes(role) && role.includes('Admin'))
}

const useHasAccess = (resource?: string) => {
  const context = useOrderCloudContext()
  const userRoles = useMemo(() => getRoles(context.token || ""), [context.token])
  const { listOperation } = useOperations(resource || "")
  const accessRoles = listOperation?.security?.[0].OAuth2

  const allowed = useMemo(() =>
    isAllowedAccess(userRoles, accessRoles)
  , [userRoles, accessRoles])

  const isAdmin = useMemo(() => 
    isResourceAdmin(userRoles, accessRoles)
  , [userRoles, accessRoles])

  return useMemo(()=> {
    return {
      allowed,
      isAdmin
    }
  },[allowed, isAdmin])
}

export default useHasAccess
