import { Types } from '@graphql-codegen/plugin-helpers';
import {
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLScalarType,
  GraphQLSchema,
  InputValueDefinitionNode,
  isNonNullType,
  isObjectType,
  isScalarType,
  Kind,
  ListTypeNode,
  NamedTypeNode,
  OperationDefinitionNode,
  OperationTypeNode,
  SelectionNode,
  TypeNode,
  VariableDefinitionNode,
} from 'graphql';
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
};
export type UnionObject = {
  name: string;
  subTypes: string[];
};

export class ParseResult {
  classes: Map<string, ClassObject> = new Map();
  unions: Map<string, UnionObject> = new Map();

  addClass(klass: Omit<ClassObject, 'id'>): this {
    const klassId = `${klass.name}:${klass.isInput ? 'input' : 'output'}`;
    const existingKlass = this.classes.get(klassId);
    if (existingKlass) {
      // If it's the same type (input/output) and same operation, merge the fields
      if (existingKlass.isInput === klass.isInput && existingKlass.operation === klass.operation) {
        // Merge inputs and outputs, preferring the more complete one (more fields)
        const mergedInputs =
          klass.inputs.length > existingKlass.inputs.length ? klass.inputs : existingKlass.inputs;
        const mergedOutputs =
          klass.outputs.length > existingKlass.outputs.length
            ? klass.outputs
            : existingKlass.outputs;

        // When merging non-operation classes (types used by queries)
        let selectedOutputs = existingKlass.selectedOutputs;
        let isCompleteSchema = existingKlass.isCompleteSchema || klass.isCompleteSchema;
        let hasMultipleQueries = existingKlass.hasMultipleQueries || false;

        if (!existingKlass.operation && !klass.operation) {
          // Case 1: Merging two partial selections (multiple queries)
          if (!existingKlass.isCompleteSchema && !klass.isCompleteSchema) {
            selectedOutputs = this.mergeSelectedOutputs(
              existingKlass.selectedOutputs || existingKlass.outputs,
              klass.selectedOutputs || klass.outputs
            );
            isCompleteSchema = false;
            hasMultipleQueries = true;
          }
          // Case 2: Merging partial with complete (second+ query)
          else if (existingKlass.isCompleteSchema && !klass.isCompleteSchema) {
            // Second+ query merging with complete
            // Merge with what the first query selected (stored in selectedOutputs)
            selectedOutputs = this.mergeSelectedOutputs(
              existingKlass.selectedOutputs,
              klass.outputs
            );
            hasMultipleQueries = true;
          }
          // Case 3: Merging complete with partial (first query + schema)
          else if (!existingKlass.isCompleteSchema && klass.isCompleteSchema) {
            // First query merging with complete - store what was selected
            selectedOutputs = existingKlass.outputs;
            hasMultipleQueries = false;
          }
          // Case 4: Merging two complete classes (from different queries)
          else if (existingKlass.isCompleteSchema && klass.isCompleteSchema) {
            // Both are complete - check if they have different selections
            if (existingKlass.selectedOutputs && klass.selectedOutputs) {
              selectedOutputs = this.mergeSelectedOutputs(
                existingKlass.selectedOutputs,
                klass.selectedOutputs
              );
              hasMultipleQueries = true;
            } else if (existingKlass.selectedOutputs) {
              selectedOutputs = existingKlass.selectedOutputs;
              hasMultipleQueries = existingKlass.hasMultipleQueries || false;
            } else if (klass.selectedOutputs) {
              selectedOutputs = klass.selectedOutputs;
              hasMultipleQueries = klass.hasMultipleQueries || false;
            }
          }
        }

        this.classes.set(klassId, {
          ...existingKlass,
          inputs: mergedInputs,
          outputs: mergedOutputs,
          selectedOutputs,
          isCompleteSchema,
          hasMultipleQueries,
          id: klassId,
        });
        return this;
      }
      throw new Error(`Conflicting classes with the same name (${klass.name}) but different types`);
    }
    this.classes.set(klassId, { ...klass, id: klassId });
    return this;
  }

  private mergeSelectedOutputs(
    existing: FieldValue[] | undefined,
    incoming: FieldValue[] | undefined
  ): FieldValue[] | undefined {
    if (!existing) return incoming;
    if (!incoming) return existing;

    // Union the fields by name
    const fieldMap = new Map<string, FieldValue>();
    for (const field of existing) {
      fieldMap.set(field.name, field);
    }
    for (const field of incoming) {
      if (!fieldMap.has(field.name)) {
        fieldMap.set(field.name, field);
      }
    }
    return Array.from(fieldMap.values());
  }

  addUnion(union: UnionObject): this {
    if (this.unions.has(union.name)) {
      throw new Error(`Duplicate unions with the same name (${union.name})`);
    }
    this.unions.set(union.name, union);
    return this;
  }

