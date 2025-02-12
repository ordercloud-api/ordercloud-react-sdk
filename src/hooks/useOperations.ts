import { useCallback, useMemo } from "react";
import useApiSpec from "./useApiSpec";
import Case from "case";

const useOperations = (
  resource: string,
  operationInclusion?: string
) => {
  const { operationsById } = useApiSpec();
  const isMeEndpoint = useMemo(()=> resource.includes('Me.'),[resource])
  const resourceName = useMemo(
    () => {
      const resourceName = isMeEndpoint ? resource.replace("Me.", "") : resource
      return resourceName.charAt(0).toUpperCase() + Case.camel(resourceName.slice(1))
    },
    [isMeEndpoint, resource]
  );

  const tryGetOperation = useCallback(
    (operationId: string) => operationsById[operationId],
    [operationsById]
  );

  const listOperation = useMemo(() => {
    let listOperationId;
    if (isMeEndpoint) {
      listOperationId = `Me.List${resourceName}`;
    } else {
      listOperationId = `${resourceName}.List`;
    }
    return tryGetOperation(listOperationId);
  }, [isMeEndpoint, resourceName, tryGetOperation]);

  const getOperation = useMemo(() => {
    let getOperationId;
    if (isMeEndpoint) {
      getOperationId = `Me.Get${resourceName.slice(0, -1)}`;
    } else {
      getOperationId = `${resourceName}.Get`;
    }

    return tryGetOperation(getOperationId);
  }, [isMeEndpoint, resourceName, tryGetOperation]);

  const saveOperation = useMemo(() => {
    let saveOperationId;
    if (isMeEndpoint) {
      saveOperationId = `Me.Save${resourceName.slice(0, -1)}`;
    } else {
      saveOperationId = `${resourceName}.Save`;
    }

    return tryGetOperation(saveOperationId);
  }, [isMeEndpoint, resourceName, tryGetOperation]);

  const createOperation = useMemo(() => {
    let createOperationId;
    if (isMeEndpoint) {
      createOperationId = `Me.Create${resourceName.slice(0, -1)}`;
    } else {
      createOperationId = `${resourceName}.Create`;
    }

    return tryGetOperation(createOperationId);
  }, [isMeEndpoint, resourceName, tryGetOperation]);

  const deleteOperation = useMemo(() => {
    let deleteOperationId;
    if (isMeEndpoint) {
      deleteOperationId = `Me.Delete${resourceName.slice(0, -1)}`;
    } else {
      deleteOperationId = `${resourceName}.Delete`;
    }

    return tryGetOperation(deleteOperationId);
  }, [isMeEndpoint, resourceName, tryGetOperation]);

  const assignmentListOperation = useMemo(() => {
    const assignmentListOperationId = `${resourceName}.List${
      operationInclusion ?? ""
    }Assignments`;
    return tryGetOperation(assignmentListOperationId);
  }, [operationInclusion, resourceName, tryGetOperation]);

  const assignmentSaveOperation = useMemo(() => {
    const assignmentSaveOperationId = `${resourceName}.Save${
      operationInclusion ?? ""
    }Assignment`;
    return tryGetOperation(assignmentSaveOperationId);
  }, [operationInclusion, resourceName, tryGetOperation]);

  const assignmentDeleteOperation = useMemo(() => {
    const assignmentDeleteOperationId = `${resourceName}.Delete${
      operationInclusion ?? ""
    }Assignment`;
    return tryGetOperation(assignmentDeleteOperationId);
  }, [operationInclusion, resourceName, tryGetOperation]);

  const result = useMemo(() => {
    return {
      listOperation,
      getOperation,
      saveOperation,
      deleteOperation,
      createOperation,
      assignmentListOperation,
      assignmentSaveOperation,
      assignmentDeleteOperation,
    };
  }, [
    listOperation,
    getOperation,
    saveOperation,
    deleteOperation,
    createOperation,
    assignmentListOperation,
    assignmentSaveOperation,
    assignmentDeleteOperation,
  ]);

  return result;
};

export default useOperations;
