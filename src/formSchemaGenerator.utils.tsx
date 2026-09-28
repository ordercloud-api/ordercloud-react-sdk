import { isNil, isNull, last } from 'lodash'
import _ from 'lodash'
import Case from 'case'
import { z, ZodTypeAny } from 'zod'

//massages the operation.parameters into a schema object that
//can be used by `generateFormSchema` and RequestObject.
export function generateParameterSchema(operation: any) {
  if (!operation?.parameters) return
  const result = {} as any
  const required: string[] = []
  operation.parameters.forEach((param: any) => {
    result[param.name] = param.schema
    result[param.name]['description'] = param.description
    result[param.name]['required'] = param.required
    if (param.required) {
      required.push(param.name)
    }
  })
  if (result['search']) {
    result['filters'] = { type: 'object' }
  }
  return { schema: result, required }
}

const SKIP_TRANSFORM_FORMATS = ['date-time']

function getPropertyLabel(property: string) {
  const split = property.split('.').length ? last(property.split('.')) : property
  if(!split) return 
  
  let addS = true
  let idIndex = split.indexOf('IDs') // prevent spacing in IDs
  if (idIndex < 0) {
    addS = false
    idIndex = split.indexOf('ID') // prevent spacing in ID
  }
  let result
  if (idIndex > -1) {
    result = `${Case.title(split.slice(0, idIndex))} ID${addS ? 's' : ''}`
  } else {
    result = Case.title(split)
  }

  //TODO: create a more config driven way for label replacement
  if (result === 'Xp') {
    result = 'Extended Properties'
  }
  return result
}

export function generateFormSchema(schemaProps: any, requiredProps?: string[]) {
  const shape: Record<string, ZodTypeAny> = {}
  Object.keys(schemaProps ?? {}).forEach((propName) => {
    const field = buildFieldSchema(propName, schemaProps[propName], requiredProps)
    if (field) {
      shape[propName] = field
    }
  })
  return z.object(shape).transform((value) =>
    Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined))
  )
}

function hasValueOfType(type: string | undefined, val: any, propName: string) {
  switch (type) {
    case 'string':
      return typeof val === 'string'
    case 'number':
    case 'integer':
      return typeof val === 'number' && !Number.isNaN(val)
    case 'boolean':
      return typeof val === 'boolean'
    case 'object':
      if (val == null || typeof val !== 'object' || Array.isArray(val)) return false
      return propName === 'xp'
        ? true
        : Object.values(val).some((entry) => !isNil(entry))
    case 'array':
      return Array.isArray(val)
    default:
      return typeof val === 'string'
  }
}

function coerceValue(type: string | undefined, propName: string, value: unknown) {
  // OrderCloud rejects null for numbers and booleans, and rejects 0 when minimum is 1.
  // Empty inputs are omitted so a field the merchant never touched is not submitted.
  if (type === 'number' || type === 'integer') {
    if (typeof value === 'number' && !Number.isNaN(value)) return value
    return undefined
  }
  if (type === 'boolean') {
    return typeof value === 'boolean' ? value : undefined
  }
  if (value === null || hasValueOfType(type, value, propName)) return value
  return undefined
}

