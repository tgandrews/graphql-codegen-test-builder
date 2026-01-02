import { PluginFunction, Types } from '@graphql-codegen/plugin-helpers';
import parse from './parser';
import render from './renderer';
import optimiser from './optimiser';
import { log } from './logger';
import { Config } from './types';

const graphqlCodegenBuilderPlugin: PluginFunction<Config, Types.ComplexPluginOutput> = (
  schema,
  documents,
  config
) => {
  const parseResult = parse(schema, documents, config);
  log('parse result', parseResult);
  const optimisedResult = optimiser(parseResult);
  log('optimised result', optimisedResult);
  const renderedOutput = render(optimisedResult);
  return { content: renderedOutput };
};

export default graphqlCodegenBuilderPlugin;
