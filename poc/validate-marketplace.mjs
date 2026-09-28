import { readFileSync } from "node:fs"
import SwaggerParser from "@apidevtools/swagger-parser"
import { cloneDeep } from "lodash"
import {
  generateFormSchema,
  generateParameterSchema,
  shallowNestedProperties,
  shapeXpSchema,
} from "../src/formSchemaGenerator.utils.tsx"

const baseApiUrl = "https://sandboxapi.ordercloud.io"
const token = process.env.OC_ACCESS_TOKEN ?? ""

function findOperation(spec, operationId) {
  for (const item of Object.values(spec.paths)) {
    for (const operation of Object.values(item)) {
      if (operation && operation.operationId === operationId) return operation
    }
  }
  throw new Error(`Missing operation ${operationId}`)
}

function resourceSchemaFor(operation) {
  const requestSchema = operation.requestBody.content["application/json"].schema
  const nativeProperties = cloneDeep(requestSchema.allOf[0].properties)
  requestSchema.required?.forEach((propKey) => {
    nativeProperties[propKey].required = true
  })
  return {
    requestSchema,
    resourceSchema: shallowNestedProperties(nativeProperties),
    parameters: generateParameterSchema(operation),
  }
}

function formSchemaFor(operation) {
  const { requestSchema, resourceSchema, parameters } = resourceSchemaFor(operation)
  const body = generateFormSchema(resourceSchema, requestSchema.required)
  const parameterSchema = parameters
    ? generateFormSchema(parameters.schema, parameters.required)
    : null
  return { body, parameterSchema, resourceSchema }
}

function summarize(schema) {
  const types = {}
  for (const [name, property] of Object.entries(schema)) {
    types[property.type || "unknown"] = (types[property.type || "unknown"] || 0) + 1
    if (property.readOnly) types.readOnly = (types.readOnly || 0) + 1
    void name
  }
  return { fields: Object.keys(schema).length, types }
}

const spec = await SwaggerParser.dereference(`${baseApiUrl}/v1/openapi/v3`)
const create = formSchemaFor(findOperation(spec, "Products.Create"))
const save = formSchemaFor(findOperation(spec, "Products.Save"))
const assignment = formSchemaFor(findOperation(spec, "Products.SaveAssignment"))

const createInput = {
  Name: "SDK form poc",
  ID: "sdk-form-poc",
  Description: "",
  Active: null,
  Inventory: { Enabled: false, QuantityAvailable: "" },
  xp: {},
}

function issuesFor(schema, value) {
  const parsed = schema.safeParse(value)
  if (parsed.success) return { ok: true, data: parsed.data, issues: [] }
  return {
    ok: false,
    issues: parsed.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  }
}

const createAttempt = issuesFor(create.body, createInput)
const createWithMultiplier = issuesFor(create.body, {
  ...createInput,
  QuantityMultiplier: 1,
})

const saveInput = {
  parameters: { productID: "" },
  body: { Name: "", ID: "sdk-form-poc" },
}
let saveError = null
try {
  save.parameterSchema.parse({ productID: "" })
} catch (error) {
  saveError = error.issues?.map((issue) => issue.message) ?? [error.message]
}

const assignmentParsed = issuesFor(assignment.body, {
  ProductID: "sdk-form-poc",
  BuyerID: "buyer",
})

const report = {
  marketplace: "Cloud Commerce",
  specVersion: spec.info?.version,
  create: {
    schema: summarize(create.resourceSchema),
    untouchedNumberFields: createAttempt,
    withQuantityMultiplier: createWithMultiplier.ok
      ? createWithMultiplier.data
      : createWithMultiplier.issues,
  },
  save: {
    schema: summarize(save.resourceSchema),
    emptyProductId: saveError,
  },
  assignment: {
    schema: summarize(assignment.resourceSchema),
    parsed: assignmentParsed,
  },
}

console.log(JSON.stringify(report, null, 2))

function arrayFields(schema) {
  return Object.entries(schema)
    .filter(([, property]) => property.type === "array" && !property.readOnly)
    .map(([name]) => name)
}

const fieldResults = []
function record(name, pass, detail) {
  fieldResults.push({ name, pass, detail })
  console.log(`${pass ? "PASS" : "FAIL"} ${name}: ${detail}`)
}

