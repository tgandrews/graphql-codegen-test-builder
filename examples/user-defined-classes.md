# Using `userDefinedClasses`

## Goal

Replace generated builders/types for selected GraphQL types with project-specific classes/types.

## Config

```ts
config: {
  userDefinedClasses: {
    User: { path: '@/test/builders/UserBuilder', exportName: 'UserBuilder' },
    Address: { path: '@/test/builders/AddressBuilder' },
  }
}
```

## Representative generated output

```ts
import { UserBuilder } from '@/test/builders/UserBuilder';
import Address from '@/test/builders/AddressBuilder';

class MockGetUserQueryBuilder {
  private me: UserBuilder = new UserBuilder();

  havingMe(me: UserBuilder): this {
    this.me = me;
    return this;
  }

  // ...
}
```

## Why it looks this way

- With `exportName`, generated code uses named imports.
- Without `exportName`, generated code assumes a default export.
- User-defined types are used instead of emitting local class/type definitions for those GraphQL types.

## Gotchas

- Your user-defined types should be a compatible superset for fields that builders will read when assembling results.
