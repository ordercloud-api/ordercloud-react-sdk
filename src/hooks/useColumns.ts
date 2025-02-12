import { useCallback, useMemo } from 'react'
import { OpenAPIV3 } from 'openapi-types';
import { useOrderCloudContext } from '.';
import { sortBy, get } from 'lodash';
import { CellContext, ColumnDef, createColumnHelper } from '@tanstack/react-table';
import { RequiredDeep } from 'ordercloud-javascript-sdk';
import { getRequiredParamsInPath } from '../utils';
import useOperations from './useOperations';

const columnHelper = createColumnHelper<RequiredDeep<unknown>>();

const useColumns = (resourceId: string, sortOrder?: string[], cellCallback?: (info: CellContext<unknown, unknown>, properties: OpenAPIV3.SchemaObject, resourceId: string) => JSX.Element) => {
  const { xpSchemas } = useOrderCloudContext()
  const { listOperation: operation, deleteOperation, assignmentListOperation} = useOperations(resourceId)

  const sortable = useMemo(() => {
    const params = operation?.parameters as OpenAPIV3.ParameterObject[]
    const schema = params?.find((p: OpenAPIV3.ParameterObject) => p?.name === 'sortBy')?.schema as OpenAPIV3.ArraySchemaObject
    const schemaItems = schema?.items as OpenAPIV3.SchemaObject
    return schemaItems?.enum
  }, [operation?.parameters])

  const xpProperties = useMemo(() => {
    if(xpSchemas?.properties && xpSchemas.properties[resourceId]){
      return xpSchemas.properties[resourceId]
    } else {
      return null
    }
  },[resourceId, xpSchemas])

  const properties = useMemo(() => {
    const response = operation?.responses['200'] as OpenAPIV3.ResponseObject
    const schema = response?.content?.['application/json']?.schema as OpenAPIV3.SchemaObject
    const schemaItemArray = schema?.properties?.Items as OpenAPIV3.ArraySchemaObject
    const schemaObj = schemaItemArray?.items as OpenAPIV3.SchemaObject
    
    if(xpProperties && schemaObj?.properties) 
      schemaObj.properties.xp = xpProperties
    
    return schemaObj?.properties
  }, [operation?.responses, xpProperties])

  const columnHeaders = useMemo(() => {
    if(!properties) return
    const headers = Object.keys(properties)?.filter((p) => p !== 'Password')
    return headers
  }, [properties])

  const buildColumns = useCallback((obj: unknown, accessor?: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cols = [] as any
    if (!obj || !cellCallback) return cols;
    Object.entries(obj).forEach(([key, value]) => {
      // eslint-disable-next-line no-prototype-builtins
      const type = value.hasOwnProperty("allOf")
        ? value["allOf"][0]["type"]
        : value["type"];
      const accessorString = accessor ? `${accessor}.${key}` : key;
  
      if (type === "object") {
        // eslint-disable-next-line no-prototype-builtins
        const properties = value.hasOwnProperty("allOf")
          ? value["allOf"][0]["properties"]
          : value["properties"];
        const nestedColumns = buildColumns(properties, accessorString);
        if (key === "xp") {
          cols = [...cols, ...nestedColumns] as ColumnDef<
            RequiredDeep<unknown>,
            unknown
          >[];
        } else {
          const groupHeader = accessorString.includes("xp.")
            ? accessorString
            : key;
          if (nestedColumns?.length  && nestedColumns.length > 0) {
            cols.push(
              columnHelper.group({
                header: groupHeader,
                columns: nestedColumns,
              })
            );
          }
        }
      } else {
        const header =
          accessorString.includes("xp.") && accessorString.split(".").length === 2
            ? accessorString
            : key;
        cols.push(
          columnHelper.accessor(row => get(row, accessorString), {
            id: accessorString,
            header,
            enableResizing: true,
            enableSorting: sortable?.includes(accessorString),
            cell: (info: CellContext<unknown, unknown>) => {
              return cellCallback(info, value, resourceId) 
            }
          }) as ColumnDef<unknown, unknown>
        );
      }
    });

    if(sortOrder){
      return sortBy(cols, (col) => {
        const sortIndex = sortOrder.indexOf(col?.header as string);
        if (sortIndex > -1) {
          return sortIndex;
        }
        return sortOrder.length + 1;
      });
    } else {
    return cols}
  },[cellCallback, sortOrder, sortable]);

  const dynamicColumns = useMemo(()=> {
   return buildColumns(properties)
  },[properties, buildColumns])

  const requiredParameters = useMemo(()=> {
    return getRequiredParamsInPath(deleteOperation)
  }, [deleteOperation])

  const assignmentProperties = useMemo(()=> {
    const response = assignmentListOperation?.responses['200'] as OpenAPIV3.ResponseObject
    const schema = response?.content?.['application/json']?.schema as OpenAPIV3.SchemaObject
    const schemaItemArray = schema?.properties?.Items as OpenAPIV3.ArraySchemaObject
    const schemaObj = schemaItemArray?.items as OpenAPIV3.SchemaObject

    return schemaObj?.properties
  }, [assignmentListOperation?.responses])

  const result = useMemo(() => {
    
    return {
      properties,
      assignmentProperties,
      requiredParameters,
      columnHeaders,
      dynamicColumns
    }
  }, [assignmentProperties, columnHeaders, dynamicColumns, properties, requiredParameters])

  return result
}

export default useColumns
