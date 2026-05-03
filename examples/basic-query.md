# Basic query

## Goal

Generate a query builder for a simple operation with scalar output fields.

## Schema

```graphql
type Query {
  me: User!
}

type User {
  name: String!
  age: Int
}
```

## Operation

```graphql
query GetUser {
  me {
    name
    age
  }
}
```

## Representative generated output

```ts
type MockUserType = {
  name: string;
  age: number | null;
};

class MockGetUserQueryBuilder {
  private me: MockUserType = {
    name: '',
    age: null,
  };

  havingMe(me: MockUserType): this {
    this.me = me;
    return this;
  }

  build(): MockedResponse<GetUserQueryResponse, GetUserQueryVariables> {
    return {
      request: {
        query: GetUserQueryDocument,
      },
      result: {
        data: {
          __typename: 'Query',
          me: {
            __typename: 'User',
            name: this.me.name,
            age: this.me.age,
          },
        },
      },
    } as const;
  }
}
```

## Why it looks this way

- `GetUser` is a query operation, so the builder class is named `MockGetUserQueryBuilder`.
- `User` is small, so it may be represented inline as `MockUserType`.
- `build()` returns a request/result shape keyed by the operation document and response data.

## Gotchas

- `MockedResponse` and `GetUserQueryDocument`/types must exist from companion codegen output.
