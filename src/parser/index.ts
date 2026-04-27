import { Types } from '@graphql-codegen/plugin-helpers';
import { FragmentDefinitionNode, GraphQLSchema, Kind, OperationDefinitionNode } from 'graphql';
import { ParseResult } from './ParseResult';
import { parseFragmentDefinition, parseOperation } from './parseOperation';
import { Config } from '../types';

// Re-export types and classes
export * from './types';
export { ParseResult } from './ParseResult';

// Main parse function
const parse = (
  schema: GraphQLSchema,
  documents: Types.DocumentFile[],
  config: Config = {}
): ParseResult => {
  const fragmentDefinitions = new Map<string, FragmentDefinitionNode>();
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

  const result = documents.reduce<ParseResult>((result, { document }) => {
    if (!document) {
      throw new Error('Missing document');
    }
    const operations = document.definitions.filter(
      (d): d is OperationDefinitionNode => d.kind === Kind.OPERATION_DEFINITION
    );
    const fragments = document.definitions.filter(
      (d): d is FragmentDefinitionNode => d.kind === Kind.FRAGMENT_DEFINITION
    );

    const withFragments = fragments.reduce<ParseResult>((acc, fragment) => {
      return acc.merge(parseFragmentDefinition(fragment, schema, config, fragmentDefinitions));
    }, result);

    return operations.reduce<ParseResult>((acc, operation) => {
      return acc.merge(parseOperation(operation, schema, config, fragmentDefinitions));
    }, withFragments);
  }, new ParseResult(config));
  return result;
};

export default parse;
