# Error Scenarios

Configure operation builders for network errors or GraphQL/service errors, then call `build()`.

## Network error

```ts
const mock = new MockGetUserQueryBuilder()
  .forId('1')
  .returningNetworkError(new Error('timeout'))
  .build();
```

Produces a `MockedResponse` with:

- `request` (query + variables)
- top-level `error`

## Service/GraphQL error with partial data (default)

```ts
const mock = new MockGetUserQueryBuilder()
  .forId('1')
  .havingUser({ name: 'Bob' })
  .returningServiceError('Something broken')
  .build();
```

Produces a `MockedResponse` with:

- `request` (query + variables)
- `result.errors`
- `result.data` built from current `havingX(...)` state

## Service/GraphQL error without data

```ts
const mock = new MockGetUserQueryBuilder()
  .forId('1')
  .havingUser({ name: 'Bob' })
  .returningServiceError([{ message: 'Forbidden' }], { includeData: false })
  .build();
```

When `includeData: false`, `result.data` is omitted.
