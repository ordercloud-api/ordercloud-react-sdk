import { IOrderCloudContext } from "./IOrderCloudContext";

export interface IOrderCloudErrorContext extends Omit<IOrderCloudContext, "defaultErrorHandler"> {}