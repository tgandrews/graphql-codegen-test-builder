# Network Error

Configure an operation builder for a network failure, then call `build()`.

```ts
const mock = new MockGetUserQueryBuilder()
  .forId('1')
  .returningNetworkError(new Error('timeout'))
  .build();
```

Produces a `MockedResponse` with:

- `request` (query + variables)
- top-level `error`
