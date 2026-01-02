import { PluginFunction, Types } from '@graphql-codegen/plugin-helpers';
import parse from './parser';
import render from './renderer';
import optimiser from './optimiser';
import { log } from './logger';

export type Config = {
  // Allow for user defined classes to be injected into the generated code instead of generating
  // all classes from the schema. This assumes the user defined classes are a superset of the
  // generated ones. When no export name is provided, it is assumed to be a default export.
  userDefinedClasses?: Record<string, { path: string; exportName?: string }>;
};

const graphqlCodegenBuilderPlugin: PluginFunction<Partial<Config>, Types.ComplexPluginOutput> = (
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
