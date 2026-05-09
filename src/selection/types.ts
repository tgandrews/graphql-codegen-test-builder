import { ClassObject, FieldValue } from '../parser';

export type SelectionShape = {
  typeId: string;
  typeName: string;
  baseFields: FieldValue[];
  selectedFields: FieldValue[];
  hasMultipleOperations: boolean;
  isCompleteSchema: boolean;
};

export type FieldProjection = {
  fieldName: string;
  fieldTypeId: string;
  schemaTypeName?: string;
  selectedFieldNames?: string[];
  fragmentSpreads?: string[];
  requiresSyntheticSelectionBuilder: boolean;
  projectionTypeName?: string;
  projectedFields: FieldValue[];
  isFragmentBacked: boolean;
  needsPickType: boolean;
};

export type ObjectFieldStrategy = {
  fieldName: string;
  fieldPathTypeId: string;
  referencedClass: ClassObject;
  schemaTypeName: string;
  projectedFields: FieldValue[];
  isFragmentBacked: boolean;
  fragmentSpreads?: string[];
  isSelectionBuilder: boolean;
  isUserDefined: boolean;
  shouldInline: boolean;
  isInlineInput: boolean;
};

export type SelectionCatalogue = {
  getSelectionShape(typeId: string): SelectionShape | undefined;
  getFieldsToRender(klass: ClassObject, selectedFieldNames?: string[]): FieldValue[];
  getFieldProjection(field: FieldValue, queryContext?: ClassObject): FieldProjection | undefined;
  getObjectFieldStrategy(
    field: FieldValue,
    queryContext?: ClassObject
  ): ObjectFieldStrategy | undefined;
};
