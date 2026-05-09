import { ClassObject, FieldValue, GQLKind, ParseResult } from '../parser';
import { FieldProjection, ObjectFieldStrategy, SelectionCatalogue, SelectionShape } from './types';

function areSameFieldNames(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((fieldName, index) => fieldName === right[index]);
}

function sortFieldNames(fieldNames: string[]): string[] {
  return [...fieldNames].sort();
}

function filterFieldsByName(fields: FieldValue[], selectedFieldNames?: string[]): FieldValue[] {
  if (!selectedFieldNames?.length) {
    return fields;
  }

  return fields.filter((field) => selectedFieldNames.includes(field.name));
}

function getShapeFields(klass: ClassObject): FieldValue[] {
  if (klass.isInput) {
    return klass.inputs;
  }

  return klass.selectedOutputs ?? klass.outputs;
}

function buildShape(klass: ClassObject): SelectionShape {
  return {
    typeId: klass.id,
    typeName: klass.name,
    baseFields: klass.isInput ? klass.inputs : klass.outputs,
    selectedFields: getShapeFields(klass),
    hasMultipleOperations: klass.hasMultipleQueries ?? false,
    isCompleteSchema: klass.isCompleteSchema ?? false,
  };
}

export function getPickTypeName(
  queryName: string,
  fieldName: string,
  fieldTypeName: string
): string {
  return `${queryName}${fieldTypeName}Type`;
}

export function buildSelectionCatalogue(parseResult: ParseResult): SelectionCatalogue {
  const shapes = new Map<string, SelectionShape>();

  for (const klass of parseResult.classes.values()) {
    shapes.set(klass.id, buildShape(klass));
  }

  const getSelectionShape = (typeId: string): SelectionShape | undefined => {
    return shapes.get(typeId);
  };

  const getFieldsToRender = (klass: ClassObject, selectedFieldNames?: string[]): FieldValue[] => {
    const shape = getSelectionShape(klass.id) ?? buildShape(klass);
    const baseFields = klass.isInput ? klass.inputs : shape.selectedFields;
    return filterFieldsByName(baseFields, selectedFieldNames);
  };

  const getFieldProjection = (
    field: FieldValue,
    queryContext?: ClassObject
  ): FieldProjection | undefined => {
    if (field.type.kind !== GQLKind.Object) {
      return undefined;
    }

    const referencedClass = parseResult.classes.get(field.type.id);
    if (!referencedClass) {
      throw new Error(`Unable to find reference to "${field.type.id}" from "${field.name}"`);
    }

    const shape = getSelectionShape(field.type.id);
    const selectedFieldNames = sortFieldNames(field.selectedFields ?? []);
    const baseSelectedFieldNames = sortFieldNames(
      (shape?.selectedFields ?? referencedClass.outputs).map((selectedField) => selectedField.name)
    );
    const projectedFields = filterFieldsByName(
      shape?.baseFields ?? referencedClass.outputs,
      field.selectedFields
    );
    const isFragmentBacked = Boolean(field.fragmentSpreads?.length);
    const needsPickType = Boolean(
      queryContext?.operation &&
        referencedClass.shouldInline &&
        !referencedClass.userDefined &&
        !isFragmentBacked &&
        selectedFieldNames.length > 0 &&
        !areSameFieldNames(baseSelectedFieldNames, selectedFieldNames)
    );

    return {
      fieldName: field.name,
      fieldTypeId: field.type.id,
      schemaTypeName: field.schemaTypeName,
      selectedFieldNames: field.selectedFields,
      fragmentSpreads: field.fragmentSpreads,
      requiresSyntheticSelectionBuilder: Boolean(referencedClass.isSelectionBuilder),
      projectionTypeName:
        queryContext && needsPickType
          ? getPickTypeName(queryContext.name, field.name, referencedClass.name)
          : undefined,
      projectedFields:
        projectedFields.length > 0
          ? projectedFields
          : shape?.selectedFields ?? referencedClass.outputs,
      isFragmentBacked,
      needsPickType,
    };
  };

  const getObjectFieldStrategy = (
    field: FieldValue,
    queryContext?: ClassObject
  ): ObjectFieldStrategy | undefined => {
    const projection = getFieldProjection(field, queryContext);
    if (!projection) {
      return undefined;
    }

    const referencedClass = parseResult.classes.get(projection.fieldTypeId);
    if (!referencedClass) {
      throw new Error(
        `Unable to find reference to "${projection.fieldTypeId}" from "${field.name}"`
      );
    }

    return {
      fieldName: projection.fieldName,
      fieldPathTypeId: projection.fieldTypeId,
      referencedClass,
      schemaTypeName: projection.schemaTypeName ?? referencedClass.name,
      projectedFields: projection.projectedFields,
      isFragmentBacked: projection.isFragmentBacked,
      fragmentSpreads: projection.fragmentSpreads,
      isSelectionBuilder: projection.requiresSyntheticSelectionBuilder,
      isUserDefined: Boolean(referencedClass.userDefined),
      shouldInline: Boolean(referencedClass.shouldInline),
      isInlineInput: Boolean(referencedClass.shouldInline && referencedClass.isInput),
    };
  };

  return {
    getSelectionShape,
    getFieldsToRender,
    getFieldProjection,
    getObjectFieldStrategy,
  };
}
