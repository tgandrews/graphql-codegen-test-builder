import {
  FragmentDefinitionNode,
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLScalarType,
  GraphQLSchema,
  InputValueDefinitionNode,
  isListType,
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
import { mergeFieldValuesByName } from './merge';
import { Config } from '../types';
import { capitalise } from '../utils';

type FragmentDefinitionMap = Map<string, FragmentDefinitionNode>;

type SelectionParseResult = {
  outputs: FieldValue[];
  result: ParseResult;
  fragmentSpreads: string[];
};

function parseScalarType(fieldType: GraphQLScalarType, nullable: boolean): SimpleGQLType {
  switch (fieldType.name) {
    case 'String':
    case 'ID':
      return { kind: GQLKind.String, nullable };
    case 'Int':
      return { kind: GQLKind.Int, nullable };
    case 'Boolean':
      return { kind: GQLKind.Boolean, nullable };
    case 'Float':
      return { kind: GQLKind.Float, nullable };
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
      case 'ID':
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

function parseCompleteSchemaType(schemaType: GraphQLObjectType, config: Config): ParseResult {
  const fields = schemaType.getFields();
  const result = new ParseResult(config);

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
      result.merge(parseCompleteSchemaType(fieldType, config));
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

function parseSelectionSet(
  name: string,
  selections: readonly SelectionNode[],
  schemaType: GraphQLObjectType,
  config: Config,
  fragmentDefinitions: FragmentDefinitionMap,
  activeFragmentPath: string[] = [],
  selectionOwnerName = name
): SelectionParseResult {
  const parsedSelections = selections.reduce<SelectionParseResult>(
    (current, selection) => {
      const parsed = parseSelection(
        selection,
        schemaType,
        config,
        fragmentDefinitions,
        activeFragmentPath,
        selectionOwnerName
      );
      return {
        outputs: [...current.outputs, ...parsed.outputs],
        result: current.result.merge(parsed.result),
        fragmentSpreads: [...current.fragmentSpreads, ...parsed.fragmentSpreads],
      };
    },
    {
      outputs: [],
      result: new ParseResult(config),
      fragmentSpreads: [],
    }
  );

  const mergedOutputs = mergeFieldValuesByName(parsedSelections.outputs);
  const fragmentSpreads = Array.from(new Set(parsedSelections.fragmentSpreads));

  const completeTypeResult = parseCompleteSchemaType(schemaType, config);
  parsedSelections.result.addClass({
    name,
    inputs: [],
    outputs: mergedOutputs,
    isInput: false,
  });

  return {
    ...parsedSelections,
    outputs: mergedOutputs,
    fragmentSpreads,
    result: parsedSelections.result.merge(completeTypeResult),
  };
}

function parseFieldSelection(
  node: SelectionNode,
  schemaType: GraphQLObjectType,
  config: Config,
  fragmentDefinitions: FragmentDefinitionMap,
  activeFragmentPath: string[] = [],
  selectionOwnerName = schemaType.name
): SelectionParseResult {
  if (node.kind !== Kind.FIELD) {
    throw new Error(`Unsupported field selection node type: ${node.kind}`);
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

  // Handle list types by unwrapping to get the inner type
  let isList = false;
  if (isListType(fieldType)) {
    isList = true;
    let innerType = fieldType.ofType;
    // The inner type might also be non-null (e.g., [User!])
    if (isNonNullType(innerType)) {
      innerType = innerType.ofType;
    }
    fieldType = innerType;
  }

  if (node.selectionSet?.selections) {
    if (!isObjectType(fieldType)) {
      throw new Error(`Found a selection set on a non-object type. Kind: ${fieldType}`);
    }
    const typeName = fieldType.name;
    const result = parseSelectionSet(
      typeName,
      node.selectionSet.selections,
      fieldType,
      config,
      fragmentDefinitions,
      activeFragmentPath,
      `${selectionOwnerName}${capitalise(fieldName)}`
    );
    const hasDirectSelections = node.selectionSet.selections.some(
      (selection) => selection.kind === Kind.FIELD
    );
    const shouldComposeFragments =
      result.fragmentSpreads.length > 1 ||
      (result.fragmentSpreads.length > 0 && hasDirectSelections);
    const selectionClassName = shouldComposeFragments
      ? `${selectionOwnerName}${capitalise(fieldName)}Selection`
      : typeName;
    const klass = result.result.classes.get(`${typeName}:output`);
    if (shouldComposeFragments) {
      result.result.addClass({
        name: selectionClassName,
        inputs: [],
        outputs: result.outputs,
        isInput: false,
        isSelectionBuilder: true,
      });
    }
    const fieldValue: FieldValue = {
      name: fieldName,
      type: {
        id: `${selectionClassName}:output`,
        name: selectionClassName,
        kind: GQLKind.Object,
        nullable,
      },
      isList,
      schemaTypeName: typeName,
      selectedFields: (klass?.selectedOutputs ?? klass?.outputs)?.map((f) => f.name) ?? [],
      fragmentSpreads:
        !shouldComposeFragments && result.fragmentSpreads.length > 0
          ? result.fragmentSpreads
          : undefined,
    };
    return {
      outputs: [fieldValue],
      result: result.result,
      fragmentSpreads: [],
    };
  }

  const value: FieldValue = {
    name: fieldName,
    type: parseOutputType(fieldType, nullable),
    isList,
  };
  return {
    outputs: [value],
    result: new ParseResult(config),
    fragmentSpreads: [],
  };
}

function parseFragmentSelection(
  node: SelectionNode,
  schemaType: GraphQLObjectType,
  config: Config,
  fragmentDefinitions: FragmentDefinitionMap,
  activeFragmentPath: string[] = []
): SelectionParseResult {
  if (node.kind === Kind.INLINE_FRAGMENT) {
    throw new Error('Inline fragments are not supported yet');
  }
  if (node.kind !== Kind.FRAGMENT_SPREAD) {
    throw new Error(`Unsupported fragment selection node type: ${node.kind}`);
  }

  const fragmentDefinition = fragmentDefinitions.get(node.name.value);
  if (!fragmentDefinition) {
    throw new Error(`Unable to find fragment definition for: ${node.name.value}`);
  }
  if (activeFragmentPath.includes(node.name.value)) {
    throw new Error(
      `Circular fragment reference detected: ${[...activeFragmentPath, node.name.value].join(
        ' -> '
      )}`
    );
  }
  if (fragmentDefinition.typeCondition.name.value !== schemaType.name) {
    throw new Error(
      `Fragment "${node.name.value}" cannot be spread on "${schemaType.name}" because it targets "${fragmentDefinition.typeCondition.name.value}"`
    );
  }

  const fragmentResult = parseFragmentDefinition(
    fragmentDefinition,
    schemaType,
    config,
    fragmentDefinitions,
    activeFragmentPath
  );
  const fragment = fragmentResult.fragments.get(node.name.value);
  if (!fragment) {
    throw new Error(`Unable to parse fragment definition for: ${node.name.value}`);
  }

  return {
    outputs: fragment.outputs,
    result: fragmentResult,
    fragmentSpreads: [node.name.value],
  };
}

function parseSelection(
  node: SelectionNode,
  schemaType: GraphQLObjectType,
  config: Config,
  fragmentDefinitions: FragmentDefinitionMap,
  activeFragmentPath: string[] = [],
  selectionOwnerName = schemaType.name
): SelectionParseResult {
  switch (node.kind) {
    case Kind.FIELD:
      return parseFieldSelection(
        node,
        schemaType,
        config,
        fragmentDefinitions,
        activeFragmentPath,
        selectionOwnerName
      );
    case Kind.FRAGMENT_SPREAD:
    case Kind.INLINE_FRAGMENT:
      return parseFragmentSelection(
        node,
        schemaType,
        config,
        fragmentDefinitions,
        activeFragmentPath
      );
  }
}

function isNamedTypeNode(typeNode: NamedTypeNode | ListTypeNode): typeNode is NamedTypeNode {
  return typeNode.kind === Kind.NAMED_TYPE;
}

function parseInputValueField(
  field: InputValueDefinitionNode,
  config: Config
): {
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
    result: new ParseResult(config),
  };
}

function parseVariableDefinition(
  variable: VariableDefinitionNode,
  schema: GraphQLSchema,
  config: Config
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

  const result = new ParseResult(config);
  const { inputs, result: inputResult } = (astNode.fields ?? []).reduce(
    (result, inputField): { inputs: FieldValue[]; result: ParseResult } => {
      const parsed = parseInputValueField(inputField, config);
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
  schema: GraphQLSchema,
  config: Config,
  fragmentDefinitions: FragmentDefinitionMap
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
      const parsed = parseSelection(selection, schemaType, config, fragmentDefinitions, [], name);
      return {
        outputs: [...outputs, ...parsed.outputs],
        result: result.merge(parsed.result),
      };
    },
    { outputs: [], result: new ParseResult(config) }
  );
  const mergedOutputs = mergeFieldValuesByName(outputs);

  const variableDefinitions = operation.variableDefinitions ?? [];
  const { inputs, result: variableResult } = variableDefinitions.reduce(
    ({ inputs, result }, variable): { inputs: FieldValue[]; result: ParseResult } => {
      const parsed = parseVariableDefinition(variable, schema, config);
      return {
        inputs: [...inputs, parsed.input],
        result: result.merge(parsed.result),
      };
    },
    { inputs: [] as FieldValue[], result }
  );

  let operationType: 'Query' | 'Mutation';
  switch (operation.operation) {
    case OperationTypeNode.QUERY:
      operationType = 'Query';
      break;
    case OperationTypeNode.MUTATION:
      operationType = 'Mutation';
      break;
    default:
      throw new Error(`Unsupported operation type: "${operation.operation}"`);
  }

  variableResult.addClass({
    name,
    inputs,
    outputs: mergedOutputs,
    isInput: true,
    operation: operationType,
  });

  return variableResult;
}

export function parseFragmentDefinition(
  fragment: FragmentDefinitionNode,
  schemaOrType: GraphQLSchema | GraphQLObjectType,
  config: Config,
  fragmentDefinitions: FragmentDefinitionMap,
  activeFragmentPath: string[] = []
): ParseResult {
  const typeName = fragment.typeCondition.name.value;
  const schemaType =
    schemaOrType instanceof GraphQLSchema
      ? schemaOrType.getType(typeName)
      : schemaOrType.name === typeName
      ? schemaOrType
      : undefined;

  if (!schemaType || !isObjectType(schemaType)) {
    throw new Error(`Fragment "${fragment.name.value}" must target an object type`);
  }

  const currentFragmentPath = [...activeFragmentPath, fragment.name.value];
  const selectionResult = parseSelectionSet(
    typeName,
    fragment.selectionSet.selections,
    schemaType,
    config,
    fragmentDefinitions,
    currentFragmentPath,
    fragment.name.value
  );
  const klass = selectionResult.result.classes.get(`${typeName}:output`);
  if (!klass) {
    throw new Error(`Unable to find parsed selection output for fragment: ${fragment.name.value}`);
  }

  selectionResult.result.addFragment({
    name: fragment.name.value,
    typeName,
    outputs: klass.selectedOutputs ?? klass.outputs,
  });

  return selectionResult.result;
}
