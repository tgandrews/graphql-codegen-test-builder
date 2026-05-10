# Context

## Domain Language

- **Operation builder**: A generated builder class for a GraphQL query or mutation. It exposes `forX` setters for variables, `havingX` setters for response fields, error mode setters, and `build()`.
- **Fragment builder**: A generated builder class for a named GraphQL fragment. It exposes `havingX` setters for fragment fields and `build()`.
- **Generated mock type**: A TypeScript type alias emitted for an inline generated input or output shape.
- **Selection**: The fields selected from a GraphQL object by an operation or fragment.
- **Projection**: The operation-specific subset of a selected GraphQL object used when shared object types are selected differently.
- **Render plan**: The generated-code decision model built from parsed GraphQL facts and plugin config. It decides whether a parsed class is emitted as a builder, an inline generated mock type, or a user-defined import.
