import useOperations from './useOperations'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { isEqual } from 'lodash'
import { cloneDeep } from 'lodash'
import { z } from 'zod'
import { useForm, FormOptions } from '@tanstack/react-form'
import { generateFormSchema, generateParameterSchema, shallowNestedProperties, shapeXpSchema } from '../formSchemaGenerator.utils'
import { useOrderCloudContext } from '.'
import { OpenAPIV3 } from 'openapi-types'

export type OcFormValues = {
  parameters: Record<string, unknown>
  body: Record<string, unknown>
}

export type OcFormValidationTrigger = 'onBlur' | 'onChange' | 'onSubmit'

export type UseOcFormOptions = {
  /** When generated validation runs. Defaults to onBlur. Submit always validates. */
  validationTrigger?: OcFormValidationTrigger
  /** Called by form.handleSubmit after validation. Save parseValues(), not the raw form state. */
  onSubmit?: (values: OcFormValues) => void | Promise<void>
  /** Extra TanStack Form options. defaultValues and validators stay owned by this hook. */
  formOptions?: Partial<
    Omit<
      FormOptions<
        OcFormValues,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any
      >,
      'defaultValues' | 'validators'
    >
  >
}

const fallbackFormSchema = z.object({
  parameters: z.record(z.any()),
  body: z.record(z.any()),
})

function validatorsFor(schema: z.ZodTypeAny, trigger: OcFormValidationTrigger) {
  const validators: {
    onSubmit: z.ZodTypeAny
    onBlur?: z.ZodTypeAny
    onChange?: z.ZodTypeAny
  } = { onSubmit: schema }
  if (trigger === 'onBlur') validators.onBlur = schema
  if (trigger === 'onChange') validators.onChange = schema
  return validators
}

function toFormValues(initialValues?: {
  parameters?: Record<string, unknown>
  body?: Record<string, unknown>
}): OcFormValues {
  return {
    parameters: { ...(initialValues?.parameters ?? {}) },
    body: { ...(initialValues?.body ?? {}) },
  }
}

export const useOcForm = (
  resource: string,
  initialValues?: { parameters?: {[key: string]: unknown}, body?: {[key: string]: unknown} },
  isAssignment?: boolean,
  operationInclusion?: string,
  options?: UseOcFormOptions,
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

  const formSchema = useMemo(() => {
    if (!resourceSchema) return fallbackFormSchema
    const bodySchema = generateFormSchema(resourceSchema, requestSchema?.required)
    const parameterSchema = operationParameters
      ? generateFormSchema(operationParameters.schema, operationParameters.required)
      : z.object({})
    return z.object({
      parameters: parameterSchema,
      body: bodySchema,
    })
  }, [resourceSchema, requestSchema?.required, operationParameters])

  const validationTrigger = options?.validationTrigger ?? 'onBlur'
  const nextValues = useMemo(() => toFormValues(initialValues), [initialValues])
  const seenValues = useRef(nextValues)

  const form = useForm({
    ...options?.formOptions,
    defaultValues: nextValues,
    validators: validatorsFor(formSchema, validationTrigger),
    onSubmit: async ({ value }) => {
      await options?.onSubmit?.(value)
    },
  })

  // useForm syncs validators through form.update on each render. Reset is separate:
  // that update leaves a touched form in place, and this hook keeps values controlled.
  useEffect(() => {
    if (isEqual(seenValues.current, nextValues)) return
    seenValues.current = nextValues
    form.reset(nextValues)
  }, [form, nextValues])

  const parseValues = useCallback((values?: OcFormValues) => {
    return formSchema.parse(values ?? form.state.values) as OcFormValues
  }, [form, formSchema])

  return {
    form,
    resourceSchema,
    parseValues,
  }
}
