import { ClassObject, FieldValue } from './types';

function unionFieldsByName(arr1: FieldValue[], arr2: FieldValue[]): FieldValue[] {
  const fieldMap = new Map<string, FieldValue>();
  for (const field of arr1) {
    fieldMap.set(field.name, field);
  }
  for (const field of arr2) {
    if (!fieldMap.has(field.name)) {
      fieldMap.set(field.name, field);
    }
  }
  return Array.from(fieldMap.values());
}

function mergeFieldArrays(arr1: FieldValue[], arr2: FieldValue[]): FieldValue[] {
  if (arr1.length > arr2.length) return arr1;
  if (arr2.length > arr1.length) return arr2;
  // Same length - union them to avoid losing fields
  return unionFieldsByName(arr1, arr2);
}

function mergeSelectedOutputs(
  existing: FieldValue[] | undefined,
  incoming: FieldValue[] | undefined
): FieldValue[] | undefined {
  if (!existing) return incoming;
  if (!incoming) return existing;

  // Union the fields by name
  return unionFieldsByName(existing, incoming);
}

function mergeQuerySelections(
  existing: ClassObject,
  incoming: Omit<ClassObject, 'id'>
): {
  selectedOutputs: FieldValue[] | undefined;
  isCompleteSchema: boolean;
  hasMultipleQueries: boolean;
} {
  const bothComplete = existing.isCompleteSchema && incoming.isCompleteSchema;
  const bothPartial = !existing.isCompleteSchema && !incoming.isCompleteSchema;
  const existingComplete = existing.isCompleteSchema && !incoming.isCompleteSchema;
  const incomingComplete = !existing.isCompleteSchema && incoming.isCompleteSchema;

  // Both are partial selections from different queries
  if (bothPartial) {
    return {
      selectedOutputs: mergeSelectedOutputs(
        existing.selectedOutputs ?? existing.outputs,
        incoming.selectedOutputs ?? incoming.outputs
      ),
      isCompleteSchema: false,
      hasMultipleQueries: true,
    };
  }

  // Partial query merging with complete schema (second+ query)
  if (existingComplete) {
    return {
      selectedOutputs: mergeSelectedOutputs(existing.selectedOutputs, incoming.outputs),
      isCompleteSchema: true,
      hasMultipleQueries: true,
    };
  }

  // Complete schema merging with first query's partial selection
  if (incomingComplete) {
    return {
      selectedOutputs: existing.outputs,
      isCompleteSchema: true,
      hasMultipleQueries: false,
    };
  }

  // Both are complete (merging results from different queries)
  if (bothComplete) {
    if (existing.selectedOutputs && incoming.selectedOutputs) {
      return {
        selectedOutputs: mergeSelectedOutputs(existing.selectedOutputs, incoming.selectedOutputs),
        isCompleteSchema: true,
        hasMultipleQueries: true,
      };
    }

    return {
      selectedOutputs: existing.selectedOutputs ?? incoming.selectedOutputs,
      isCompleteSchema: true,
      hasMultipleQueries: existing.hasMultipleQueries ?? incoming.hasMultipleQueries ?? false,
    };
  }

  // Default: preserve existing
  return {
    selectedOutputs: existing.selectedOutputs,
    isCompleteSchema: existing.isCompleteSchema ?? false,
    hasMultipleQueries: existing.hasMultipleQueries ?? false,
  };
}

export function mergeClasses(
  existing: ClassObject,
  incoming: Omit<ClassObject, 'id'>
): ClassObject {
  // Prefer the more complete lists (more fields), or union if same length
  const mergedInputs = mergeFieldArrays(incoming.inputs, existing.inputs);
  const mergedOutputs = mergeFieldArrays(incoming.outputs, existing.outputs);

  // For operation classes, keep existing values
  if (existing.operation || incoming.operation) {
    return {
      ...existing,
      inputs: mergedInputs,
      outputs: mergedOutputs,
    };
  }

  // For non-operation classes (types), handle query selections
  const mergeResult = mergeQuerySelections(existing, incoming);

  return {
    ...existing,
    inputs: mergedInputs,
    outputs: mergedOutputs,
    selectedOutputs: mergeResult.selectedOutputs,
    isCompleteSchema: mergeResult.isCompleteSchema,
    hasMultipleQueries: mergeResult.hasMultipleQueries,
  };
}
