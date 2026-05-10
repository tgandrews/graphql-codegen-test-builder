import { ParsedDocument } from '../parser';
import { UserDefinedClassConfig } from '../types';

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
  isList?: boolean;
  schemaTypeName?: string;
  selectedFields?: string[];
  fragmentSpreads?: string[];
};

export type ClassObject = {
  id: string;
  name: string;
  inputs: FieldValue[];
  outputs: FieldValue[];
  selectedOutputs?: FieldValue[];
  isInput: boolean;
  operation?: 'Query' | 'Mutation';
  isSelectionBuilder?: boolean;
  shouldInline?: boolean;
  isCompleteSchema?: boolean;
  hasMultipleQueries?: boolean;
  userDefined?: { path: string; exportName?: string };
};

export type UnionObject = {
  name: string;
  subTypes: string[];
};

export type FragmentObject = {
  id: string;
  name: string;
  typeName: string;
  outputs: FieldValue[];
};

export type TransformImport = {
  path: string;
  exportName?: string;
  localName: string;
};

export type TransformTypeAlias = {
  kind: 'type-alias';
  name: string;
  fields: FieldValue[];
};

export type TransformPickType = {
  kind: 'pick-type';
  name: string;
  baseTypeName: string;
  selectedFields: string[];
};

export type TransformBuilder = {
  kind: 'builder';
  name: string;
  source: 'operation' | 'object' | 'input' | 'fragment' | 'selection';
  operationType?: 'Query' | 'Mutation';
  inputFields: FieldValue[];
  outputFields: FieldValue[];
};

export type TransformDeclaration = TransformTypeAlias | TransformPickType | TransformBuilder;

export type TransformResult = {
  parsed: ParsedDocument;
  imports: TransformImport[];
  declarations: TransformDeclaration[];
  classes: ClassObject[];
  fragments: FragmentObject[];
  unions: UnionObject[];
  userDefinedClasses?: UserDefinedClassConfig;
};
