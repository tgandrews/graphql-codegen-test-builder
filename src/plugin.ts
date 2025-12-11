import { PluginFunction, Types } from "@graphql-codegen/plugin-helpers";
import parse from "./parser";
import render from './renderer'
import optimiser from "./optimiser";
import { log } from "./logger";

type Config = {
  option: string;
}

const graphqlCodegenBuilderPlugin: PluginFunction<Partial<Config>, Types.ComplexPluginOutput> = (schema, documents) => {
  const parseResult = parse(schema, documents)
  log('parse result', parseResult)
  const optimisedResult = optimiser(parseResult)
  log('optimised result', optimisedResult)
  const renderedOutput = render(optimisedResult)
  return { content: renderedOutput }
}

export default graphqlCodegenBuilderPlugin;