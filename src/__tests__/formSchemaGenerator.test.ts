import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  generateFormSchema,
  generateParameterSchema,
  shapeXpSchema,
} from "../formSchemaGenerator.utils";

function parseField(schema: ReturnType<typeof generateFormSchema>, value: unknown) {
  return schema.parse(value);
}

describe("generateFormSchema", () => {
  it("requires strings and uses the existing field labels", () => {
    const schema = generateFormSchema(
      {
        Name: { type: "string" },
        productID: { type: "string" },
        CatalogIDs: { type: "string" },
        xp: { type: "object", properties: {} },
      },
      ["Name", "productID", "CatalogIDs", "xp"]
    );

    expect(() => parseField(schema, { Name: "" })).toThrow(/Name is required/);
    expect(() => parseField(schema, {})).toThrow(/Product ID is required/);
    expect(() =>
      parseField(schema, { Name: "Hat", productID: "p1", CatalogIDs: "" })
    ).toThrow(/Catalog IDs is required/);
    expect(() =>
      parseField(schema, { Name: "Hat", productID: "p1", CatalogIDs: "c1" })
    ).toThrow(/Extended Properties is required/);
    expect(
      parseField(schema, {
        Name: "Hat",
        productID: "p1",
        CatalogIDs: "c1",
        xp: {},
      })
    ).toMatchObject({ Name: "Hat", xp: {} });
  });

  it("validates email and maxLength", () => {
    const schema = generateFormSchema({
      email: { type: "string" },
      Title: { type: "string", maxLength: 3 },
    });

    expect(() => parseField(schema, { email: "nope" })).toThrow(/Email is invalid/);
    expect(parseField(schema, { email: "a@b.co" })).toMatchObject({ email: "a@b.co" });
    expect(parseField(schema, { email: "" })).toMatchObject({ email: "" });
    expect(parseField(schema, { email: null })).toMatchObject({ email: null });
    expect(parseField(schema, { Title: "ab" })).toMatchObject({ Title: "ab" });
    expect(() => parseField(schema, { Title: "abcd" })).toThrow(
      /Title must not exceed 3 characters/
    );
  });

  it("omits empty numbers and honors minimum only when a number is present", () => {
    const schema = generateFormSchema({
      Quantity: { type: "number" },
      Count: { type: "integer", minimum: 1 },
      Floor: { type: "integer", minimum: 0 },
    });

    const blank = parseField(schema, { Quantity: "", Count: "", Floor: "" });
    expect(blank.Quantity).toBeUndefined();
    expect(blank.Count).toBeUndefined();
    expect(blank.Floor).toBeUndefined();
    expect(JSON.stringify(blank)).toBe("{}");

    expect(parseField(schema, { Quantity: null, Count: 2, Floor: 0 }).Quantity).toBeUndefined();
    expect(parseField(schema, { Quantity: undefined, Count: 2, Floor: 0 }).Quantity).toBeUndefined();
    expect(parseField(schema, { Quantity: Number.NaN, Count: 2, Floor: 0 }).Quantity).toBeUndefined();
    expect(parseField(schema, { Quantity: 2, Count: 2, Floor: 0 })).toMatchObject({
      Quantity: 2,
      Count: 2,
      Floor: 0,
    });
    expect(() => parseField(schema, { Count: 0, Quantity: 0, Floor: 0 })).toThrow(
      /Count must be at least 1/
    );
    expect(() => parseField(schema, { Floor: -1, Quantity: 0, Count: 1 })).toThrow(
      /Floor must be at least 0/
    );
    expect(parseField(schema, { Quantity: "2", Count: 1, Floor: 0 }).Quantity).toBeUndefined();
  });

  it("submits a product name when quantity multiplier and active are blank", () => {
    const schema = generateFormSchema(
      {
        Name: { type: "string" },
        QuantityMultiplier: { type: "integer", minimum: 1 },
        Active: { type: "boolean" },
      },
      ["Name"]
    );

    const parsed = schema.parse({ Name: "Hat", QuantityMultiplier: "", Active: null });
    expect(parsed).toEqual({ Name: "Hat" });
    expect("QuantityMultiplier" in parsed).toBe(false);
    expect("Active" in parsed).toBe(false);
    expect(() => schema.parse({ Name: "Hat", QuantityMultiplier: 0 })).toThrow(
      /Quantity Multiplier must be at least 1/
    );
    expect(() => schema.parse({ Name: "Hat", QuantityMultiplier: 1.5 })).toThrow(
      /Quantity Multiplier must be a whole number/
    );
  });

  it("keeps null on optional non-objects and drops mismatched values", () => {
    const schema = generateFormSchema({
      Description: { type: "string" },
      Active: { type: "boolean" },
    });

    expect(parseField(schema, { Description: null })).toMatchObject({ Description: null });
    expect(parseField(schema, { Description: 5 }).Description).toBeUndefined();
    expect(parseField(schema, { Active: false })).toMatchObject({ Active: false });
    expect(parseField(schema, { Active: null }).Active).toBeUndefined();
    expect(JSON.stringify(parseField(schema, { Active: null }))).not.toContain("Active");
    expect(parseField(schema, { Active: "true" }).Active).toBeUndefined();
  });

  it("drops empty non-xp objects and keeps empty xp objects", () => {
    const schema = generateFormSchema({
      Address: {
        type: "object",
        properties: { City: { type: "string" } },
      },
      xp: {
        type: "object",
        properties: { Color: { type: "string" } },
      },
    });

    expect(parseField(schema, { Address: {} }).Address).toBeUndefined();
    expect(parseField(schema, { Address: { City: null } }).Address).toBeUndefined();
    expect(parseField(schema, { Address: { City: "Austin" } })).toMatchObject({
      Address: { City: "Austin" },
    });
    expect(parseField(schema, { xp: {} })).toMatchObject({ xp: {} });
    expect(parseField(schema, { xp: { Color: "red" } })).toMatchObject({
      xp: { Color: "red" },
    });
  });

  it("validates nested objects and arrays", () => {
    const schema = generateFormSchema({
      Specs: {
        type: "array",
        items: {
          type: "object",
          properties: {
            Name: { type: "string", required: true },
          },
        },
      },
      Tags: { type: "array", items: { type: "string" } },
    });

    expect(parseField(schema, { Specs: [{ Name: "Size" }], Tags: ["a"] })).toMatchObject({
      Specs: [{ Name: "Size" }],
      Tags: ["a"],
    });
    expect(() => parseField(schema, { Specs: [{ Name: "" }] })).toThrow(/Name is required/);
    expect(parseField(schema, { Tags: "a" }).Tags).toBeUndefined();
    expect(parseField(schema, { Tags: null })).toMatchObject({ Tags: null });
  });

  it("omits read-only fields and does not coerce date-time values to undefined", () => {
    const schema = generateFormSchema({
      Name: { type: "string", required: true },
      ID: { type: "string", readOnly: true },
      DateCreated: { type: "string", format: "date-time" },
    });

    expect(
      parseField(schema, {
        Name: "Hat",
        ID: "1",
        DateCreated: "2018-01-01T00:00:00-06:00",
      })
    ).toEqual({
      Name: "Hat",
      DateCreated: "2018-01-01T00:00:00-06:00",
    });
    expect(parseField(schema, { Name: "Hat", DateCreated: 5 })).toEqual({
      Name: "Hat",
      DateCreated: "5",
    });
  });
});

