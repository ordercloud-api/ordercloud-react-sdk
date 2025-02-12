import * as yup from 'yup'
import { isNil, isNull, last } from 'lodash'
import _ from 'lodash'
import Case from 'case'

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
  const schemaShape = {} as any
  const schemaKeys = Object.keys(schemaProps)
  schemaKeys.forEach((propName) => {
    const target = schemaProps[propName]
    //Do not add readOnly fields to form schema
    if (target?.readOnly) {
      return
    }
    switch (target?.type) {
      case 'string':
        schemaShape[propName] = ShapeStringProp(propName, target)
        break
      case 'number':
        schemaShape[propName] = ShapeNumberProp(target)
        break
      case 'integer':
        schemaShape[propName] = ShapeNumberProp(target)
        break
      case 'boolean':
        schemaShape[propName] = yup.boolean()
        break
      case 'object':
        schemaShape[propName] = ShapeObjectProp(target)
        break
      case 'array':
        schemaShape[propName] = ShapeArrayProp(propName, target)
        break
      default:
        schemaShape[propName] = yup.string()
        break
    }
    if (schemaShape[propName]) {
      schemaShape[propName] =
        (requiredProps && requiredProps.includes(propName)) || target.required
          ? schemaShape[propName].required(`${getPropertyLabel(propName)} is required`)
          : target?.type === 'object'
            ? schemaShape[propName].notRequired().default(undefined)
            : schemaShape[propName].nullable(true)
      if (!SKIP_TRANSFORM_FORMATS.includes(target?.format)) {
        schemaShape[propName] = schemaShape[propName].transform(
          typeSpecificTransform(target?.type, propName)
        )
      }
    }
  })

  return schemaShape
}

function hasValueOfType(type: string, val: any, propName: string) {
  switch (type) {
    case 'string':
      return Boolean(val.length || val === '')
    case 'number':
    case 'integer':
      return Number(val) === val
    case 'boolean':
      return typeof val === 'boolean'
    case 'object':
      return propName === 'xp'
        ? typeof val === 'object'
        : Boolean(Object.values(val).filter((v) => !isNil(v)).length)
    case 'array':
      return Array.isArray(val)
    default:
      return false
  }
}

function typeSpecificTransform(type: string, propName: string) {
  return (_: any, val: any) => (val === null || hasValueOfType(type, val, propName) ? val : undefined)
}

function ShapeStringProp(propName: string, target: any) {
  let propShape
  propShape = yup.string()
  if (propName?.toLocaleLowerCase() === 'email') {
    propShape = propShape.email('Email is invalid')
  }

  if (target.maxLength) {
    propShape = propShape.max(
      target.maxLength,
      `${propName} must not exceed ${target.maxLength} characters`
    )
  }

  return propShape
}

function ShapeNumberProp(target: any) {
 const propShape = yup
    .number()
    .transform((value) => (isNaN(value) || value === null || value === undefined ? 0 : value))

  if (target.minimum) propShape.min(target.minimum).default(target.minimum)
  return propShape
}

function ShapeArrayProp(propName: string, target: any) {
  let itemShape: any
  switch (target.items.type) {
    case 'string':
      itemShape = ShapeStringProp(propName, target.items)
      break
    case 'number':
      itemShape = ShapeNumberProp(target.items)
      break
    case 'integer':
      itemShape = ShapeNumberProp(target.items)
      break
    case 'boolean':
      itemShape = yup.boolean()
      break
    case 'object':
      itemShape = ShapeObjectProp(target.items)
      break
    case 'array':
      itemShape = ShapeArrayProp(propName, target.items)
      break
    default:
      itemShape = yup.string()
      break
  }
  return yup.array(itemShape)
}

function ShapeObjectProp(target: any) {
  let propShape
  if (target.allOf?.length) {
    let childSchemaShape = {}
    target.allOf.forEach((p: any) => {
      const childPropertyInfo = p.properties
      childSchemaShape = generateFormSchema(childPropertyInfo)
    })
    propShape = yup.object(childSchemaShape)
  } else if (target.properties) {
    let childSchemaShape = {}
    childSchemaShape = generateFormSchema(target.properties, target?.required)
    propShape = yup.object(childSchemaShape)
  }
  return propShape
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
