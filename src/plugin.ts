import { PluginFunction, Types } from '@graphql-codegen/plugin-helpers';
import parse from './parser';
import render from './renderer';
import { buildRenderPlan } from './renderPlan';
import { log } from './logger';
import { Config } from './types';

const graphqlCodegenBuilderPlugin: PluginFunction<Config, Types.ComplexPluginOutput> = (
  schema,
  documents,
  config
) => {
  const parseResult = parse(schema, documents, config);
  log('parse result', parseResult);
  const renderPlan = buildRenderPlan(parseResult);
  log('render plan', renderPlan);
  const renderedOutput = render(parseResult, renderPlan);
  return { content: renderedOutput };
};

export default graphqlCodegenBuilderPlugin;
