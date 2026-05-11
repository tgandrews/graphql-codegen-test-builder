import { PluginFunction, Types } from '@graphql-codegen/plugin-helpers';
import parse from './parser';
import render from './renderer';
import { transform } from './transformer';
import { log } from './logger';
import { Config } from './types';

const graphqlCodegenBuilderPlugin: PluginFunction<Config, Types.ComplexPluginOutput> = (
  schema,
  documents,
  config
) => {
  const parsed = parse(schema, documents);
  log('parse result', parsed);
  const transformed = transform(parsed, config);
  log('transform result', transformed);
  const renderedOutput = render(transformed);
  return { content: renderedOutput };
};

export default graphqlCodegenBuilderPlugin;
