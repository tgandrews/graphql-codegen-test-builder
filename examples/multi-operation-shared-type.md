# Multiple operations with shared types

## Goal
Show how output narrows when multiple operations select different fields from the same schema type.

## Schema
```graphql
type Query {
  me: User!
}

type User {
  name: String!
  email: String!
  age: Int!
}
```

## Operations
```graphql
query GetUserName {
  me {
    name
  }
}

query GetUserEmail {
  me {
    email
  }
}
```

## Representative generated output
```ts
type MockUserType = {
  name: string;
  email: string;
};

class MockGetUserNameQueryBuilder {
  havingMe(me: Pick<MockUserType, 'name'>): this {
    // ...
    return this;
  }
}

class MockGetUserEmailQueryBuilder {
  havingMe(me: Pick<MockUserType, 'email'>): this {
    // ...
    return this;
  }
}
```

## Why it looks this way
- The plugin tracks selected outputs across operations.
- Shared base mock types can be narrowed per operation using `Pick<...>` patterns.

## Gotchas
- When reviewing generated code, prefer operation-specific builders over assuming all fields are always present.
