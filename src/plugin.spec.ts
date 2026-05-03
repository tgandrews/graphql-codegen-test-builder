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
      expect(result).toEqual(
        prettify(
          `type MockUserType = {
          name: string;
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
      expect(result).toEqual(
        prettify(
          `type MockUserType = {
          id: string;
          name: string;
          active: boolean;
          score: number;
          age: number;
        }

        class MockGetUserQueryBuilder {
          private me: MockUserType = {
            id: '',
            name: '',
            active: false,
            score: 0.0,
            age: 0,
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
                    id: this.me.id,
                    name: this.me.name,
                    active: this.me.active,
                    score: this.me.score,
                    age: this.me.age,
                  }
                }
              }
            } as const
          }
        }

        type MockDeleteUserInputType = {
          id: string;
          soft: boolean | null;
        }

        type DeleteUserUserType = Pick<MockUserType, "id">;

        class MockDeleteUserMutationBuilder {
          private input: MockDeleteUserInputType = {
            id: '',
            soft: null,
          };

          private deleteUser: DeleteUserUserType = {
            id: '',
          };

          forInput(input: MockDeleteUserInputType): this {
            this.input = input;
            return this;
          }

          havingDeleteUser(deleteUser: DeleteUserUserType): this {
            this.deleteUser = deleteUser;
            return this;
          }

          build(): MockedResponse<DeleteUserMutationResponse, DeleteUserMutationVariables> {
            return {
              request: {
                query: DeleteUserMutationDocument,
                variables: {
                  input: this.input,
                }
              },
              result: {
                data: {
                  __typename: 'Mutation',
                  deleteUser: {
                    __typename: 'User',
                    id: this.deleteUser.id,
                  }
                }
              }
            } as const
          }
        }`
        )
      );
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
      expect(result).toEqual(
        prettify(
          `class MockUserSummaryFragmentBuilder {
          private name: string = '';

          private email: string = '';

          havingName(name: string): this {
            this.name = name;
            return this;
          }
          havingEmail(email: string): this {
            this.email = email;
            return this;
          }

          build() {
            return {
              name: this.name,
              email: this.email,
            } as const
          }
        }

        type MockUserType = {
          name: string;
          email: string;
        }`
        )
      );
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
      expect(result).toEqual(
        prettify(
          `class MockUserSummaryFragmentBuilder {
          private name: string = '';

          private email: string = '';

          havingName(name: string): this {
            this.name = name;
            return this;
          }
          havingEmail(email: string): this {
            this.email = email;
            return this;
          }

          build() {
            return {
              name: this.name,
              email: this.email,
            } as const
          }
        }

        type MockUserType = {
          name: string;
          email: string;
        }

        class MockGetUserQueryBuilder {
          private me: MockUserSummaryFragmentBuilder = new MockUserSummaryFragmentBuilder();

          havingMe(me: MockUserSummaryFragmentBuilder): this {
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
                    ...this.me.build(),
                  },
                }
              }
            } as const
          }
        }`
        )
      );
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
      expect(result).toEqual(
        prettify(
          `class MockUserSummaryFragmentBuilder {
          private name: string = '';

          havingName(name: string): this {
            this.name = name;
            return this;
          }

          build() {
            return {
              name: this.name,
            } as const
          }
        }

        class MockUserContactFragmentBuilder {
          private email: string = '';

          havingEmail(email: string): this {
            this.email = email;
            return this;
          }

          build() {
            return {
              email: this.email,
            } as const
          }
        }

        type MockUserType = {
          name: string;
          email: string;
        }

        class MockGetUserMeSelectionBuilder {
          private name: string = '';
          private email: string = '';

          havingName(name: string): this {
            this.name = name;
            return this;
          }
          havingEmail(email: string): this {
            this.email = email;
            return this;
          }

          build() {
            return {
              name: this.name,
              email: this.email,
            } as const
          }
        }

        class MockGetUserQueryBuilder {
          private me: MockGetUserMeSelectionBuilder = new MockGetUserMeSelectionBuilder();

          havingMe(me: MockGetUserMeSelectionBuilder): this {
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
                    ...this.me.build(),
                  },
                }
              }
            } as const
          }
        }`
        )
      );
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
      expect(result).toEqual(
        prettify(
          `class MockUserSummaryFragmentBuilder {
          private name: string = '';

          havingName(name: string): this {
            this.name = name;
            return this;
          }

          build() {
            return {
              name: this.name,
            } as const
          }
        }

        type MockUserType = {
          name: string;
          email: string;
        }

        class MockGetUserMeSelectionBuilder {
          private name: string = '';
          private email: string = '';

          havingName(name: string): this {
            this.name = name;
            return this;
          }
          havingEmail(email: string): this {
            this.email = email;
            return this;
          }

          build() {
            return {
              name: this.name,
              email: this.email,
            } as const
          }
        }

        class MockGetUserQueryBuilder {
          private me: MockGetUserMeSelectionBuilder = new MockGetUserMeSelectionBuilder();

          havingMe(me: MockGetUserMeSelectionBuilder): this {
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
                    ...this.me.build(),
                  },
                }
              }
            } as const
          }
        }`
        )
      );
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
      expect(result).toEqual(
        prettify(
          `class MockUserSummaryFragmentBuilder {
          private name: string = '';

          havingName(name: string): this {
            this.name = name;
            return this;
          }

          build() {
            return {
              name: this.name,
            } as const
          }
        }

        type MockUserType = {
          name: string;
        }

        class MockGetUserQueryBuilder {
          private me: MockUserSummaryFragmentBuilder | null = new MockUserSummaryFragmentBuilder();

          havingMe(me: MockUserSummaryFragmentBuilder | null): this {
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
                  me: this.me == null ? null : {
                    __typename: 'User',
                    ...this.me.build(),
                  },
                }
              }
            } as const
          }
        }`
        )
      );
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
      expect(result).toEqual(
        prettify(
          `class MockUserSummaryFragmentBuilder {
          private name: string = '';

          havingName(name: string): this {
            this.name = name;
            return this;
          }

          build() {
            return {
              name: this.name,
            } as const
          }
        }

        type MockUserType = {
          name: string;
        }

        class MockGetUsersQueryBuilder {
          private users: MockUserSummaryFragmentBuilder[] = [];

          havingUsers(users: MockUserSummaryFragmentBuilder[]): this {
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
                    ...item.build(),
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
});
