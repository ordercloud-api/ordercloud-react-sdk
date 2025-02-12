import { OpenAPIV3 } from "openapi-types";

export interface IOrderCloudOperationObject extends OpenAPIV3.OperationObject {
    verb: string,
    path: string,
  }