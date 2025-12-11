import { PluginFunction, Types } from "@graphql-codegen/plugin-helpers";
import parse from "./parser";
import render from './renderer'
import optimiser from "./optimiser";

type Config = {
  option: string;
}

const graphqlCodegenBuilderPlugin: PluginFunction<Partial<Config>, Types.ComplexPluginOutput> = (schema, documents) => {
  const parseResult = parse(schema, documents)
  console.dir(parseResult, { depth: null, colors: true })
  const optimisedResult = optimiser(parseResult)
  console.dir(optimisedResult, { depth: null, colors: true })
  const renderedOutput = render(optimisedResult)
  return { content: renderedOutput }
}

export default graphqlCodegenBuilderPlugin;