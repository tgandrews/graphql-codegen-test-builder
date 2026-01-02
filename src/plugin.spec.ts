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

describe('plugin', () => {
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
    expect(result).toEqual(
      prettify(
        `type MockUserType = {
        name: string;
      }

      class MockGetUserQueryBuilder {
        private me: MockUserType = {
          name: '',
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
                }
              }
            }
          } as const
        }
      }`
      )
    );
  });

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
    expect(result).toEqual(
      prettify(
        `type MockUserType = {
        name: string;
        age: number | null;
      }

      type MockCreateUserInputType = {
        name: string;
        age: number | null;
      }

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
              }
            },
            result: {
              data: {
                __typename: 'Mutation',
                createUser: {
                  __typename: 'User',
                  name: this.createUser.name,
                }
              }
            }
          } as const
        }
      }`
      )
    );
  });

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
    expect(result).toEqual(
      prettify(
        `
      type MockUserType = {
        name: string;
        age: number | null;
        email: string | null;
      }

      class MockGetUserQueryBuilder {
        private me: MockUserType = {
          name: '',
          age: null,
          email: null,
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
                  email: this.me.email,
                }
              }
            }
          } as const
        }
      }`
      )
    );
  });

  it('should support re-used queries selecting different fields', async () => {
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
    expect(result).toEqual(
      prettify(
        `
      type MockUserType = {
        name: string;
        email: string;
      }

      type GetUserNameUserType = Pick<MockUserType, "name">;

      class MockGetUserNameQueryBuilder {
        private me: GetUserNameUserType = {
          name: '',
        };

        havingMe(me: GetUserNameUserType): this {
          this.me = me;
          return this;
        }

        build(): MockedResponse<GetUserNameQueryResponse, GetUserNameQueryVariables> {
          return {
            request: {
              query: GetUserNameQueryDocument,
            },
            result: {
              data: {
                __typename: 'Query',
                me: {
                  __typename: 'User',
                  name: this.me.name,
                }
              }
            }
          } as const
        }
      }

      type GetUserEmailUserType = Pick<MockUserType, "email">;

      class MockGetUserEmailQueryBuilder {
        private me: GetUserEmailUserType = {
          email: '',
        };

        havingMe(me: GetUserEmailUserType): this {
          this.me = me;
          return this;
        }

        build(): MockedResponse<GetUserEmailQueryResponse, GetUserEmailQueryVariables> {
          return {
            request: {
              query: GetUserEmailQueryDocument,
            },
            result: {
              data: {
                __typename: 'Query',
                me: {
                  __typename: 'User',
                  email: this.me.email,
                }
              }
            }
          } as const
        }
      }`
      )
    );
  });

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
    expect(result).toEqual(
      prettify(
        `
      import { MockUserType } from './userModel';

      class MockGetUsersQueryBuilder {
        private users: MockUserType[] = [];

        havingUsers(users: MockUserType[]): this {
          this.users = users;
          return this;
        }

        build(): MockedResponse<GetUsersQueryResponse, GetUsersQueryVariables> {
          return {
            request: {
              query: GetUsersQueryDocument,
            },
            result: {
              data: {
                __typename: 'Query',
                users: this.users.map(item => ({
                  __typename: 'User',
                  name: item.name,
                  age: item.age,
                  deletedAt: item.deletedAt,
                  otherField: item.otherField,
                })),
              }
            }
          } as const
        }
      }`
      )
    );
  });
});
