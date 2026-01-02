import { Types } from '@graphql-codegen/plugin-helpers';
import { GraphQLSchema, Kind, OperationDefinitionNode } from 'graphql';
import { ParseResult } from './ParseResult';
import { parseOperation } from './parseOperation';
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
  const result = documents.reduce<ParseResult>((result, { document }) => {
    if (!document) {
      throw new Error('Missing document');
    }
    const operations = document.definitions.filter(
      (d): d is OperationDefinitionNode => d.kind === Kind.OPERATION_DEFINITION
    );
    return operations.reduce<ParseResult>((result, operation) => {
      return result.merge(parseOperation(operation, schema, config));
    }, result);
  }, new ParseResult(config));
  return result;
};

export default parse;
