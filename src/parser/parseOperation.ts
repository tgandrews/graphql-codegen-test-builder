import {
  FragmentDefinitionNode,
  GraphQLInputObjectType,
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLType,
  isInputObjectType,
  isListType,
  isNonNullType,
  isObjectType,
  isScalarType,
  Kind,
  OperationDefinitionNode,
  OperationTypeNode,
  SelectionNode,
  TypeNode,
  VariableDefinitionNode,
} from 'graphql';
import {
  ParsedFieldSelection,
  ParsedFragment,
  ParsedOperation,
  ParsedScalarKind,
  ParsedSchemaType,
  ParsedSelection,
  ParsedSelectionSet,
  ParsedTypeRef,
  ParsedVariable,
} from './types';

export type FragmentDefinitionMap = Map<string, FragmentDefinitionNode>;

type ParseContext = {
  schema: GraphQLSchema;
  fragmentDefinitions: FragmentDefinitionMap;
  schemaTypes: Map<string, ParsedSchemaType>;
};

function parseScalarName(fieldType: GraphQLScalarType): ParsedScalarKind {
  switch (fieldType.name) {
    case 'String':
    case 'ID':
      return 'string';
    case 'Int':
      return 'int';
    case 'Boolean':
      return 'boolean';
    case 'Float':
      return 'float';
    default:
      throw new Error(`Unknown scalar type: ${fieldType.name}`);
  }
}

function unwrapType(fieldType: GraphQLType): {
  namedType: GraphQLType;
  nullable: boolean;
  isList: boolean;
} {
  let currentType = fieldType;
  let nullable = true;
  let isList = false;

  if (isNonNullType(currentType)) {
    nullable = false;
    currentType = currentType.ofType;
  }

  if (isListType(currentType)) {
    isList = true;
    currentType = currentType.ofType;
    if (isNonNullType(currentType)) {
      currentType = currentType.ofType;
    }
  }

  return { namedType: currentType, nullable, isList };
}

function parseOutputType(fieldType: GraphQLOutputType): ParsedTypeRef {
  const { namedType, nullable, isList } = unwrapType(fieldType);
  if (isScalarType(namedType)) {
    return {
      kind: 'scalar',
      name: parseScalarName(namedType),
      nullable,
      isList,
    };
  }

  if (isObjectType(namedType)) {
    return {
      kind: 'object',
      name: namedType.name,
      nullable,
      isList,
    };
  }

  throw new Error(`Unable to parse type: ${fieldType.toString()}`);
}

function parseInputType(typeNode: TypeNode): ParsedTypeRef {
  let currentType = typeNode;
  let nullable = true;
  let isList = false;

  if (currentType.kind === Kind.NON_NULL_TYPE) {
    nullable = false;
    currentType = currentType.type;
  }

  if (currentType.kind === Kind.LIST_TYPE) {
    isList = true;
    currentType = currentType.type;
    if (currentType.kind === Kind.NON_NULL_TYPE) {
      currentType = currentType.type;
    }
  }

  if (currentType.kind !== Kind.NAMED_TYPE) {
    throw new Error(`Unsupported input type: ${currentType.kind} - ${JSON.stringify(currentType)}`);
  }

  switch (currentType.name.value) {
    case 'String':
    case 'ID':
      return { kind: 'scalar', name: 'string', nullable, isList };
    case 'Int':
      return { kind: 'scalar', name: 'int', nullable, isList };
    case 'Boolean':
      return { kind: 'scalar', name: 'boolean', nullable, isList };
    case 'Float':
      return { kind: 'scalar', name: 'float', nullable, isList };
    default:
      return { kind: 'object', name: currentType.name.value, nullable, isList };
  }
}

function addObjectSchemaType(schemaType: GraphQLObjectType, context: ParseContext): void {
  if (context.schemaTypes.has(schemaType.name)) {
    return;
  }

  const fields = Object.entries(schemaType.getFields()).map<ParsedFieldSelection>(
    ([fieldName, field]) => {
      const type = parseOutputType(field.type);
      return {
        kind: 'field',
        name: fieldName,
        type,
      };
    }
  );

  context.schemaTypes.set(schemaType.name, {
    name: schemaType.name,
    kind: 'object',
    fields,
  });

  for (const field of fields) {
    if (field.type.kind !== 'object') {
      continue;
    }
    const nestedType = context.schema.getType(field.type.name);
    if (nestedType && isObjectType(nestedType)) {
      addObjectSchemaType(nestedType, context);
    }
  }
}

function addInputSchemaType(schemaType: GraphQLInputObjectType, context: ParseContext): void {
  if (context.schemaTypes.has(schemaType.name)) {
    return;
  }

  const fields = Object.entries(schemaType.getFields()).map<ParsedFieldSelection>(
    ([fieldName, field]) => {
      if (!field.astNode) {
        throw new Error(`Input field ${fieldName} is missing an AST node`);
      }
      const type = parseInputType(field.astNode.type);
      if (type.kind === 'object') {
        const nestedType = context.schema.getType(type.name);
        if (!nestedType || !isInputObjectType(nestedType)) {
          throw new Error(`GraphQL type ${type.name} is not an input object type`);
        }
        addInputSchemaType(nestedType, context);
      }
      return {
        kind: 'field',
        name: fieldName,
        type,
      };
    }
  );

  context.schemaTypes.set(schemaType.name, {
    name: schemaType.name,
    kind: 'input',
    fields,
  });
}

