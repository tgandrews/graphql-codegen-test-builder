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
import { GQLKind, GQLType, FieldValue, SimpleGQLType } from './types';
import { ParseResult } from './ParseResult';

function parseScalarType(fieldType: GraphQLScalarType, nullable: boolean): SimpleGQLType {
  switch (fieldType.name) {
    case 'String':
      return { kind: GQLKind.String, nullable };
    case 'Int':
      return { kind: GQLKind.Int, nullable };
    default:
      throw new Error(`Unknown scalar type: ${fieldType.name}`);
  }
}

function parseOutputType(fieldType: GraphQLOutputType, nullable: boolean): GQLType {
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
}

function parseInputType(fieldType: TypeNode, nullable: boolean): GQLType {
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
}

function parseCompleteSchemaType(schemaType: GraphQLObjectType): ParseResult {
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
}

function parseSelection(
  node: SelectionNode,
  schemaType: GraphQLObjectType
): { fieldValue: FieldValue; result: ParseResult } {
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
      selectedFields: (klass?.selectedOutputs ?? klass?.outputs)?.map((f) => f.name) ?? [],
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
}

function parseSelectionSet(
  name: string,
  selections: readonly SelectionNode[],
  schemaType: GraphQLObjectType
): ParseResult {
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
}

function isNamedTypeNode(typeNode: NamedTypeNode | ListTypeNode): typeNode is NamedTypeNode {
  return typeNode.kind === Kind.NAMED_TYPE;
}

function parseInputValueField(field: InputValueDefinitionNode): {
  field: FieldValue;
  result: ParseResult;
} {
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
}

function parseVariableDefinition(
  variable: VariableDefinitionNode,
  schema: GraphQLSchema
): { input: FieldValue; result: ParseResult } {
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
}

export function parseOperation(
  operation: OperationDefinitionNode,
  schema: GraphQLSchema
): ParseResult {
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
}
