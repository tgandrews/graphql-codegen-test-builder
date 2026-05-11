import { buildSchema, parse as parseGraphQL } from 'graphql';
import { Types } from '@graphql-codegen/plugin-helpers';
import parse from './index';

const buildDocuments = (query: string): Types.DocumentFile[] => [
  {
    document: parseGraphQL(query),
    location: 'test.graphql',
  },
];

const buildDocumentFiles = (queries: string[]): Types.DocumentFile[] =>
  queries.map((query, index) => ({
    document: parseGraphQL(query),
    location: `test-${index}.graphql`,
  }));

describe('parser simplified AST', () => {
  it('parses operations, variables, fragments, selections, and schema types', () => {
    const schema = buildSchema(`
      type Query {
        me: User!
      }

      input UserInput {
        id: ID!
      }

      type User {
        id: ID!
        name: String!
        profile: Profile
      }

      type Profile {
        bio: String
      }
    `);
    const documents = buildDocuments(`
      query GetUser($input: UserInput!) {
        me {
          id
          ...UserSummary
          profile {
            bio
          }
        }
      }

      fragment UserSummary on User {
        name
      }
    `);

    const result = parse(schema, documents);

    expect(result.operations).toHaveLength(1);
    expect(result.operations[0]).toMatchObject({
      name: 'GetUser',
      operationType: 'Query',
      rootTypeName: 'Query',
      variables: [
        {
          name: 'input',
          type: { kind: 'object', name: 'UserInput', nullable: false, isList: false },
        },
      ],
    });
    expect(result.operations[0].selectionSet).toEqual([
      {
        kind: 'field',
        name: 'me',
        type: { kind: 'object', name: 'User', nullable: false, isList: false },
        selectionSet: [
          {
            kind: 'field',
            name: 'id',
            type: { kind: 'scalar', name: 'string', nullable: false, isList: false },
          },
          { kind: 'fragment-spread', name: 'UserSummary' },
          {
            kind: 'field',
            name: 'profile',
            type: { kind: 'object', name: 'Profile', nullable: true, isList: false },
            selectionSet: [
              {
                kind: 'field',
                name: 'bio',
                type: { kind: 'scalar', name: 'string', nullable: true, isList: false },
              },
            ],
          },
        ],
      },
    ]);
    expect(result.fragments).toEqual([
      {
        name: 'UserSummary',
        typeName: 'User',
        selectionSet: [
          {
            kind: 'field',
            name: 'name',
            type: { kind: 'scalar', name: 'string', nullable: false, isList: false },
          },
        ],
      },
    ]);
    expect(result.schemaTypes.get('User')?.kind).toBe('object');
    expect(result.schemaTypes.get('Profile')?.kind).toBe('object');
    expect(result.schemaTypes.get('UserInput')?.kind).toBe('input');
  });

  it('rejects unsupported inline fragments', () => {
    const schema = buildSchema(`
      type Query { me: User! }
      type User { name: String! }
    `);
    const documents = buildDocuments(`
      query GetUser {
        me {
          ... on User {
            name
          }
        }
      }
    `);

    expect(() => parse(schema, documents)).toThrow('Inline fragments are not supported yet');
  });

  it('rejects conflicting duplicate fragment definitions across documents', () => {
    const schema = buildSchema(`
      type Query { me: User! }
      type User { name: String! email: String! }
    `);
    const documents = buildDocumentFiles([
      `
        query GetUser {
          me {
            ...UserSummary
          }
        }

        fragment UserSummary on User {
          name
        }
      `,
      `
        fragment UserSummary on User {
          email
        }
      `,
    ]);

    expect(() => parse(schema, documents)).toThrow(
      'Conflicting fragments with the same name (UserSummary)'
    );
  });
});
