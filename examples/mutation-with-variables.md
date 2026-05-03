# Mutation with variables

## Goal

Generate a mutation builder with variable setters and output setters.

## Schema

```graphql
type Mutation {
  createUser(input: CreateUserInput!): User!
}

input CreateUserInput {
  name: String!
  age: Int
}

type User {
  name: String!
  age: Int
}
```

## Operation

```graphql
mutation CreateUser($input: CreateUserInput!) {
  createUser(input: $input) {
    name
  }
}
```

## Representative generated output

```ts
type MockCreateUserInputType = {
  name: string;
  age: number | null;
};

type MockUserType = {
  name: string;
  age: number | null;
};

class MockCreateUserMutationBuilder {
  private input: MockCreateUserInputType = {
    name: '',
    age: null,
  };

  private createUser: MockUserType = {
    name: '',
    age: null,
  };

  forInput(input: MockCreateUserInputType): this {
    this.input = input;
    return this;
  }

  havingCreateUser(createUser: MockUserType): this {
    this.createUser = createUser;
    return this;
  }

  build(): MockedResponse<CreateUserMutationResponse, CreateUserMutationVariables> {
    return {
      request: {
        query: CreateUserMutationDocument,
        variables: {
          input: this.input,
        },
      },
      result: {
        data: {
          __typename: 'Mutation',
          createUser: {
            __typename: 'User',
            name: this.createUser.name,
          },
        },
      },
    } as const;
  }
}
```

## Why it looks this way

- `forInput(...)` is generated from operation variables.
- `havingCreateUser(...)` sets the mutation response field.
- `build()` includes both `request.variables` and typed result data.

## Gotchas

- Variable inputs are expected to be input objects in current behavior.
