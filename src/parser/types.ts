export enum GQLKind {
  String = 'string',
  Boolean = 'boolean',
  Int = 'int',
  Float = 'float',
  Union = 'union',
  Enum = 'enum',
  Object = 'object',
}

export type SimpleGQLType = {
  kind: GQLKind.Boolean | GQLKind.Float | GQLKind.Int | GQLKind.String;
  nullable: boolean;
};

export type UnionGQLType = {
  kind: GQLKind.Union;
  name: string;
  id: string;
  nullable: boolean;
};

export type EnumGQLType = {
  kind: GQLKind.Enum;
  name: string;
  id: string;
  nullable: boolean;
};

export type ObjectGQLType = {
  kind: GQLKind.Object;
  name: string;
  id: string;
  nullable: boolean;
};

export type GQLType = SimpleGQLType | UnionGQLType | EnumGQLType | ObjectGQLType;

export type FieldValue = {
  type: GQLType;
  name: string;
  isList?: boolean; // True if this field is a list/array
  selectedFields?: string[]; // For object types, the field names that were selected
};

export type ClassObject = {
  id: string;
  name: string;
  inputs: FieldValue[];
  outputs: FieldValue[];
  selectedOutputs?: FieldValue[]; // Fields actually selected across queries (only set when multiple queries)
  isInput: boolean;
  operation?: 'Query' | 'Mutation';
  // TODO: This is a rendering property so shouldn't really live here
  shouldInline?: boolean;
  isCompleteSchema?: boolean; // True if this represents all fields from the schema
  hasMultipleQueries?: boolean; // True if multiple queries selected different fields
  userDefined?: { path: string; exportName?: string }; // User-provided type import info
};

export type UnionObject = {
  name: string;
  subTypes: string[];
};
