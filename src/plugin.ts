import { PluginFunction, Types } from "@graphql-codegen/plugin-helpers";
import parse from "./parser";

type Config = {
  option: string;
}


const graphqlCodegenBuilderPlugin: PluginFunction<Partial<Config>, Types.ComplexPluginOutput> = (schema, documents, config) => {
  const parseResult = parse(schema, documents)
  console.dir(parseResult, { depth: 5 })

  return { content: '' }
}

export default graphqlCodegenBuilderPlugin;