  merge(otherParseResult: ParseResult): this {
    for (const klass of otherParseResult.classes.values()) {
      this.addClass(klass);
    }
    for (const union of otherParseResult.unions.values()) {
      this.addUnion(union);
    }
    return this;
  }
}

const parseScalarType = (fieldType: GraphQLScalarType, nullable: boolean): SimpleGQLType => {
  switch (fieldType.name) {
    case 'String':
      return { kind: GQLKind.String, nullable };
    case 'Int':
      return { kind: GQLKind.Int, nullable };
    default:
      throw new Error(`Unknown scalar type: ${fieldType.name}`);
  }
};

const parseOutputType = (fieldType: GraphQLOutputType, nullable: boolean): GQLType => {
  if (isScalarType(fieldType)) {
    return parseScalarType(fieldType, nullable);
  }
  if (isObjectType(fieldType)) {
    return {
      id: `${fieldType.name}:output`,
      name: fieldType.name,
      kind: GQLKind.Object,
      nullable,
    };
  }
  throw new Error(`Unable to parse type: ${fieldType.toString()}`);
};

const parseInputType = (fieldType: TypeNode, nullable: boolean): GQLType => {
  if (fieldType.kind === Kind.NAMED_TYPE) {
    switch (fieldType.name.value) {
      case 'String':
        return { kind: GQLKind.String, nullable };
      case 'Int':
        return { kind: GQLKind.Int, nullable };
      case 'Boolean':
        return { kind: GQLKind.Boolean, nullable };
      case 'Float':
        return { kind: GQLKind.Float, nullable };
      default:
        throw new Error(`Unknown named type: ${fieldType.name.value}`);
    }
  }
  throw new Error(`Unsupported input type: ${fieldType.kind} - ${JSON.stringify(fieldType)}`);
};

const parseSelection = (
  node: SelectionNode,
  schemaType: GraphQLObjectType
): { fieldValue: FieldValue; result: ParseResult } => {
  if (node.kind !== Kind.FIELD) {
    throw new Error(`Unsupported selection node type: ${node.kind}`);
  }
  const fieldName = node.name.value;
  let fieldType = schemaType.getFields()[fieldName]?.type;
  if (!fieldType) {
    throw new Error(`Unable to find field type for: ${fieldName} in ${schemaType}`);
  }
  let nullable = true;
  if (isNonNullType(fieldType)) {
    fieldType = fieldType.ofType;
    nullable = false;
  }

  if (node.selectionSet?.selections) {
    if (!isObjectType(fieldType)) {
      throw new Error(`Found a selection set on a non-object type. Kind: ${fieldType}`);
    }
    const typeName = fieldType.name;
    const result = parseSelectionSet(typeName, node.selectionSet.selections, fieldType);
    const klass = result.classes.get(`${typeName}:output`);
    const fieldValue: FieldValue = {
      name: fieldName,
      type: {
        id: `${typeName}:output`,
        name: typeName,
        kind: GQLKind.Object,
        nullable,
      },
      selectedFields: klass?.selectedOutputs?.map((f) => f.name) || [],
    };
    return {
      fieldValue,
      result,
    };
  }

  const value: FieldValue = {
    name: fieldName,
    type: parseOutputType(fieldType, nullable),
  };
  return {
    fieldValue: value,
    result: new ParseResult(),
  };
};

const parseCompleteSchemaType = (schemaType: GraphQLObjectType): ParseResult => {
  const fields = schemaType.getFields();
  const result = new ParseResult();

  const outputs: FieldValue[] = [];

  for (const [fieldName, field] of Object.entries(fields)) {
    let fieldType = field.type;
    let nullable = true;
    if (isNonNullType(fieldType)) {
      fieldType = fieldType.ofType;
      nullable = false;
    }

    if (isObjectType(fieldType)) {
      // For object types, we still need to recurse to generate their definitions
      outputs.push({
        name: fieldName,
        type: {
          id: `${fieldType.name}:output`,
          name: fieldType.name,
          kind: GQLKind.Object,
          nullable,
        },
      });
      result.merge(parseCompleteSchemaType(fieldType));
    } else {
      outputs.push({
        name: fieldName,
        type: parseOutputType(fieldType, nullable),
      });
    }
  }

  result.addClass({
    name: schemaType.name,
    inputs: [],
    outputs,
    isInput: false,
    isCompleteSchema: true,
  });

  return result;
};

const parseSelectionSet = (
  name: string,
  selections: readonly SelectionNode[],
  schemaType: GraphQLObjectType
): ParseResult => {
  const { outputs, result } = selections.reduce<{
    outputs: FieldValue[];
    result: ParseResult;
  }>(
    ({ outputs, result }, selection) => {
      const parsed = parseSelection(selection, schemaType);
      return {
        outputs: [...outputs, parsed.fieldValue],
        result: result.merge(parsed.result),
      };
    },
    { outputs: [], result: new ParseResult() }
  );

  // Generate complete type from schema for type definitions and mock fields
  const completeTypeResult = parseCompleteSchemaType(schemaType);

  result.addClass({
    name,
    inputs: [],
    outputs,
    // Don't set selectedOutputs here - only set it when merging multiple queries
    isInput: false,
  });
  return result.merge(completeTypeResult);
};

