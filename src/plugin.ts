import { PluginFunction, Types } from "@graphql-codegen/plugin-helpers";
import parse from "./parser";
import render from './renderer'

type Config = {
  option: string;
}

const graphqlCodegenBuilderPlugin: PluginFunction<Partial<Config>, Types.ComplexPluginOutput> = (schema, documents) => {
  const parseResult = parse(schema, documents)
  console.dir(parseResult, { depth: 5 })
  return { content: render(parseResult) }
}

export default graphqlCodegenBuilderPlugin;