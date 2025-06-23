import { Types } from "@graphql-codegen/plugin-helpers";
import { GraphQLObjectType, GraphQLOutputType, GraphQLScalarType, GraphQLSchema, isNonNullType, isObjectType, isScalarType, Kind, OperationDefinitionNode, OperationTypeNode, SelectionNode } from "graphql";
enum GQLKind {
  String = 'string',
  Boolean = 'boolean',
  Int = 'int',
  Float = 'float',
  Union = 'union',
  Enum = 'enum',
  Object = 'object'
}
type SimpleGQLType = { kind: GQLKind.Boolean | GQLKind.Float | GQLKind.Int | GQLKind.String }
type UnionGQLType = { kind: GQLKind.Union, name: string }
type EnumGQLType = { kind: GQLKind.Enum, name: string }
type ObjectGQLType = { kind: GQLKind.Object, name: string }
type GQLType = SimpleGQLType | UnionGQLType | EnumGQLType | ObjectGQLType
type FieldValue = { nullable: boolean; gqlType: GQLType; name: string; }

type ClassObject = {
  name: string;
  inputs: FieldValue[];
  outputs: FieldValue[];
  isInput: boolean;
  operation?: 'Query' | 'Mutation';
}
type UnionObject = {
  name: string;
  subTypes: string[];
}

class ParseResult {
  classes: Map<string, ClassObject> = new Map()
  unions: Map<string, UnionObject> = new Map()

  addClass(klass: ClassObject): this {
    const existingKlass = this.classes.get(klass.name)
    if (existingKlass && existingKlass.isInput === klass.isInput && existingKlass.operation === klass.operation) {
      throw new Error(`Duplicate classes with the same name (${klass.name}) and type (${klass.isInput ? 'input' : 'output'})`)
    }
    this.classes.set(klass.name, klass)
    return this
  }

  addUnion(union: UnionObject): this {
    if (this.unions.has(union.name)) {
      throw new Error(`Duplicate unions with the same name (${union.name})`)
    }
    this.unions.set(union.name, union)
    return this
  }

  merge(otherParseResult: ParseResult): this {
    for (const klass of otherParseResult.classes.values()) {
      this.addClass(klass)
    }
    for (const union of otherParseResult.unions.values()) {
      this.addUnion(union)
    }
    return this
  }
}

const parseScalarType = (fieldType: GraphQLScalarType): SimpleGQLType => {
  switch (fieldType.name) {
    case 'String':
      return { kind: GQLKind.String }
    default:
      throw new Error(`Unknown scalar type: ${fieldType.name}`)
  } 
}

const parseType = (fieldType: GraphQLOutputType): GQLType => {
  if (isScalarType(fieldType)) {
    return parseScalarType(fieldType)
  }
  throw new Error(`Unable to parse type: ${fieldType.toString()}`)
}


const parseSelection = (node: SelectionNode, schemaType: GraphQLObjectType): { fieldValue: FieldValue, result: ParseResult } => {
  if (node.kind !== Kind.FIELD) {
    throw new Error(`Unsupported selection node type: ${node.kind}`)
  }
  const fieldName = node.name.value
  let fieldType = schemaType.getFields()[fieldName]?.type
  if (!fieldType) {
    throw new Error(`Unable to find field type for: ${fieldName} in ${schemaType}`)
  }
  let nullable = true
  if (isNonNullType(fieldType)) {
    fieldType = fieldType.ofType
    nullable = false
  }

  if (node.selectionSet?.selections) {
    if (!isObjectType(fieldType)) {
      throw new Error(`Found a selection set on a non-object type. Kind: ${fieldType}`)
    }
    const typeName = fieldType.name
    const fieldValue: FieldValue = {
      name: fieldName,
      gqlType: {
        name: typeName,
        kind: GQLKind.Object,
      },
      nullable
    }
    const result = parseSelectionSet(typeName, node.selectionSet.selections, fieldType)
    return {
      fieldValue: fieldValue,
      result
    }
  }

  const value: FieldValue = {
    name: fieldName,
    gqlType: parseType(fieldType),
    nullable,
  }
  return {
    fieldValue: value,
    result: new ParseResult()
  }
}

const parseSelectionSet = (name: string, selections: readonly SelectionNode[], schemaType: GraphQLObjectType): ParseResult => {
  const { outputs, result } = selections.reduce<{ outputs: FieldValue[], result: ParseResult }>(({ outputs, result },  selection) => {
    const parsed = parseSelection(selection, schemaType)
    return {
      outputs: [...outputs, parsed.fieldValue],
      result: result.merge(parsed.result)
    }
  }, { outputs: [], result: new ParseResult() })

  const klass: ClassObject = {
    name,
    inputs: [],
    outputs,
    isInput: true
  }
  result.addClass(klass)
  return result
}


const parseOperation = (operation: OperationDefinitionNode, schema: GraphQLSchema): ParseResult => {
  if (!operation.name) {
    throw new Error('Operation has no name')
  }

  const schemaType = operation.operation === OperationTypeNode.QUERY ? schema.getQueryType() : schema.getMutationType()
  if (!schemaType) {
    throw new Error(`Unable to find schema type: ${operation.operation}`)
  }
  const name = operation.name.value
  const selections = operation.selectionSet.selections
  const { outputs, result } = selections.reduce<{ outputs: FieldValue[], result: ParseResult }>(({ outputs, result },  selection) => {
    const parsed = parseSelection(selection, schemaType)
    return {
      outputs: [...outputs, parsed.fieldValue],
      result: result.merge(parsed.result)
    }
  }, { outputs: [], result: new ParseResult() })

  const klass: ClassObject = {
    name,
    inputs: [],
    outputs,
    isInput: true,
    operation: operation.operation === OperationTypeNode.QUERY ? "Query" : "Mutation"
  }
  result.addClass(klass)
  return result

}

const parse = (schema: GraphQLSchema, documents: Types.DocumentFile[]): ParseResult => {
  const result = documents.reduce<ParseResult>((result, { document }) => {
    if (!document) {
      throw new Error('Missing document')
    }
    const operations = document.definitions.filter((d): d is OperationDefinitionNode => d.kind === Kind.OPERATION_DEFINITION)
    return operations.reduce<ParseResult>((result, operation) => {
      return result.merge(parseOperation(operation, schema))
    }, result)
  }, new ParseResult())
  return result;
}

export default parse