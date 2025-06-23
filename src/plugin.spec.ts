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
    expect(result).toContain(prettify(
      `class MockGetUserQueryBuilder {
        private me: { name: string } = { name: '' };

        havingMe(me: { name: string }): this {
          this.me = me;
          return this;
        }

        build(): MockedResponse<UserQueryResponse, UserQueryVariables> {
          return {
            request: {
              query: UserQueryDocument,
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
});