describe("generateParameterSchema", () => {
  it("adds a filters object when search is present and tracks required parameters", () => {
    const parameters = generateParameterSchema({
      parameters: [
        {
          name: "productID",
          schema: { type: "string" },
          required: true,
          description: "Product",
        },
        { name: "search", schema: { type: "string" }, required: false },
      ],
    });

    expect(parameters?.required).toEqual(["productID"]);
    expect(parameters?.schema.filters).toEqual({ type: "object" });
    expect(parameters?.schema.productID.required).toBe(true);

    const schema = z.object({
      parameters: generateFormSchema(parameters?.schema, parameters?.required),
      body: generateFormSchema({ Name: { type: "string", required: true } }),
    });
    expect(() => schema.parse({ parameters: {}, body: { Name: "Hat" } })).toThrow(
      /Product ID is required/
    );
    expect(
      schema.parse({ parameters: { productID: "p1" }, body: { Name: "Hat" } })
    ).toMatchObject({
      parameters: { productID: "p1" },
      body: { Name: "Hat" },
    });
  });
});

describe("shapeXpSchema", () => {
  it("infers xp property types and skips empty values", () => {
    expect(
      shapeXpSchema([
        { xp: { Color: "red", Empty: [] } },
        { xp: { Color: "blue" } },
      ])
    ).toEqual({
      type: "object",
      properties: {
        Color: { type: "string" },
      },
    });
  });
});