function castDateTime(value: unknown) {
  if (value == null || typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return value
}

function isMissingRequired(type: string | undefined, value: unknown) {
  if (type === 'number' || type === 'integer') return value == null
  if (value == null) return true
  if ((type == null || type === 'string') && value === '') return true
  return false
}

function buildFieldSchema(propName: string, target: any, requiredProps?: string[]) {
  if (target?.readOnly) return
  const isRequired = Boolean(
    (requiredProps && requiredProps.includes(propName)) || target?.required
  )
  const label = getPropertyLabel(propName) ?? propName
  const base = baseSchema(propName, target, label)
  if (!base) return
  return applyPresence(base, {
    type: target?.type,
    propName,
    format: target?.format,
    isRequired,
    label,
  })
}

function baseSchema(propName: string, target: any, label: string): ZodTypeAny | undefined {
  switch (target?.type) {
    case 'string':
      return shapeString(propName, target, label)
    case 'number':
    case 'integer':
      return shapeNumber(target, label)
    case 'boolean':
      return z.boolean({
        required_error: `${label} is required`,
        invalid_type_error: `${label} is required`,
      })
    case 'object':
      return shapeObject(target)
    case 'array':
      return z.array(
        buildFieldSchema(propName, target.items ?? { type: 'string' }) ?? z.string()
      )
    default:
      return shapeString(propName, target ?? {}, label)
  }
}

function applyPresence(
  base: ZodTypeAny,
  opts: {
    type?: string
    propName: string
    format?: string
    isRequired: boolean
    label: string
  }
) {
  const skipTransform = SKIP_TRANSFORM_FORMATS.includes(opts.format ?? '')
  const coerce = (value: unknown) =>
    skipTransform ? castDateTime(value) : coerceValue(opts.type, opts.propName, value)

  return z
    .any()
    .superRefine((value, ctx) => {
      const coerced = coerce(value)
      if (opts.isRequired && isMissingRequired(opts.type, coerced)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${opts.label} is required`,
        })
        return
      }
      if (coerced == null) return
      const parsed = base.safeParse(coerced)
      if (!parsed.success) {
        parsed.error.issues.forEach((issue) => ctx.addIssue(issue))
      }
    })
    .transform((value) => {
      const coerced = coerce(value)
      if (coerced == null) return coerced
      const parsed = base.safeParse(coerced)
      return parsed.success ? parsed.data : coerced
    })
}

function shapeString(propName: string, target: any, label: string) {
  let propShape = z.string({
    required_error: `${label} is required`,
    invalid_type_error: `${label} is required`,
  })
  if (target?.maxLength != null) {
    propShape = propShape.max(
      target.maxLength,
      `${propName} must not exceed ${target.maxLength} characters`
    )
  }
  if (propName?.toLocaleLowerCase() === 'email') {
    return propShape.refine(
      (value) => value === '' || z.string().email().safeParse(value).success,
      'Email is invalid'
    )
  }
  return propShape
}

function shapeNumber(target: any, label: string) {
  let propShape = z.number({
    required_error: `${label} is required`,
    invalid_type_error: `${label} is required`,
  })
  if (target?.type === 'integer') {
    propShape = propShape.int(`${label} must be a whole number`)
  }
  if (target?.minimum != null) {
    propShape = propShape.min(target.minimum, `${label} must be at least ${target.minimum}`)
  }
  return propShape
}

function shapeObject(target: any) {
  if (target.allOf?.length) {
    return generateFormSchema(target.allOf[target.allOf.length - 1].properties)
  }
  if (target.properties) {
    return generateFormSchema(target.properties, target?.required)
  }
}

export function shallowNestedProperties(obj: any) {
  const shallowObj = {} as any
  for (let key in obj) {
    if (obj[key]?.hasOwnProperty('allOf')) {
      shallowObj[key] = obj[key]['allOf'][0]
      if (obj[key].readOnly) {
        shallowObj[key]['readOnly'] = true
      }
      //account for deeply nested references
      shallowObj[key].properties = shallowNestedProperties(shallowObj[key].properties)
    } else {
      shallowObj[key] = obj[key]
    }
  }
  return shallowObj
}

function hasValue(data: any): boolean {
  if (typeof data === 'number') return true
  else if (typeof data === 'boolean') return !isNull(data)
  else if (Array.isArray(data)) {
    return Boolean(
      data.filter((v: any) => {
        if (typeof v === 'object') return hasValue(v)
        return !_.isNil(data)
      }).length
    )
  } else if (typeof data === 'object') {
    if (_.isNil(data)) return false
    const keys = Object.keys(data) //here
    if (!keys?.length) return false
    return Boolean(
      keys.filter((v) => {
        if (typeof data[v] === 'object') return hasValue(data[v])
        return !_.isNil(data[v])
      }).length
    )
  } else {
    return !_.isNil(data)
  }
}

function inferArrayItems(arr: any): any {
  if (arr.length === 0) {
    return {}
  }

  const arrayItemType = inferDataType(arr[0])
  if (Array.isArray(arr[0])) {
    return {
      type: 'array',
      items: inferArrayItems(arr[0]),
    }
  } else {
    return {
      type: arrayItemType,
    }
  }
}

function inferDataTypes(obj: any) {
  const spec = {} as any

  for (const key in obj) {
    const value = obj[key]
    let type
    if (hasValue(value))
      if (Array.isArray(value)) {
        if (value.length > 0) {
          // can't infer type from empty array value
          const arrayItemType = inferDataType(value[0])
          if (Array.isArray(value[0])) {
            // array of arrays
            type = 'array'
            spec[key] = {
              type,
              items: {
                type: 'array',
                items: inferArrayItems(value[0]),
              },
            }
          } else if (typeof value[0] === 'object') {
            // array of objects
            type = 'array'
            spec[key] = {
              type,
              items: {
                type: 'object',
                properties: inferDataTypes(value[0]),
              },
            }
          } else {
            type = arrayItemType
            spec[key] = {
              type: 'array',
              items: {
                type,
              },
            }
          }
        }
      } else if (typeof value === 'object') {
        type = 'object'
        if (Object.keys(value).length) { //here
          // can't infer type from empty obj value
          spec[key] = {
            type,
            properties: inferDataTypes(value),
          }
        }
      } else {
        type = inferDataType(value)
        spec[key] = { type }
      }
  }

  return spec
}

function inferDataType(value: any) {
  const typeOfValue = typeof value

  if (typeOfValue === 'object') {
    if (Array.isArray(value)) {
      return 'array'
    } else if (value === null) {
      return 'null'
    } else {
      return 'object'
    }
  } else {
    return typeOfValue
  }
}

export function shapeXpSchema(items: any) {
  let properties = {}
  if (items.length) {
    const uniqueXp = _.chain(items)
      .flatMap((obj) =>
        obj.xp
          ? Object.entries(obj.xp).filter(
              (
                [_key, value] // filter out empty arrays and objects from key value pairs
              ) => hasValue(value)
            )
          : []
      )
      .groupBy(0)
      .map((groupedValues, key) => {
        const type = inferDataType(groupedValues[0][1])
        if (groupedValues.length === 1 || type !== 'object') {
          return [key, groupedValues[0][1]]
        } else {
          // if value is object and <1 grouped items, merge unique object properties
          return [
            key,
            _.mergeWith({}, ...groupedValues.map((arr) => arr[1]), (objValue: any, srcValue: any) => {
              if (Array.isArray(objValue)) {
                return objValue.concat(srcValue)
              }
            }),
          ]
        }
      })
      .value()
    properties = inferDataTypes(Object.fromEntries(uniqueXp))
  }
  return {
    properties,
    type: 'object',
  }
}
