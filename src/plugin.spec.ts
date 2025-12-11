import { buildSchema, parse } from 'graphql';
import graphqlBuilderPlugin from './plugin';
import prettier from 'prettier';

const buildDocuments = (query: string) => {
  const ast = parse(query);
  return [{
    document: ast,
    location: 'test.graphql'
  }]
}

const prettify = (tsString: string) => {
  return prettier.format(tsString, { parser: 'typescript' });
}

const runPlugin = async (query: string, schemaString: string) => {
  const schema = buildSchema(schemaString);
  const documents = buildDocuments(query);
  const result = await graphqlBuilderPlugin(schema, documents, {})
  return prettify(result.content)
}


describe('plugin', () => {
  it('should generate a builder class', async () => {
    const schema = `
      type Query {
        me: User!
      }

      type User {
        name: String!
      }
    `
    const query = `
      query GetUser {
        me {
          name
        }
      }
    `
    const result = await runPlugin(query, schema)
    expect(result).toEqual(prettify(
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
    ))
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
    `
    const query = `
      mutation CreateUser($input: CreateUserInput!) {
        createUser(input: $input) {
          name
        }
      }
    `
    const result = await runPlugin(query, schema)
    expect(result).toEqual(prettify(
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
    ))
  });
});
