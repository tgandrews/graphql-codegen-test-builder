export type ParsedScalarKind = 'string' | 'boolean' | 'int' | 'float';

export type ParsedTypeRef =
  | {
      kind: 'scalar';
      name: ParsedScalarKind;
      nullable: boolean;
      isList: boolean;
    }
  | {
      kind: 'object';
      name: string;
      nullable: boolean;
      isList: boolean;
    };

export type ParsedSelectionSet = ParsedSelection[];

export type ParsedFieldSelection = {
  kind: 'field';
  name: string;
  type: ParsedTypeRef;
  selectionSet?: ParsedSelectionSet;
};

export type ParsedFragmentSpread = {
  kind: 'fragment-spread';
  name: string;
};

export type ParsedSelection = ParsedFieldSelection | ParsedFragmentSpread;

export type ParsedVariable = {
  name: string;
  type: ParsedTypeRef;
};

export type ParsedOperation = {
  name: string;
  operationType: 'Query' | 'Mutation';
  rootTypeName: 'Query' | 'Mutation';
  variables: ParsedVariable[];
  selectionSet: ParsedSelectionSet;
};

export type ParsedFragment = {
  name: string;
  typeName: string;
  selectionSet: ParsedSelectionSet;
};

export type ParsedSchemaType = {
  name: string;
  kind: 'object' | 'input';
  fields: ParsedFieldSelection[];
};

export type ParsedDocument = {
  schemaTypes: Map<string, ParsedSchemaType>;
  operations: ParsedOperation[];
  fragments: ParsedFragment[];
};
