import { Types } from '@graphql-codegen/plugin-helpers';
import { FragmentDefinitionNode, GraphQLSchema, Kind, OperationDefinitionNode } from 'graphql';
import {
  createParseContext,
  FragmentDefinitionMap,
  parseFragmentDefinition,
  parseOperation,
} from './parseOperation';
import { ParsedDocument, ParsedOperation } from './types';

export * from './types';

const parse = (schema: GraphQLSchema, documents: Types.DocumentFile[]): ParsedDocument => {
  const fragmentDefinitions: FragmentDefinitionMap = new Map<string, FragmentDefinitionNode>();
  for (const { document } of documents) {
    if (!document) {
      throw new Error('Missing document');
    }
    for (const definition of document.definitions) {
      if (definition.kind === Kind.FRAGMENT_DEFINITION) {
        fragmentDefinitions.set(definition.name.value, definition);
      }
    }
  }

  const context = createParseContext(schema, fragmentDefinitions);
  const fragmentsByName = new Map<string, ReturnType<typeof parseFragmentDefinition>>();
  const operations: ParsedOperation[] = [];

  for (const { document } of documents) {
    if (!document) {
      throw new Error('Missing document');
    }

    const fragments = document.definitions.filter(
      (definition): definition is FragmentDefinitionNode =>
        definition.kind === Kind.FRAGMENT_DEFINITION
    );
    for (const fragment of fragments) {
      fragmentsByName.set(fragment.name.value, parseFragmentDefinition(fragment, context));
    }

    const operationDefinitions = document.definitions.filter(
      (definition): definition is OperationDefinitionNode =>
        definition.kind === Kind.OPERATION_DEFINITION
    );
    for (const operation of operationDefinitions) {
      operations.push(parseOperation(operation, context));
    }
  }

  return {
    schemaTypes: context.schemaTypes,
    operations,
    fragments: Array.from(fragmentsByName.values()),
  };
};

export default parse;
