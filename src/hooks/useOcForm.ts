import useOperations from './useOperations'
import { useCallback, useMemo } from 'react'
import * as yup from 'yup'
import { yupResolver } from '@hookform/resolvers/yup'
import { UseFormProps, useForm } from 'react-hook-form'
import _, { cloneDeep } from 'lodash'
import { generateFormSchema, generateParameterSchema, shallowNestedProperties, shapeXpSchema } from '../formSchemaGenerator.utils'
import { useOrderCloudContext } from '.'
import { OpenAPIV3 } from 'openapi-types'

// For specific fields/values we do not want to take the example from Open API spec
const normalizeExampleValue = (val: any) => {
  switch (typeof val) {
    case 'string':
      if (val === '2018-01-01T00:00:00-06:00') {
        return null
      }
      break
    case 'object':
      if (Array.isArray(val)) {
        return val.join('').length ? val : []
      }
      break
    default:
      return val
  }
  return val
}

const getExampleValue = (row: any, key: string) => {
  key.split('.').forEach((k) => (row ? (row = row[k]) : undefined))
  return row
}

export const useOcForm = (
  resource: string,
  initialValues?: { parameters?: {[key: string]: unknown}, body?: {[key: string]: unknown} },
  isAssignment?: boolean,
  operationInclusion?: string,
  props?: UseFormProps,
) => {
  const { saveOperation, createOperation, assignmentSaveOperation } = useOperations(resource, operationInclusion) as any
  const { xpSchemas } = useOrderCloudContext()

  const isNew = useMemo(()=> !initialValues?.body || (!initialValues?.body && !Object.keys(initialValues.body).length) ,[initialValues?.body])

  const requestSchema = useMemo(() => {
    const schema = isAssignment ? assignmentSaveOperation?.requestBody?.content['application/json'].schema : isNew
    ? createOperation?.requestBody?.content['application/json'].schema 
    : saveOperation?.requestBody?.content['application/json'].schema
    
    return schema || createOperation?.requestBody?.content['application/json'].schema || saveOperation?.requestBody?.content['application/json'].schema// fallback
  }, [assignmentSaveOperation?.requestBody?.content, createOperation?.requestBody?.content, isAssignment, isNew, saveOperation?.requestBody?.content])

  
  const operationParameters = useMemo(()=> generateParameterSchema(isAssignment ? assignmentSaveOperation : isNew ? createOperation : saveOperation),[assignmentSaveOperation, createOperation, isAssignment, isNew, saveOperation])

    /**
   * If xp schema has been passed into the provider, use the custom schema.
   * else, infer types from initial values if they exist
   */
  const xpSchema = useMemo(()=> {
    if(xpSchemas?.properties && xpSchemas.properties[resource]){
      return xpSchemas.properties[resource]
    } else if (initialValues?.body?.xp && Object.keys(initialValues?.body?.xp).length) {
      return shapeXpSchema([initialValues?.body])
    }
    },[initialValues?.body, resource, xpSchemas])
  /**
   * "Shallow up" the requestSchema (removes the 'allOf' layer and puts sub
   * object properties in the right place).
   */
  const resourceSchema = useMemo(() => {
    const requiredProps = requestSchema?.required
    const nativeProperties = cloneDeep(requestSchema?.allOf[0].properties)

    if (nativeProperties && nativeProperties.xp && xpSchema) {
      // add necessary required attributes to xp properties
      if((xpSchemas?.properties?.[resource] as OpenAPIV3.SchemaObject)?.required){
        (xpSchemas?.properties?.[resource] as OpenAPIV3.SchemaObject)?.required?.forEach((propKey: string) => {
          (xpSchema as any).properties[propKey]['required'] = true
        })
      }
      nativeProperties.xp = xpSchema
    }

    // add required attributes for native properties
    requiredProps?.forEach((propKey: string) => {
      nativeProperties[propKey].required = true
    })

    return shallowNestedProperties(nativeProperties)
  }, [requestSchema?.required, requestSchema?.allOf, xpSchema, xpSchemas?.properties, resource])

  const getDefaultSchemaValues = useCallback(
    (schema: OpenAPIV3.SchemaObject, parentPath?: string) => {
      const obj = {} as {[key: string]: unknown}
      Object.entries(schema).forEach(([key, value]: [string, OpenAPIV3.SchemaObject]) => {
        if (value.readOnly) return
        if (value?.properties) {
          obj[key] = getDefaultSchemaValues(value.properties, key)
          return
        }
        const path = parentPath ? `${parentPath}.${key}` : key
        obj[key] = normalizeExampleValue(getExampleValue(requestSchema?.allOf[0].example, path))
      })
      return obj
    },
    [requestSchema?.allOf]
  )

  // Generate the form schema using Yup
  const formSchema = useMemo(() => {
    if (!resourceSchema) return
    const generatedSchema = generateFormSchema(resourceSchema, requestSchema?.required)

    let generatedParamSchema = {}

    if (operationParameters) {
      generatedParamSchema = generateFormSchema(operationParameters?.schema, operationParameters?.required)
    }

    return yup.object().shape({
      parameters: yup.object(generatedParamSchema),
      body: yup.object(generatedSchema),
    })
  }, [resourceSchema, requestSchema?.required, operationParameters])

  // Initiate the react-hook-form
  const methods = useForm({
    defaultValues:  props?.defaultValues || {} as any,
    values: {
      parameters: {
        ...initialValues?.parameters,
      },
      body: {
        ...initialValues?.body || {},
      },
    },
    resolver: yupResolver(formSchema!),
    mode: props?.mode || 'onBlur',
    ...props
  })

  return {
    methods,
    resourceSchema
  }
  };