// const parseInputObject = ()

const isNamedTypeNode = (typeNode: NamedTypeNode | ListTypeNode): typeNode is NamedTypeNode => {
  return typeNode.kind === Kind.NAMED_TYPE;
};

const parseInputValueField = (
  field: InputValueDefinitionNode
): { field: FieldValue; result: ParseResult } => {
  let fieldType = field.type;
  let nullable = true;
  if (field.type.kind === Kind.NON_NULL_TYPE) {
    nullable = false;
    fieldType = field.type.type;
  }

  return {
    field: {
      name: field.name.value,
      type: parseInputType(fieldType, nullable),
    },
    result: new ParseResult(),
  };
};

const parseVariableDefinition = (
  variable: VariableDefinitionNode,
  schema: GraphQLSchema
): { input: FieldValue; result: ParseResult } => {
  if (!variable.type) {
    throw new Error(`Variable ${variable.variable.name.value} has no type`);
  }
  const name = variable.variable.name.value;

  let nullable = true;
  let variableType: NamedTypeNode | ListTypeNode;
  if (variable.type.kind === Kind.NON_NULL_TYPE) {
    nullable = false;
    variableType = variable.type.type;
  } else {
    variableType = variable.type;
  }

  if (!isNamedTypeNode(variableType)) {
    throw new Error(`Unsupported variable type: ${variableType}`);
  }

  const variableName = variableType.name.value;
  const graphQLTypeName = variableType.name.value;
  const graphQLType = schema.getType(graphQLTypeName);
  if (!graphQLType) {
    throw new Error(`Unable to find GraphQL type for: ${graphQLTypeName}`);
  }
  const astNode = graphQLType.astNode;
  if (!astNode || astNode.kind !== Kind.INPUT_OBJECT_TYPE_DEFINITION) {
    throw new Error(`GraphQL type ${graphQLTypeName} is not an input object type`);
  }

  const result = new ParseResult();
  const { inputs, result: inputResult } = (astNode.fields ?? []).reduce(
    (result, inputField): { inputs: FieldValue[]; result: ParseResult } => {
      const parsed = parseInputValueField(inputField);
      return {
        inputs: [...result.inputs, parsed.field],
        result: result.result.merge(parsed.result),
      };
    },
    { inputs: [] as FieldValue[], result }
  );

  inputResult.addClass({
    name: graphQLTypeName,
    inputs,
    outputs: [],
    isInput: true,
  });

  const input: FieldValue = {
    name,
    type: {
      id: `${variableName}:input`,
      name: variableName,
      kind: GQLKind.Object,
      nullable,
    },
  };
  return {
    input,
    result: inputResult,
  };
};

const parseOperation = (operation: OperationDefinitionNode, schema: GraphQLSchema): ParseResult => {
  if (!operation.name) {
    throw new Error('Operation has no name');
  }

  const schemaType =
    operation.operation === OperationTypeNode.QUERY
      ? schema.getQueryType()
      : schema.getMutationType();
  if (!schemaType) {
    throw new Error(`Unable to find schema type: ${operation.operation}`);
  }
  const name = operation.name.value;
  const selections = operation.selectionSet.selections;
  const { outputs, result } = selections.reduce<{
    outputs: FieldValue[];
    result: ParseResult;
  }>(
    ({ outputs, result }, selection) => {
      const parsed = parseSelection(selection, schemaType);
      return {
        outputs: [...outputs, parsed.fieldValue],
        result: result.merge(parsed.result),
      };
    },
    { outputs: [], result: new ParseResult() }
  );

  const variableDefinitions = operation.variableDefinitions ?? [];
  const { inputs, result: variableResult } = variableDefinitions.reduce(
    ({ inputs, result }, variable): { inputs: FieldValue[]; result: ParseResult } => {
      const parsed = parseVariableDefinition(variable, schema);
      return {
        inputs: [...inputs, parsed.input],
        result: result.merge(parsed.result),
      };
    },
    { inputs: [] as FieldValue[], result }
  );

  variableResult.addClass({
    name,
    inputs,
    outputs,
    isInput: true,
    operation: operation.operation === OperationTypeNode.QUERY ? 'Query' : 'Mutation',
  });
  return variableResult;
};

const parse = (schema: GraphQLSchema, documents: Types.DocumentFile[]): ParseResult => {
  const result = documents.reduce<ParseResult>((result, { document }) => {
    if (!document) {
      throw new Error('Missing document');
    }
    const operations = document.definitions.filter(
      (d): d is OperationDefinitionNode => d.kind === Kind.OPERATION_DEFINITION
    );
    return operations.reduce<ParseResult>((result, operation) => {
      return result.merge(parseOperation(operation, schema));
    }, result);
  }, new ParseResult());
  return result;
};

export default parse;