function parseSelectionSet(
  selections: readonly SelectionNode[],
  schemaType: GraphQLObjectType,
  context: ParseContext,
  activeFragmentPath: string[] = []
): ParsedSelectionSet {
  addObjectSchemaType(schemaType, context);

  return selections.map((selection) =>
    parseSelection(selection, schemaType, context, activeFragmentPath)
  );
}

function parseFieldSelection(
  node: SelectionNode,
  schemaType: GraphQLObjectType,
  context: ParseContext,
  activeFragmentPath: string[] = []
): ParsedFieldSelection {
  if (node.kind !== Kind.FIELD) {
    throw new Error(`Unsupported field selection node type: ${node.kind}`);
  }

  const fieldName = node.name.value;
  const schemaField = schemaType.getFields()[fieldName];
  if (!schemaField) {
    throw new Error(`Unable to find field type for: ${fieldName} in ${schemaType}`);
  }

  const type = parseOutputType(schemaField.type);
  if (node.selectionSet?.selections) {
    if (type.kind !== 'object') {
      throw new Error(`Found a selection set on a non-object type. Kind: ${schemaField.type}`);
    }
    const nestedType = context.schema.getType(type.name);
    if (!nestedType || !isObjectType(nestedType)) {
      throw new Error(`Unable to find object type for: ${type.name}`);
    }
    return {
      kind: 'field',
      name: fieldName,
      type,
      selectionSet: parseSelectionSet(
        node.selectionSet.selections,
        nestedType,
        context,
        activeFragmentPath
      ),
    };
  }

  return {
    kind: 'field',
    name: fieldName,
    type,
  };
}

function parseFragmentSelection(
  node: SelectionNode,
  schemaType: GraphQLObjectType,
  context: ParseContext,
  activeFragmentPath: string[] = []
): ParsedSelection {
  if (node.kind === Kind.INLINE_FRAGMENT) {
    throw new Error('Inline fragments are not supported yet');
  }
  if (node.kind !== Kind.FRAGMENT_SPREAD) {
    throw new Error(`Unsupported fragment selection node type: ${node.kind}`);
  }

  const fragmentDefinition = context.fragmentDefinitions.get(node.name.value);
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

  parseFragmentDefinition(fragmentDefinition, context, [...activeFragmentPath, node.name.value]);

  return {
    kind: 'fragment-spread',
    name: node.name.value,
  };
}

function parseSelection(
  node: SelectionNode,
  schemaType: GraphQLObjectType,
  context: ParseContext,
  activeFragmentPath: string[] = []
): ParsedSelection {
  switch (node.kind) {
    case Kind.FIELD:
      return parseFieldSelection(node, schemaType, context, activeFragmentPath);
    case Kind.FRAGMENT_SPREAD:
    case Kind.INLINE_FRAGMENT:
      return parseFragmentSelection(node, schemaType, context, activeFragmentPath);
  }
}

function parseVariableDefinition(
  variable: VariableDefinitionNode,
  context: ParseContext
): ParsedVariable {
  const name = variable.variable.name.value;
  const type = parseInputType(variable.type);

  if (type.kind !== 'object') {
    throw new Error(`GraphQL type ${type.name} is not an input object type`);
  }

  const graphQLType = context.schema.getType(type.name);
  if (!graphQLType || !isInputObjectType(graphQLType)) {
    throw new Error(`GraphQL type ${type.name} is not an input object type`);
  }

  addInputSchemaType(graphQLType, context);

  return {
    name,
    type,
  };
}

export function parseOperation(
  operation: OperationDefinitionNode,
  context: ParseContext
): ParsedOperation {
  if (!operation.name) {
    throw new Error('Operation has no name');
  }

  const schemaType =
    operation.operation === OperationTypeNode.QUERY
      ? context.schema.getQueryType()
      : operation.operation === OperationTypeNode.MUTATION
      ? context.schema.getMutationType()
      : undefined;

  if (!schemaType) {
    throw new Error(`Unable to find schema type: ${operation.operation}`);
  }

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

  return {
    name: operation.name.value,
    operationType,
    rootTypeName: operationType,
    variables: (operation.variableDefinitions ?? []).map((variable) =>
      parseVariableDefinition(variable, context)
    ),
    selectionSet: parseSelectionSet(operation.selectionSet.selections, schemaType, context),
  };
}

export function parseFragmentDefinition(
  fragment: FragmentDefinitionNode,
  context: ParseContext,
  activeFragmentPath: string[] = []
): ParsedFragment {
  const typeName = fragment.typeCondition.name.value;
  const schemaType = context.schema.getType(typeName);
  if (!schemaType || !isObjectType(schemaType)) {
    throw new Error(`Fragment "${fragment.name.value}" must target an object type`);
  }

  return {
    name: fragment.name.value,
    typeName,
    selectionSet: parseSelectionSet(
      fragment.selectionSet.selections,
      schemaType,
      context,
      activeFragmentPath
    ),
  };
}

export function createParseContext(
  schema: GraphQLSchema,
  fragmentDefinitions: FragmentDefinitionMap
): ParseContext {
  return {
    schema,
    fragmentDefinitions,
    schemaTypes: new Map(),
  };
}
