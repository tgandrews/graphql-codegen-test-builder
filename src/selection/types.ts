import { ClassObject, FieldValue } from '../parser';

export type SelectionShape = {
  typeId: string;
  typeName: string;
  baseFields: FieldValue[];
  selectedFields: FieldValue[];
  hasMultipleOperations: boolean;
  isCompleteSchema: boolean;
};

type ResolvedObjectFieldBase = {
  fieldName: string;
  fieldTypeId: string;
  schemaTypeName: string;
  referencedClass: ClassObject;
  projectedFields: FieldValue[];
};

export type ResolvedObjectField =
  | (ResolvedObjectFieldBase & {
      kind: 'fragment-backed';
      fragmentSpreads: string[];
    })
  | (ResolvedObjectFieldBase & {
      kind: 'selection-builder';
    })
  | (ResolvedObjectFieldBase & {
      kind: 'user-defined';
      referencedClass: ClassObject & {
        userDefined: NonNullable<ClassObject['userDefined']>;
      };
    })
  | (ResolvedObjectFieldBase & {
      kind: 'inline-input';
    })
  | (ResolvedObjectFieldBase & {
      kind: 'inline';
    })
  | (ResolvedObjectFieldBase & {
      kind: 'inline-pick';
      selectedFieldNames: string[];
      pickTypeName: string;
    })
  | (ResolvedObjectFieldBase & {
      kind: 'builder';
    });

export type SelectionCatalogue = {
  getSelectionShape(typeId: string): SelectionShape | undefined;
  getFieldsToRender(klass: ClassObject, selectedFieldNames?: string[]): FieldValue[];
  getResolvedObjectField(
    field: FieldValue,
    queryContext?: ClassObject
  ): ResolvedObjectField | undefined;
};
