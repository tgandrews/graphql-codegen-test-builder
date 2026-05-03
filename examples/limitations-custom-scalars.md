# Limitations: custom scalars and subscriptions

## Goal

Clarify current unsupported/limited behavior before integration.

## Current behavior

- Supported operation types: `query`, `mutation`
- Not supported: `subscription`
- Supported scalars: `String`, `ID`, `Int`, `Float`, `Boolean`
- Custom/unknown scalars currently error in parser handling

## Example unsupported operation

```graphql
subscription OnUserCreated {
  userCreated {
    id
  }
}
```

## Example unsupported scalar

```graphql
type User {
  id: ID!
  createdAt: DateTime!
}
```

## What to do

- Keep generated operations to query/mutation for now.
- Map or preprocess custom scalar usage in your broader codegen pipeline before relying on this plugin's outputs.
