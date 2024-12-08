import { CodegenPlugin } from "@graphql-codegen/plugin-helpers";

const structure: CodegenPlugin = {
  plugin: async (schema, documents, config, info) => {
    return '';
  }
}

export default structure;