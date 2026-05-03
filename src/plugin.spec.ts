import { buildSchema, parse } from 'graphql';
import graphqlBuilderPlugin from './plugin';

import { prettify } from './test/helpers';
import { Config } from './types';

const buildDocuments = (query: string) => {
  const ast = parse(query);
  return [
    {
      document: ast,
      location: 'test.graphql',
    },
  ];
};

const runPlugin = async (query: string, schemaString: string, config: Partial<Config> = {}) => {
  const schema = buildSchema(schemaString);
  const documents = buildDocuments(query);
  const result = await graphqlBuilderPlugin(schema, documents, config);
  return prettify(result.content);
};

const runPluginRaw = async (query: string, schemaString: string, config: Partial<Config> = {}) => {
  const schema = buildSchema(schemaString);
  const documents = buildDocuments(query);
  const result = await graphqlBuilderPlugin(schema, documents, config);
  return prettify(result.content);
};

describe('plugin', () => {
  describe('error mode builders', () => {
    it('should generate returningNetworkError with network error build mode', async () => {
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

      const result = await runPluginRaw(query, schema);
      expect(result).toContain(
        'returningNetworkError(error: Error = new Error("Network error")): this'
      );
      expect(result).toContain('this.responseMode = "networkError"');
      expect(result).toContain('...(this.responseMode === "networkError"');
    });
  });

  describe('query builders', () => {
    it('should generate a builder class for a query', async () => {
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
      const result = await runPlugin(query, schema);
      expect(result).toMatchSnapshot();
    });
  });

  describe('mutation builders', () => {
    it('should generate a builder class for a mutation', async () => {
      const schema = `
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
      `;
      const query = `
        mutation CreateUser($input: CreateUserInput!) {
          createUser(input: $input) {
            name
          }
        }
      `;
      const result = await runPlugin(query, schema);
      expect(result).toMatchSnapshot();
    });
  });

  describe('inline small types', () => {
    it('should inline small classes (<=3 properties)', async () => {
      const schema = `
        type Query {
          me: User!
        }

        type User {
          name: String!
          age: Int
          email: String
        }
      `;
      const query = `
        query GetUser {
          me {
            name
            age
            email
          }
        }
      `;
      const result = await runPlugin(query, schema);
      expect(result).toMatchSnapshot();
    });
  });

  describe('reused query selections', () => {
    it('should support reused queries selecting different fields', async () => {
      const schema = `
        type Query {
          me: User!
        }

        type User {
          name: String!
          age: Int!
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
      const result = await runPlugin(query, schema);
      expect(result).toMatchSnapshot();
    });
  });

  describe('built-in scalars', () => {
    it('should support all built-in scalars (String, Int, Boolean, Float, ID)', async () => {
      const schema = `
        type Query {
          me: User!
        }

        type Mutation {
          deleteUser(input: DeleteUserInput!): User!
        }

        input DeleteUserInput {
          id: ID!
          soft: Boolean
        }

        type User {
          id: ID!
          name: String!
          active: Boolean!
          score: Float!
          age: Int!
        }
      `;
      const query = `
        query GetUser {
          me {
            id
            name
            active
            score
            age
          }
        }

        mutation DeleteUser($input: DeleteUserInput!) {
          deleteUser(input: $input) {
            id
          }
        }
      `;
      const result = await runPlugin(query, schema);
      expect(result).toMatchSnapshot();
    });
  });

  describe('standalone fragment builders', () => {
    it('should generate standalone fragment builders', async () => {
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
        fragment UserSummary on User {
          name
          email
        }
      `;
      const result = await runPlugin(query, schema);
      expect(result).toMatchSnapshot();
    });
  });

  describe('fragment builder composition', () => {
    it('should allow query builders to compose fragment builders', async () => {
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
          }
        }

        fragment UserSummary on User {
          name
          email
        }
      `;
      const result = await runPlugin(query, schema);
      expect(result).toMatchSnapshot();
    });

    it('should compose multiple fragment spreads on the same field into a single builder', async () => {
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
            ...UserContact
          }
        }

        fragment UserSummary on User {
          name
        }

        fragment UserContact on User {
          email
        }
      `;
      const result = await runPlugin(query, schema);
      expect(result).toMatchSnapshot();
    });

    it('should compose direct selections with fragment spreads on the same field', async () => {
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
      const result = await runPlugin(query, schema);
      expect(result).toMatchSnapshot();
    });
  });

  describe('nullable fragment builder composition', () => {
    it('should allow nullable fragment-backed singular fields', async () => {
      const schema = `
        type Query {
          me: User
        }

        type User {
          name: String!
        }
      `;
      const query = `
        query GetUser {
          me {
            ...UserSummary
          }
        }

        fragment UserSummary on User {
          name
        }
      `;
      const result = await runPlugin(query, schema);
      expect(result).toMatchSnapshot();
    });
  });

  describe('fragment builder lists', () => {
    it('should allow list fields to accept fragment builder arrays', async () => {
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
            ...UserSummary
          }
        }

        fragment UserSummary on User {
          name
        }
      `;
      const result = await runPlugin(query, schema);
      expect(result).toMatchSnapshot();
    });
  });

  describe('user defined classes', () => {
    it('should support user defined classes with a named export', async () => {
      const schema = `
        type Query {
          users: [User!]!
        }

        type User {
          name: String!
          age: Int!
          deletedAt: String!
          otherField: String!
          # Unused field to ensure user defined class is used
          createdAt: String!
        }
      `;
      const query = `
        query GetUsers {
          users {
            name
            age
            deletedAt
            otherField
          }
        }
      `;
      const config: Partial<Config> = {
        userDefinedClasses: {
          User: { path: './userModel', exportName: 'MockUserType' },
        },
      };
      const result = await runPlugin(query, schema, config);
      expect(result).toMatchSnapshot();
    });

    it('should keep full defaults for singular user defined classes', async () => {
      const schema = `
        type Query {
          me: User!
        }

        type User {
          profile: Profile!
        }

        type Profile {
          bio: String!
          avatar: String!
        }
      `;
      const query = `
        query GetUser {
          me {
            profile {
              bio
            }
          }
        }
      `;
      const config: Partial<Config> = {
        userDefinedClasses: {
          Profile: { path: './profileModel', exportName: 'ProfileModel' },
        },
      };
      const result = await runPlugin(query, schema, config);
      expect(result).toMatchSnapshot();
    });
  });

  it('should inline input objects when the configured threshold allows it', async () => {
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
    const result = await runPlugin(query, schema, { inlineFieldCountThreshold: 4 });
    expect(result).toMatchSnapshot();
  });

  it('should inline three-field input objects by default', async () => {
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
    const result = await runPlugin(query, schema);
    expect(result).toMatchSnapshot();
  });

  it('should render input builders when the configured threshold does not inline them', async () => {
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
    const result = await runPlugin(query, schema, { inlineFieldCountThreshold: 2 });
    expect(result).toMatchSnapshot();
  });

  it('should disable optimisation when configured', async () => {
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
    const result = await runPlugin(query, schema, { enableOptimiser: false });
    expect(result).toMatchSnapshot();
  });
});
