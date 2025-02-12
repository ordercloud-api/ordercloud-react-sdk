import { omit, startCase } from 'lodash'
import { OpenAPIV3 } from 'openapi-types'
import { useCallback, useMemo } from 'react'
import useApiSpec from './useApiSpec'
import { ServiceListOptions } from './useOcResource'

type PromotionProperty = [string, OpenAPIV3.SchemaObject]

interface ExpressionModels {
  // to be displayed in the UI
  label: string

  // path to property on OrderCloud model, used to build the promotion expression
  path: string

  properties: PromotionProperty[]
}

export function usePromoExpressions() {
  const { schemas } = useApiSpec()

  const buildProperties = (
    properties: OpenAPIV3.SchemaObject | undefined,
    propertiesToExclude: string[],
    propertiesToInclude?: string[] | ServiceListOptions[]
  ) => {
    const filteredProperties = omit(properties, [...propertiesToExclude, 'xp'])
    if (propertiesToInclude) Object.assign(filteredProperties, ...propertiesToInclude)
    return Object.entries(filteredProperties) as [string, OpenAPIV3.SchemaObject][]
  }

  const buildPromoModels = useCallback(
    (schemas: Record<string, OpenAPIV3.SchemaObject>): ExpressionModels[] => {
      if (!Object.keys(schemas).length) return []
      return [
        {
          label: 'Product',
          path: 'LineItem.Product',
          properties: buildProperties(
            schemas.LineItemProduct.properties,
            [],
            [
              {
                'Inventory.QuantityAvailable': { type: 'number' },
              },
            ]
          ),
        },
        {
          label: 'Line Item',
          path: 'LineItem',
          properties: buildProperties(schemas.LineItem.properties, [
            'ShippingAddressID',
            'Product',
            'ShippingAddress',
          ]),
        },
        {
          label: 'Variant',
          path: 'LineItem.Variant',
          properties: buildProperties(schemas.Variant.properties, []),
        },
        {
          label: 'User',
          path: 'Order.FromUser',
          properties: buildProperties(schemas.User.properties, [
            'Password',
            'Active',
            'AvailableRoles',
          ]),
        },
        {
          label: 'Order',
          path: 'Order',
          properties: buildProperties(schemas.Order.properties, [
            'FromUser',
            'FromUserID',
            'BillingAddress',
            'ShippingAddressID',
            'Comments',
          ]),
        },
        {
          label: 'Order Return',
          path: 'OrderReturn',
          properties: buildProperties(schemas.OrderReturn.properties, ['Comments']),
        },
        {
          label: 'Billing Address',
          path: 'Order.BillingAddress',
          properties: buildProperties(schemas.Address.properties, []),
        },
        {
          label: 'Shipping Address',
          path: 'LineItem.ShippingAddress',
          properties: buildProperties(schemas.Address.properties, []),
        },
        {
          label: 'Value',
          path: '',
          properties: [
            ['text', { type: 'string' }],
            ['boolean', { type: 'boolean' }],
            ['number', { type: 'number' }],
            ['date', { type: 'string', format: 'date-time' }],
          ],
        },
        {
          label: 'Approval Rule',
          path: 'ApprovalRule',
          properties: buildProperties(schemas.ApprovalRule.properties, [
            'Name',
            'Description',
            'ApprovingGroupID',
            'RuleExpression',
          ]),
        },
        {
          label: 'Seller Approval Rule',
          path: 'SellerApprovalRule',
          properties: buildProperties(schemas.SellerApprovalRule.properties, [
            'Name',
            'Description',
            'ApprovingGroupID',
            'RuleExpression',
            'ApprovalType',
            'OwnerID',
          ]),
        },
        {
          label: 'Cost Center',
          path: 'CostCenter',
          properties: buildProperties(schemas.CostCenter.properties, ['Name', 'Description']),
        },
      ]
    },
    []
  )

  const result = useMemo(() => {
    if (schemas) {
      const models = buildPromoModels(schemas)
      const fields = Object.values(models)
        .map((model) => {
          return model.properties.map(([name, property]) => {
            return {
              name: `${model.path}.${name}`,
              label: startCase(name),
              type: property.type,
              inputType:
                property.format === 'date-time'
                  ? 'datetime-local'
                  : property.type === 'number'
                    ? 'number'
                    : 'text',
              valueEditorType: property.type === 'boolean' ? 'checkbox' : 'text',
              modelPath: model.path,
            }
          })
        })
        .flat()

      const options = Object.values(models).map((model) => ({
        value: model.path,
        label: startCase(model.label),
      }))

      return {
        models,
        fields,
        options,
      }
    }
    return {
      models: null,
      fields: null,
      options: null,
    }
  }, [schemas, buildPromoModels])

  return result
}
