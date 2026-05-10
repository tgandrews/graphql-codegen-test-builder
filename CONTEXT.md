# Context

## Pipeline Structure

The plugin pipeline is **parser -> transformer -> renderer**.

- **Parser**: Reads the GraphQL AST/schema and emits the **Simplified AST**. It should only preserve GraphQL facts the plugin cares about. It must not make builder, optimiser, projection, import, or TypeScript rendering decisions.
- **Transformer**: Reads the **Simplified AST** plus plugin config and emits the **Transform result**. It owns generation decisions: which builders and generated mock types exist, which fields they contain, which classes are user-defined imports, which projections are needed, and how the **Optimiser** rewrites generated structures.
- **Renderer**: Reads only the **Transform result** and emits TypeScript source. It should be a dumb string-rendering layer and must not depend on parser types or make generation decisions.

## Domain Language

- **Operation builder**: A generated builder class for a GraphQL query or mutation. It exposes `forX` setters for variables, `havingX` setters for response fields, error mode setters, and `build()`.
- **Fragment builder**: A generated builder class for a named GraphQL fragment. It exposes `havingX` setters for fragment fields and `build()`.
- **Generated mock type**: A TypeScript type alias emitted for an inline generated input or output shape.
- **Selection**: The fields selected from a GraphQL object by an operation or fragment.
- **Projection**: The operation-specific subset of a selected GraphQL object used when shared object types are selected differently.
- **Simplified AST**: The parser output. It contains only the GraphQL facts needed by this plugin: schema types, operations, variables, fragments, selections, and type references.
- **Transform result**: The transformer output consumed by the renderer. It contains generated-code decisions such as builders, generated mock types, imports, projections, and optimised inline classes.
- **Optimiser**: A transformer pass that rewrites the transform result for generated-code ergonomics, including inlining generated output types and small input types.
