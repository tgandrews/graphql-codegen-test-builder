import { buildSchema, parse as parseGraphQL } from 'graphql';
import { Types } from '@graphql-codegen/plugin-helpers';
import parse from '../parser';
import { transform } from './transform';

const buildDocuments = (query: string): Types.DocumentFile[] => [
  {
    document: parseGraphQL(query),
    location: 'test.graphql',
  },
];

const runTransform = (query: string, schemaString: string, config = {}) => {
  const schema = buildSchema(schemaString);
  return transform(parse(schema, buildDocuments(query)), config);
};

describe('transformer', () => {
  it('builds operation builders, fragment builders, selection builders, and inline output types', () => {
    const schema = `
      type Query {
        me: User!
      }

      type User {
        name: String!
        email: String!
      }
    `;
    const query = `
      query GetUser {
        me {
          ...UserSummary
          email
        }
      }

      fragment UserSummary on User {
        name
      }
    `;

    const result = runTransform(query, schema);

    expect(result.fragments.map((fragment) => fragment.name)).toContain('UserSummary');
    expect(result.classes.find((klass) => klass.name === 'GetUser')?.operation).toBe('Query');
    expect(
      result.classes.find((klass) => klass.name === 'GetUserMeSelection')?.isSelectionBuilder
    ).toBe(true);
    expect(result.classes.find((klass) => klass.name === 'User')?.shouldInline).toBe(true);
  });

  it('applies user-defined class config and skips optimiser inlining for imports', () => {
    const schema = `
      type Query {
        users: [User!]!
      }

      type User {
        name: String!
      }
    `;
    const query = `
      query GetUsers {
        users {
          name
        }
      }
    `;

    const result = runTransform(query, schema, {
      userDefinedClasses: {
        User: { path: './userModel', exportName: 'UserModel' },
      },
    });

    const userClass = result.classes.find((klass) => klass.name === 'User');
    expect(userClass?.userDefined).toEqual({ path: './userModel', exportName: 'UserModel' });
    expect(userClass?.shouldInline).toBeUndefined();
    expect(result.imports).toEqual([
      { path: './userModel', exportName: 'UserModel', localName: 'UserModel' },
    ]);
  });

  it('keeps input builders when the inline threshold excludes them', () => {
    const schema = `
      type Mutation {
        createUser(input: CreateUserInput!): User!
      }

      input CreateUserInput {
        name: String!
        age: Int
        email: String
      }

      type User {
        name: String!
      }
    `;
    const query = `
      mutation CreateUser($input: CreateUserInput!) {
        createUser(input: $input) {
          name
        }
      }
    `;

    const result = runTransform(query, schema, { inlineFieldCountThreshold: 2 });

    expect(
      result.classes.find((klass) => klass.name === 'CreateUserInput')?.shouldInline
    ).toBeUndefined();
  });

  it('tracks shared object projections across multiple operations', () => {
    const schema = `
      type Query {
        me: User!
      }

      type User {
        id: ID!
        name: String!
        email: String!
      }
    `;
    const query = `
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
    `;

    const result = runTransform(query, schema);
    const userClass = result.classes.find((klass) => klass.name === 'User');
    const getName = result.classes.find((klass) => klass.name === 'GetUserName');

    expect(userClass?.selectedOutputs?.map((field) => field.name)).toEqual(['name', 'email']);
    expect(userClass?.hasMultipleQueries).toBe(true);
    expect(getName?.outputs[0].selectedFields).toEqual(['name']);
  });

  it('keeps generated classes uninlined when the optimiser is disabled', () => {
    const schema = `
      type Query {
        me: User!
      }

      type User {
        name: String!
      }
    `;
    const query = `
      query GetUser {
        me {
          name
        }
      }
    `;

    const result = runTransform(query, schema, { enableOptimiser: false });

    expect(result.classes.find((klass) => klass.name === 'User')?.shouldInline).toBeUndefined();
  });
});
