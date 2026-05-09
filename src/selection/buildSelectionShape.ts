import { ClassObject, FieldValue, GQLKind, ParseResult } from '../parser';
import { ResolvedObjectField, SelectionCatalogue, SelectionShape } from './types';

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

  const getResolvedObjectField = (
    field: FieldValue,
    queryContext?: ClassObject
  ): ResolvedObjectField | undefined => {
    if (field.type.kind !== GQLKind.Object) {
      return undefined;
    }

    const referencedClass = parseResult.classes.get(field.type.id);
    if (!referencedClass) {
      throw new Error(`Unable to find reference to "${field.type.id}" from "${field.name}"`);
    }

    const shape = getSelectionShape(field.type.id);
    const selectedFieldNames = field.selectedFields ?? [];
    const sortedSelectedFieldNames = sortFieldNames(selectedFieldNames);
    const baseSelectedFieldNames = sortFieldNames(
      (shape?.selectedFields ?? referencedClass.outputs).map((selectedField) => selectedField.name)
    );
    const projectedFields = filterFieldsByName(
      shape?.baseFields ?? referencedClass.outputs,
      field.selectedFields
    );
    const schemaTypeName = field.schemaTypeName ?? referencedClass.name;
    const resolvedProjectedFields =
      projectedFields.length > 0
        ? projectedFields
        : shape?.selectedFields ?? referencedClass.outputs;
    const needsPickType = Boolean(
      queryContext?.operation &&
        referencedClass.shouldInline &&
        !referencedClass.userDefined &&
        !field.fragmentSpreads?.length &&
        sortedSelectedFieldNames.length > 0 &&
        !areSameFieldNames(baseSelectedFieldNames, sortedSelectedFieldNames)
    );

    if (field.fragmentSpreads?.length) {
      return {
        kind: 'fragment-backed',
        fieldName: field.name,
        fieldTypeId: field.type.id,
        schemaTypeName,
        referencedClass,
        projectedFields: resolvedProjectedFields,
        fragmentSpreads: field.fragmentSpreads,
      };
    }

    if (referencedClass.isSelectionBuilder) {
      return {
        kind: 'selection-builder',
        fieldName: field.name,
        fieldTypeId: field.type.id,
        schemaTypeName,
        referencedClass,
        projectedFields: resolvedProjectedFields,
      };
    }

    if (referencedClass.userDefined) {
      return {
        kind: 'user-defined',
        fieldName: field.name,
        fieldTypeId: field.type.id,
        schemaTypeName,
        referencedClass: referencedClass as ClassObject & {
          userDefined: NonNullable<ClassObject['userDefined']>;
        },
        projectedFields: resolvedProjectedFields,
      };
    }

    if (referencedClass.shouldInline && referencedClass.isInput) {
      return {
        kind: 'inline-input',
        fieldName: field.name,
        fieldTypeId: field.type.id,
        schemaTypeName,
        referencedClass,
        projectedFields: resolvedProjectedFields,
      };
    }

    if (referencedClass.shouldInline && queryContext && needsPickType) {
      return {
        kind: 'inline-pick',
        fieldName: field.name,
        fieldTypeId: field.type.id,
        schemaTypeName,
        referencedClass,
        projectedFields: resolvedProjectedFields,
        selectedFieldNames,
        pickTypeName: getPickTypeName(queryContext.name, field.name, referencedClass.name),
      };
    }

    if (referencedClass.shouldInline) {
      return {
        kind: 'inline',
        fieldName: field.name,
        fieldTypeId: field.type.id,
        schemaTypeName,
        referencedClass,
        projectedFields: resolvedProjectedFields,
      };
    }

    return {
      kind: 'builder',
      fieldName: field.name,
      fieldTypeId: field.type.id,
      schemaTypeName,
      referencedClass,
      projectedFields: resolvedProjectedFields,
    };
  };

  return {
    getSelectionShape,
    getFieldsToRender,
    getResolvedObjectField,
  };
}
