import { PluginFunction, Types } from "@graphql-codegen/plugin-helpers";

type Config = {
  option: string;
}

const graphqlCodegenBuilderPlugin: PluginFunction<Partial<Config>, Types.ComplexPluginOutput> = (schema, documents, config) => {
  return {
    content: ''
  }
}

export default graphqlCodegenBuilderPlugin;