const jwtParts = token.split(".").length
if (jwtParts !== 3) {
  console.error(
    `\nOC_ACCESS_TOKEN is not a complete JWT (${token.length} characters). Field tests were not sent.`
  )
  process.exitCode = 2
} else {
  const stamp = Date.now()
  const productId = `sdk-form-poc-${stamp}`
  const buyerId = `sdk-form-buyer-${stamp}`
  const catalogId = `sdk-form-catalog-${stamp}`
  const priceScheduleId = `sdk-form-prices-${stamp}`
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }
  let createdProduct = false
  let createdBuyer = false
  let createdPriceSchedule = false
  let createdCatalog = false
  let assignmentBuyerId = null

  async function call(method, path, body) {
    const response = await fetch(`${baseApiUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await response.text()
    let parsed = text
    try {
      parsed = text ? JSON.parse(text) : null
    } catch {
      parsed = text
    }
    return { status: response.status, ok: response.status < 400, body: parsed }
  }

  function errorDetail(body) {
    const errors = body?.Errors
    if (!errors) return JSON.stringify(body)
    return errors.map((error) => error.Message || error.ErrorCode).join("; ")
  }

  try {
    const blank = create.body.safeParse({
      ID: productId,
      Name: "SDK form poc",
      QuantityMultiplier: "",
      Active: null,
      ShipWeight: null,
    })
    if (!blank.success) {
      record("blank product payload", false, JSON.stringify(blank.error.issues))
    } else if (
      Object.prototype.hasOwnProperty.call(blank.data, "QuantityMultiplier") ||
      Object.prototype.hasOwnProperty.call(blank.data, "Active") ||
      Object.prototype.hasOwnProperty.call(blank.data, "ShipWeight")
    ) {
      record("blank product payload", false, JSON.stringify(blank.data))
    } else {
      const created = await call("POST", "/v1/products", blank.data)
      createdProduct = created.ok
      record(
        "create with blank numbers and null active",
        created.ok,
        created.ok ? created.body.ID : errorDetail(created.body)
      )
    }

    if (createdProduct) {
      const loaded = await call("GET", `/v1/products/${productId}`)
      const reparsed = save.body.safeParse(loaded.body)
      const saved = reparsed.success
        ? await call("PUT", `/v1/products/${productId}`, {
            ...reparsed.data,
            Description: "Edited after load",
          })
        : null
      const confirmed = saved?.ok ? await call("GET", `/v1/products/${productId}`) : null
      record(
        "edit after async load",
        Boolean(saved?.ok && confirmed?.body?.Description === "Edited after load" && confirmed.body.Active !== null),
        saved?.ok
          ? `Name=${confirmed.body.Name} Active=${confirmed.body.Active} QuantityMultiplier=${confirmed.body.QuantityMultiplier}`
          : reparsed.success
            ? errorDetail(saved.body)
            : JSON.stringify(reparsed.error.issues)
      )

      const nestedInput = {
        ...loaded.body,
        Inventory: { Enabled: true, QuantityAvailable: 4, NotificationPoint: "" },
      }
      const nested = save.body.safeParse(nestedInput)
      const nestedSaved = nested.success
        ? await call("PUT", `/v1/products/${productId}`, nested.data)
        : null
      const nestedLoaded = nestedSaved?.ok ? await call("GET", `/v1/products/${productId}`) : null
      record(
        "nested inventory object",
        Boolean(nestedSaved?.ok && nestedLoaded?.body?.Inventory?.QuantityAvailable === 4),
        nested.success
          ? nestedSaved?.ok
            ? JSON.stringify(nestedLoaded.body.Inventory)
            : errorDetail(nestedSaved.body)
          : JSON.stringify(nested.error.issues)
      )

      const xpBodySchema = (() => {
        const built = resourceSchemaFor(findOperation(spec, "Products.Create"))
        const xpSchema = {
          type: "object",
          required: ["Color"],
          properties: { Color: { type: "string", required: true } },
        }
        built.resourceSchema.xp = xpSchema
        return generateFormSchema(built.resourceSchema, built.requestSchema.required)
      })()
      const missingXp = xpBodySchema.safeParse({ ID: productId, Name: "SDK form poc", xp: {} })
      const withXp = xpBodySchema.safeParse({
        ID: productId,
        Name: "SDK form poc",
        xp: { Color: "red" },
      })
      const xpSaved = withXp.success ? await call("PUT", `/v1/products/${productId}`, withXp.data) : null
      const xpLoaded = xpSaved?.ok ? await call("GET", `/v1/products/${productId}`) : null
      record(
        "provider xp schema",
        Boolean(!missingXp.success && xpSaved?.ok && xpLoaded?.body?.xp?.Color === "red"),
        xpSaved?.ok ? `xp.Color=${xpLoaded.body.xp?.Color}` : missingXp.success ? "blank xp was accepted" : errorDetail(xpSaved?.body)
      )

      const inferred = shapeXpSchema([xpLoaded?.body ?? { xp: { Color: "red" } }])
      const inferredSchema = generateFormSchema(inferred.properties)
      const inferredParsed = inferredSchema.safeParse({ Color: "red" })
      record(
        "inferred xp",
        Boolean(inferred.properties?.Color?.type === "string" && inferredParsed.success),
        JSON.stringify(inferred.properties)
      )
    }

    const buyers = await call("GET", "/v1/buyers?pageSize=1")
    let assignmentBuyer = buyers.body?.Items?.[0]?.ID
    assignmentBuyerId = assignmentBuyer ?? null
    if (!assignmentBuyer) {
      const buyer = await call("POST", "/v1/buyers", { ID: buyerId, Name: "SDK form buyer", Active: true })
      createdBuyer = buyer.ok
      assignmentBuyer = buyer.ok ? buyerId : null
      assignmentBuyerId = assignmentBuyer
    }
    if (createdProduct && assignmentBuyer) {
      const catalog = await call("POST", "/v1/catalogs", {
        ID: catalogId,
        Name: "SDK form catalog",
        Active: true,
      })
      createdCatalog = catalog.ok
      const catalogAssigned = createdCatalog
        ? await call("POST", "/v1/catalogs/assignments", { CatalogID: catalogId, BuyerID: assignmentBuyer })
        : null
      const productInCatalog = catalogAssigned?.ok
        ? await call("POST", "/v1/catalogs/productassignments", { CatalogID: catalogId, ProductID: productId })
        : null
      const assignmentBody = assignment.body.safeParse({
        ProductID: productId,
        BuyerID: assignmentBuyer,
      })
      const assigned = assignmentBody.success && productInCatalog?.ok
        ? await call("POST", "/v1/products/assignments", assignmentBody.data)
        : null
      record(
        "assignment save",
        Boolean(assigned?.ok),
        assigned?.ok
          ? `${productId} -> ${assignmentBuyer}`
          : [
              `catalog ${catalog.status} ${errorDetail(catalog.body)}`,
              `catalogAssignment ${catalogAssigned?.status} ${errorDetail(catalogAssigned?.body)}`,
              `productCatalog ${productInCatalog?.status} ${errorDetail(productInCatalog?.body)}`,
              `productAssignment ${assigned?.status} ${errorDetail(assigned?.body)}`,
            ].join(" | ")
      )
    } else {
      record("assignment save", false, "no product or buyer")
    }

    const priceOperation = findOperation(spec, "PriceSchedules.Create")
    const priceForm = formSchemaFor(priceOperation)
    record(
      "array field present on price schedule",
      arrayFields(priceForm.resourceSchema).includes("PriceBreaks"),
      arrayFields(priceForm.resourceSchema).join(", ") || "none"
    )
    const priceParsed = priceForm.body.safeParse({
      ID: priceScheduleId,
      Name: "SDK form prices",
      PriceBreaks: [{ Quantity: 1, Price: 1.25 }],
    })
    const priceCreated = priceParsed.success
      ? await call("POST", "/v1/priceschedules", priceParsed.data)
      : null
    createdPriceSchedule = Boolean(priceCreated?.ok)
    const priceLoaded = priceCreated?.ok ? await call("GET", `/v1/priceschedules/${priceScheduleId}`) : null
    record(
      "array field save",
      Boolean(priceCreated?.ok && priceLoaded?.body?.PriceBreaks?.length === 1 && priceLoaded.body.PriceBreaks[0].Price === 1.25),
      priceParsed.success
        ? priceCreated?.ok
          ? JSON.stringify(priceLoaded.body.PriceBreaks)
          : errorDetail(priceCreated.body)
        : JSON.stringify(priceParsed.error.issues)
    )
  } finally {
    if (createdProduct && assignmentBuyerId) {
      await call("DELETE", `/v1/products/${productId}/assignments/${assignmentBuyerId}`)
    }
    if (createdCatalog && createdProduct) {
      await call("DELETE", `/v1/catalogs/${catalogId}/productassignments/${productId}`)
    }
    if (createdCatalog && assignmentBuyerId) {
      await call("DELETE", `/v1/catalogs/${catalogId}/assignments/${assignmentBuyerId}`)
    }
    if (createdCatalog) await call("DELETE", `/v1/catalogs/${catalogId}`)
    if (createdProduct) await call("DELETE", `/v1/products/${productId}`)
    if (createdBuyer) await call("DELETE", `/v1/buyers/${buyerId}`)
    if (createdPriceSchedule) await call("DELETE", `/v1/priceschedules/${priceScheduleId}`)
    const failed = fieldResults.filter((result) => !result.pass)
    console.log(`\n${fieldResults.length - failed.length}/${fieldResults.length} field tests passed`)
    if (failed.length) process.exitCode = 1
  }
}
