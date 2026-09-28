import SwaggerParser from "@apidevtools/swagger-parser"
import { cloneDeep } from "lodash"
import {
  generateFormSchema,
  generateParameterSchema,
  shallowNestedProperties,
} from "../src/formSchemaGenerator.utils.tsx"

const baseApiUrl = "https://sandboxapi.ordercloud.io"
const token = process.env.OC_ACCESS_TOKEN ?? ""
const stamp = Date.now()
const productId = `sdk-edge-product-${stamp}`
const priceScheduleId = `sdk-edge-prices-${stamp}`
const catalogId = `sdk-edge-catalog-${stamp}`
const categoryId = `sdk-edge-category-${stamp}`
const specId = `sdk-edge-spec-${stamp}`
const promotionId = `sdk-edge-promo-${stamp}`

function findOperation(spec, operationId) {
  for (const item of Object.values(spec.paths)) {
    for (const operation of Object.values(item)) {
      if (operation && operation.operationId === operationId) return operation
    }
  }
  return null
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
  }
}

function formSchemaFor(operation) {
  const { requestSchema, resourceSchema } = resourceSchemaFor(operation)
  return {
    body: generateFormSchema(resourceSchema, requestSchema.required),
    resourceSchema,
    required: requestSchema.required ?? [],
  }
}

const results = []
function record(name, pass, detail) {
  results.push({ name, pass })
  console.log(`${pass ? "PASS" : "FAIL"} ${name}: ${detail}`)
}

function errorDetail(body) {
  const errors = body?.Errors
  if (!errors) return JSON.stringify(body)
  return errors.map((error) => error.Message || error.ErrorCode).join("; ")
}

if (token.split(".").length !== 3) {
  console.error("OC_ACCESS_TOKEN is not a complete JWT.")
  process.exit(1)
}

const spec = await SwaggerParser.dereference(`${baseApiUrl}/v1/openapi/v3`)
const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
}

let createdProduct = false
let createdPriceSchedule = false
let createdCatalog = false
let createdCategory = false
let createdSpec = false
let createdPromotion = false
let specAssigned = false

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

