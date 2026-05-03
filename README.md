# graphql-codegen-builder

## What it does
`graphql-codegen-builder` is a GraphQL Code Generator plugin that generates typed mock builders from your GraphQL operations for test usage. The generated code provides `forX(...)` setters for operation inputs, `havingX(...)` setters for response fields, and `build()` methods that return mock objects shaped for operation documents plus typed variables and responses.

## Test usage example
Generated builders are designed to produce `MockedResponse` objects for test setup. This example uses Apollo Client's `MockedProvider`.

```ts
import { MockedProvider, MockedResponse } from '@apollo/client/testing';
import { render, screen } from '@testing-library/react';
import { UserCard } from './UserCard';
import { MockGetUserQueryBuilder } from '../generated/graphql';

it('renders the user name from a mocked query response', async () => {
  const mock = new MockGetUserQueryBuilder()
    .forId('user-1')
    .havingUser({ name: 'Ada Lovelace' })
    .build();

  const mocks: MockedResponse[] = [mock];

  render(
    <MockedProvider mocks={mocks}>
      <UserCard id="user-1" />
    </MockedProvider>
  );

  expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
});
```

What this demonstrates:

- `forX(...)` sets operation variables.
- `havingX(...)` sets response payload fields.
- `.build()` returns a `MockedResponse`-shaped object ready for Apollo tests.

## Installation
```bash
npm i graphql-codegen-builder
```

This package is currently early-stage (`0.1.0`), so expect iteration and verify generated output in your test suite when upgrading.

## Compatibility and prerequisites
This plugin generates mock builders, but it expects several symbols to already exist in your project:

- `MockedResponse`
- `${OperationName}{Query|Mutation}Document`
- `${OperationName}{Query|Mutation}Response`
- `${OperationName}{Query|Mutation}Variables`

In practice, this means you should run this plugin alongside GraphQL Codegen plugins that generate typed documents and operation types. This plugin does not generate or import those symbols for you.

## GraphQL Codegen configuration
Example `codegen.ts`:

```ts
import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: './schema.graphql',
  documents: ['src/**/*.graphql'],
  generates: {
    'src/generated/graphql.ts': {
      plugins: [
        // Companion plugins that provide operation symbols/types used by the builders:
        'typescript',
        'typescript-operations',
        'typed-document-node',

        // This plugin:
        'graphql-codegen-builder',
      ],
      config: {
        userDefinedClasses: {
          // GraphQL type name -> import details
          User: { path: '@/test/builders/UserBuilder', exportName: 'UserBuilder' },
          Address: { path: '@/test/builders/AddressBuilder' },
        },
      },
    },
  },
};

export default config;
```

## Generated output deep dive
If you want to see the generated code anatomy behind the test usage, continue below.

Generated output is covered in detail in the scenario docs under [`examples/`](./examples/README.md):

- [Basic query](./examples/basic-query.md)
- [Mutation with variables](./examples/mutation-with-variables.md)
- [Multiple operations with shared types](./examples/multi-operation-shared-type.md)
- [Using `userDefinedClasses`](./examples/user-defined-classes.md)
- [Limitations: custom scalars and subscriptions](./examples/limitations-custom-scalars.md)

Naming conventions:

- Inline mock type aliases: `Mock${Type}Type`
- Operation builders: `Mock${Operation}{Query|Mutation}Builder`
- Input setters: `for${FieldName}(...)`
- Output setters: `having${FieldName}(...)`

For queries/mutations selecting different subsets of a shared type, the generated output may also include `Pick<...>` helper types to keep operation field selections accurate.

## userDefinedClasses configuration
Config shape:

```ts
type Config = {
  userDefinedClasses?: Record<string, { path: string; exportName?: string }>;
};
```

How to read it:

- Key: GraphQL type name to override (for example `User`).
- `path`: import path used in generated output.
- `exportName` (optional): named export to import from `path`.

Import behavior:

- If `exportName` is present, generated code uses a named import.
- If `exportName` is omitted, generated code assumes a default export named after the GraphQL type.

User-defined classes/types should be a compatible superset of what generated builders expect for those fields.

## Behavioral notes and guarantees
- The plugin default export is a GraphQL Codegen plugin function.
- Operation outputs are always generated as builder classes, not inlined type aliases.
- Small/simple nested types may be emitted as inline mock types instead of dedicated builder classes.
- When multiple operations select different fields from the same type, emitted helpers may narrow types for operation-specific selections.

## Limitations
- Supported operation kinds: `query`, `mutation` (no `subscription` support).
- Supported scalars: `String`, `ID`, `Int`, `Float`, `Boolean`.
- Unknown/custom scalars currently throw unless handled before this plugin’s type expectations.
- Variable parsing expects input object variable types; non-input-object variable patterns are not supported.
- List fields are parsed, but list-heavy schemas should be validated in your own suite to confirm output matches your intended mock ergonomics.

## Troubleshooting
`Cannot find name 'MockedResponse'`

- Cause: The generated file references `MockedResponse` but your file/module does not provide the type.
- Fix: Import `MockedResponse` from your GraphQL client testing package (for example Apollo testing utilities) in the file where generated mocks are compiled/used.

Missing `*Document`, `*Response`, or `*Variables` symbols

- Cause: Companion GraphQL Codegen output is missing or not in scope.
- Fix: Ensure your codegen config also runs plugins that emit operation documents and operation types, and that generated outputs are available in the same compilation unit.

`Unsupported operation type` or scalar parsing errors

- Cause: You are using unsupported operations/scalars for current plugin behavior.
- Fix: See [Limitations](#limitations), then adjust schema/operations or preprocess types before this plugin.

## Development
```bash
npm test
npm run lint
npm run typecheck
npm run format
```

## License
ISC