try {
  const productForm = formSchemaFor(findOperation(spec, "Products.Save"))
  const created = await call("POST", "/v1/products", { ID: productId, Name: "SDK edge product" })
  createdProduct = created.ok
  if (!created.ok) {
    record("setup product", false, errorDetail(created.body))
  } else {
    const loaded = await call("GET", `/v1/products/${productId}`)
    const full = productForm.body.safeParse({
      ...loaded.body,
      Description: "Keep me",
      Inventory: { Enabled: true, QuantityAvailable: 4, NotificationPoint: "" },
    })
    const fullSaved = full.success ? await call("PUT", `/v1/products/${productId}`, full.data) : null
    const fullLoaded = fullSaved?.ok ? await call("GET", `/v1/products/${productId}`) : null
    const established =
      full.success &&
      fullSaved?.ok &&
      fullLoaded?.body?.Description === "Keep me" &&
      fullLoaded.body.Inventory?.QuantityAvailable === 4
    record(
      "establish description and inventory",
      Boolean(established),
      established ? "Description and QuantityAvailable=4" : full.success ? errorDetail(fullSaved?.body) : JSON.stringify(full.error.issues)
    )

    const sparse = productForm.body.safeParse({ ID: productId, Name: "SDK edge product" })
    const sparseSaved = sparse.success ? await call("PUT", `/v1/products/${productId}`, sparse.data) : null
    const sparseLoaded = sparseSaved?.ok ? await call("GET", `/v1/products/${productId}`) : null
    record(
      "omitted description is cleared",
      Boolean(sparseSaved?.ok && sparseLoaded?.body?.Description == null),
      sparse.success ? `description=${sparseLoaded?.body?.Description}` : JSON.stringify(sparse.error.issues)
    )
    record(
      "omitted inventory object is kept",
      Boolean(sparseSaved?.ok && sparseLoaded?.body?.Inventory?.QuantityAvailable === 4),
      sparse.success ? `qty=${sparseLoaded?.body?.Inventory?.QuantityAvailable}` : JSON.stringify(sparse.error.issues)
    )

    const xpSchema = {
      type: "object",
      properties: {
        Color: { type: "string" },
        Rank: { type: "integer" },
        Featured: { type: "boolean" },
        Tags: { type: "array", items: { type: "string" } },
      },
    }
    const xpForm = (() => {
      const built = resourceSchemaFor(findOperation(spec, "Products.Save"))
      built.resourceSchema.xp = xpSchema
      return generateFormSchema(built.resourceSchema, built.requestSchema.required)
    })()
    const xpParsed = xpForm.safeParse({
      ...sparseLoaded.body,
      Name: "SDK edge product",
      xp: { Color: "red", Rank: 3, Featured: false, Tags: ["summer", "sale"] },
    })
    const xpSaved = xpParsed.success ? await call("PUT", `/v1/products/${productId}`, xpParsed.data) : null
    const xpLoaded = xpSaved?.ok ? await call("GET", `/v1/products/${productId}`) : null
    const xp = xpLoaded?.body?.xp
    record(
      "xp string integer boolean and list",
      Boolean(xpSaved?.ok && xp?.Color === "red" && xp?.Rank === 3 && xp?.Featured === false && xp?.Tags?.join() === "summer,sale"),
      xpParsed.success ? (xpSaved?.ok ? JSON.stringify(xp) : errorDetail(xpSaved.body)) : JSON.stringify(xpParsed.error.issues)
    )

    const decimal = productForm.body.safeParse({
      ID: productId,
      Name: "SDK edge product",
      QuantityMultiplier: 1.5,
    })
    let decimalDetail = decimal.success ? "schema accepted 1.5" : JSON.stringify(decimal.error.issues)
    if (decimal.success) {
      const decimalSaved = await call("PUT", `/v1/products/${productId}`, decimal.data)
      decimalDetail = decimalSaved.ok
        ? `api accepted QuantityMultiplier=${(await call("GET", `/v1/products/${productId}`)).body?.QuantityMultiplier}`
        : `api rejected: ${errorDetail(decimalSaved.body)}`
    }
    record(
      "integer rejects a decimal",
      !decimal.success && /whole number/i.test(decimalDetail),
      decimalDetail
    )
  }

  const priceForm = formSchemaFor(findOperation(spec, "PriceSchedules.Create"))
  const priceSave = formSchemaFor(findOperation(spec, "PriceSchedules.Save"))
  const twoBreaks = priceForm.body.safeParse({
    ID: priceScheduleId,
    Name: "SDK edge prices",
    PriceBreaks: [
      { Quantity: 1, Price: 1.25 },
      { Quantity: 5, Price: 1 },
    ],
  })
  const priceCreated = twoBreaks.success ? await call("POST", "/v1/priceschedules", twoBreaks.data) : null
  createdPriceSchedule = Boolean(priceCreated?.ok)
  const twoLoaded = priceCreated?.ok ? await call("GET", `/v1/priceschedules/${priceScheduleId}`) : null
  record(
    "two price breaks",
    Boolean(twoLoaded?.body?.PriceBreaks?.length === 2 && twoLoaded.body.PriceBreaks[1].Price === 1),
    twoBreaks.success ? (priceCreated?.ok ? JSON.stringify(twoLoaded.body.PriceBreaks) : errorDetail(priceCreated.body)) : JSON.stringify(twoBreaks.error.issues)
  )
  const oneBreak = priceSave.body.safeParse({
    ID: priceScheduleId,
    Name: "SDK edge prices",
    PriceBreaks: [{ Quantity: 1, Price: 1.25 }],
  })
  const oneSaved = oneBreak.success && createdPriceSchedule ? await call("PUT", `/v1/priceschedules/${priceScheduleId}`, oneBreak.data) : null
  const oneLoaded = oneSaved?.ok ? await call("GET", `/v1/priceschedules/${priceScheduleId}`) : null
  record(
    "remove a price break",
    Boolean(oneLoaded?.body?.PriceBreaks?.length === 1),
    oneBreak.success ? (oneSaved?.ok ? JSON.stringify(oneLoaded.body.PriceBreaks) : errorDetail(oneSaved?.body)) : JSON.stringify(oneBreak.error.issues)
  )
  const emptyBreaks = priceSave.body.safeParse({
    ID: priceScheduleId,
    Name: "SDK edge prices",
    PriceBreaks: [],
  })
  const emptySaved = emptyBreaks.success && createdPriceSchedule ? await call("PUT", `/v1/priceschedules/${priceScheduleId}`, emptyBreaks.data) : null
  const emptyLoaded = emptySaved?.ok ? await call("GET", `/v1/priceschedules/${priceScheduleId}`) : null
  record(
    "empty price breaks",
    Boolean(emptySaved?.ok && Array.isArray(emptyLoaded?.body?.PriceBreaks) && emptyLoaded.body.PriceBreaks.length === 0),
    emptyBreaks.success
      ? emptySaved?.ok
        ? JSON.stringify(emptyLoaded.body.PriceBreaks)
        : errorDetail(emptySaved.body)
      : JSON.stringify(emptyBreaks.error.issues)
  )

  const categoryOperation = findOperation(spec, "Categories.Create")
  const categoryForm = formSchemaFor(categoryOperation)
  const catalog = await call("POST", "/v1/catalogs", { ID: catalogId, Name: "SDK edge catalog", Active: true })
  createdCatalog = catalog.ok
  const categoryParsed = categoryForm.body.safeParse({ ID: categoryId, Name: "SDK edge category", Active: true })
  const category = categoryParsed.success && createdCatalog
    ? await call("POST", `/v1/catalogs/${catalogId}/categories`, categoryParsed.data)
    : null
  createdCategory = Boolean(category?.ok)
  const categoryLoaded = category?.ok ? await call("GET", `/v1/catalogs/${catalogId}/categories/${categoryId}`) : null
  record(
    "category create",
    Boolean(category?.ok && categoryLoaded?.body?.Name === "SDK edge category"),
    categoryParsed.success
      ? category?.ok
        ? categoryLoaded.body.ID
        : `${catalog.ok ? "" : errorDetail(catalog.body) + " "}${errorDetail(category?.body)}`
      : JSON.stringify(categoryParsed.error.issues)
  )

  const specForm = formSchemaFor(findOperation(spec, "Specs.Create"))
  const optionForm = formSchemaFor(findOperation(spec, "Specs.CreateOption"))
  const specParsed = specForm.body.safeParse({
    ID: specId,
    Name: "SDK edge spec",
    Required: true,
    DefinesVariant: true,
    Options: [
      { ID: "small", Value: "Small" },
      { ID: "large", Value: "Large" },
    ],
  })
  record(
    "spec form omits read-only options",
    Boolean(specParsed.success && !Object.prototype.hasOwnProperty.call(specParsed.data, "Options")),
    specParsed.success ? JSON.stringify(specParsed.data) : JSON.stringify(specParsed.error.issues)
  )
  const specCreated = specParsed.success ? await call("POST", "/v1/specs", specParsed.data) : null
  createdSpec = Boolean(specCreated?.ok)
  const small = optionForm.body.safeParse({ ID: "small", Value: "Small" })
  const large = optionForm.body.safeParse({ ID: "large", Value: "Large" })
  const smallCreated = small.success && createdSpec ? await call("POST", `/v1/specs/${specId}/options`, small.data) : null
  const largeCreated = large.success && createdSpec ? await call("POST", `/v1/specs/${specId}/options`, large.data) : null
  const specLoaded = smallCreated?.ok && largeCreated?.ok ? await call("GET", `/v1/specs/${specId}`) : null
  record(
    "spec with two options",
    Boolean(specLoaded?.body?.Options?.length === 2),
    specCreated?.ok
      ? smallCreated?.ok && largeCreated?.ok
        ? JSON.stringify(specLoaded.body.Options)
        : `${errorDetail(smallCreated?.body)} ${errorDetail(largeCreated?.body)}`
      : errorDetail(specCreated?.body)
  )
  const removed = createdSpec ? await call("DELETE", `/v1/specs/${specId}/options/large`) : null
  const optionLoaded = removed?.ok ? await call("GET", `/v1/specs/${specId}`) : null
  record(
    "remove a spec option",
    Boolean(optionLoaded?.body?.Options?.length === 1 && optionLoaded.body.Options[0].ID === "small"),
    removed?.ok ? JSON.stringify(optionLoaded.body.Options) : errorDetail(removed?.body)
  )

  if (createdProduct && createdSpec) {
    const assignmentOperation = findOperation(spec, "Specs.SaveProductAssignment")
    const assignmentForm = assignmentOperation ? formSchemaFor(assignmentOperation) : null
    const assignmentParsed = assignmentForm?.body.safeParse({ SpecID: specId, ProductID: productId })
    const assigned = assignmentParsed?.success
      ? await call("POST", "/v1/specs/productassignments", assignmentParsed.data)
      : null
    specAssigned = Boolean(assigned?.ok)
    record(
      "spec product assignment",
      Boolean(assigned?.ok),
      assignmentParsed?.success ? (assigned?.ok ? `${specId} -> ${productId}` : errorDetail(assigned.body)) : "schema missing"
    )
    const variantOperation = findOperation(spec, "Variants.Generate") ?? findOperation(spec, "Products.GenerateVariants")
    const generated = specAssigned
      ? await call("POST", `/v1/products/${productId}/variants/generate`, { Active: true })
      : null
    const variants = generated?.ok ? await call("GET", `/v1/products/${productId}/variants`) : null
    record(
      "generated variant",
      Boolean(generated?.ok && (variants?.body?.Items?.length ?? variants?.body?.length ?? 0) >= 1),
      generated?.ok
        ? JSON.stringify(variants?.body?.Items ?? variants?.body)
        : `${variantOperation?.operationId ?? "POST /products/{productID}/variants/generate"} ${errorDetail(generated?.body)}`
    )
  }

  const promotionOperation = findOperation(spec, "Promotions.Create")
  const dateField = Object.entries(resourceSchemaFor(promotionOperation).resourceSchema).find(
    ([, property]) => property.format === "date-time" && !property.readOnly
  )
  const promotionForm = formSchemaFor(promotionOperation)
  const start = new Date(Date.now() + 60_000).toISOString()
  const promotionInput = {
    ID: promotionId,
    Name: "SDK edge promo",
    Code: `EDGE${stamp}`.slice(0, 50),
    Description: "edge",
    FinePrint: "edge",
    EligibleExpression: "true",
    ValueExpression: "5",
  }
  if (dateField) promotionInput[dateField[0]] = start
  const promotionParsed = promotionForm.body.safeParse(promotionInput)
  const numberDate = dateField
    ? promotionForm.body.safeParse({ ...promotionInput, [dateField[0]]: 5 })
    : null
  const promotion = promotionParsed.success ? await call("POST", "/v1/promotions", promotionParsed.data) : null
  createdPromotion = Boolean(promotion?.ok)
  const promotionLoaded = promotion?.ok ? await call("GET", `/v1/promotions/${promotionId}`) : null
  record(
    "writable date-time",
    Boolean(dateField && promotion?.ok && promotionLoaded?.body?.[dateField[0]]),
    [
      dateField ? `${dateField[0]}=${promotionLoaded?.body?.[dateField[0]] ?? "missing"}` : "no writable date-time on promotion",
      numberDate?.success ? `numeric 5 became ${JSON.stringify(numberDate.data[dateField[0]])}` : `numeric input rejected by schema`,
      promotionParsed.success ? (promotion?.ok ? "" : errorDetail(promotion.body)) : JSON.stringify(promotionParsed.error.issues),
    ].filter(Boolean).join("; ")
  )
} finally {
  if (specAssigned) await call("DELETE", `/v1/specs/${specId}/productassignments/${productId}`)
  if (createdCategory) await call("DELETE", `/v1/catalogs/${catalogId}/categories/${categoryId}`)
  if (createdCatalog) await call("DELETE", `/v1/catalogs/${catalogId}`)
  if (createdSpec) await call("DELETE", `/v1/specs/${specId}`)
  if (createdPromotion) await call("DELETE", `/v1/promotions/${promotionId}`)
  if (createdPriceSchedule) await call("DELETE", `/v1/priceschedules/${priceScheduleId}`)
  if (createdProduct) await call("DELETE", `/v1/products/${productId}`)
  const failed = results.filter((result) => !result.pass)
  console.log(`\n${results.length - failed.length}/${results.length} edge cases passed`)
  if (failed.length) process.exitCode = 1
}
