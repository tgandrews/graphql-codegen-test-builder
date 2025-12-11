import { buildSchema, parse as parseGraphQL } from 'graphql';
import { Types } from '@graphql-codegen/plugin-helpers';
import parse, { GQLKind } from './index';

const buildDocuments = (query: string): Types.DocumentFile[] => {
  const ast = parseGraphQL(query);
  return [
    {
      document: ast,
      location: 'test.graphql',
    },
  ];
};

describe('parser', () => {
  describe('simple queries', () => {
    it('should parse a query with scalar fields', () => {
      const schema = buildSchema(`
        type Query {
          me: User!
        }
        type User {
          name: String!
          age: Int!
        }
      `);
      const documents = buildDocuments(`
        query GetUser {
          me {
            name
            age
          }
        }
      `);

      const result = parse(schema, documents);

      // Operations are stored with isInput: true, so they use :input suffix
      const operation = result.classes.get('GetUser:input');
      expect(operation).toBeDefined();
      expect(operation?.operation).toBe('Query');
      expect(operation?.outputs).toHaveLength(1);
      expect(operation?.outputs[0].name).toBe('me');

      // Should have the User type
      const userType = result.classes.get('User:output');
      expect(userType).toBeDefined();
      expect(userType?.outputs).toHaveLength(2);
      expect(userType?.outputs.map((f) => f.name)).toEqual(['name', 'age']);
    });

    it('should parse a query with nested objects', () => {
      const schema = buildSchema(`
        type Query {
          me: User!
        }
        type User {
          name: String!
          profile: Profile!
        }
        type Profile {
          bio: String!
        }
      `);
      const documents = buildDocuments(`
        query GetUser {
          me {
            name
            profile {
              bio
            }
          }
        }
      `);

      const result = parse(schema, documents);

      // Should have User type
      const userType = result.classes.get('User:output');
      expect(userType?.outputs).toHaveLength(2);
      expect(userType?.outputs[0].name).toBe('name');
      expect(userType?.outputs[1].name).toBe('profile');

      // Should have Profile type
      const profileType = result.classes.get('Profile:output');
      expect(profileType).toBeDefined();
      expect(profileType?.outputs).toHaveLength(1);
      expect(profileType?.outputs[0].name).toBe('bio');
    });
  });

  describe('mutations', () => {
    it('should parse a mutation with input variables', () => {
      const schema = buildSchema(`
        type Mutation {
          updateUser(input: UpdateUserInput!): User!
        }
        input UpdateUserInput {
          name: String!
          age: Int!
        }
        type User {
          name: String!
          age: Int!
        }
      `);
      const documents = buildDocuments(`
        mutation UpdateUser($input: UpdateUserInput!) {
          updateUser(input: $input) {
            name
            age
          }
        }
      `);

      const result = parse(schema, documents);

      // Should have the mutation operation
      const operation = result.classes.get('UpdateUser:input');
      expect(operation).toBeDefined();
      expect(operation?.operation).toBe('Mutation');
      expect(operation?.inputs).toHaveLength(1);
      expect(operation?.inputs[0].name).toBe('input');
      expect(operation?.inputs[0].type.kind).toBe(GQLKind.Object);

      // Should have the input type
      const inputType = result.classes.get('UpdateUserInput:input');
      expect(inputType).toBeDefined();
      expect(inputType?.inputs).toHaveLength(2);
      expect(inputType?.inputs.map((f) => f.name)).toEqual(['name', 'age']);
    });
  });

  describe('re-used types', () => {
    it('should merge multiple queries selecting different fields from the same type', () => {
      const schema = buildSchema(`
        type Query {
          me: User!
        }
        type User {
          name: String!
          email: String!
          age: Int!
        }
      `);
      const documents = buildDocuments(`
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
      `);

      const result = parse(schema, documents);

      // Should have both operations
      expect(result.classes.get('GetUserName:input')).toBeDefined();
      expect(result.classes.get('GetUserEmail:input')).toBeDefined();

      // User type should have all fields in outputs (complete schema)
      const userType = result.classes.get('User:output');
      expect(userType?.outputs).toHaveLength(3);
      expect(userType?.outputs.map((f) => f.name)).toEqual(['name', 'email', 'age']);

      // Should track selected fields across queries
      expect(userType?.selectedOutputs).toBeDefined();
      expect(userType?.selectedOutputs?.map((f) => f.name)).toEqual(['name', 'email']);
      expect(userType?.hasMultipleQueries).toBe(true);
      expect(userType?.isCompleteSchema).toBe(true);
    });

    it('should set selectedOutputs for single query but not hasMultipleQueries', () => {
      const schema = buildSchema(`
        type Query {
          me: User!
        }
        type User {
          name: String!
          email: String!
        }
      `);
      const documents = buildDocuments(`
        query GetUser {
          me {
            name
          }
        }
      `);

      const result = parse(schema, documents);

      const userType = result.classes.get('User:output');
      expect(userType?.outputs).toHaveLength(2);
      // selectedOutputs is set to track which fields were selected
      expect(userType?.selectedOutputs).toHaveLength(1);
      expect(userType?.selectedOutputs?.[0].name).toBe('name');
      // hasMultipleQueries is false, so no Pick types will be generated
      expect(userType?.hasMultipleQueries).toBe(false);
    });
  });

  describe('field types', () => {
    it('should correctly parse nullable and non-nullable fields', () => {
      const schema = buildSchema(`
        type Query {
          me: User!
        }
        type User {
          requiredName: String!
          optionalName: String
        }
      `);
      const documents = buildDocuments(`
        query GetUser {
          me {
            requiredName
            optionalName
          }
        }
      `);

      const result = parse(schema, documents);

      const userType = result.classes.get('User:output');
      const requiredField = userType?.outputs.find((f) => f.name === 'requiredName');
      const optionalField = userType?.outputs.find((f) => f.name === 'optionalName');

      expect(requiredField?.type.nullable).toBe(false);
      expect(optionalField?.type.nullable).toBe(true);
    });

    it('should parse different scalar types', () => {
      const schema = buildSchema(`
        type Query {
          me: User!
        }
        type User {
          name: String!
          age: Int!
        }
      `);
      const documents = buildDocuments(`
        query GetUser {
          me {
            name
            age
          }
        }
      `);

      const result = parse(schema, documents);

      const userType = result.classes.get('User:output');
      const nameField = userType?.outputs.find((f) => f.name === 'name');
      const ageField = userType?.outputs.find((f) => f.name === 'age');

      expect(nameField?.type.kind).toBe(GQLKind.String);
      expect(ageField?.type.kind).toBe(GQLKind.Int);
    });
  });

  describe('selected fields tracking', () => {
    it('should track selected fields for nested objects', () => {
      const schema = buildSchema(`
        type Query {
          me: User!
        }
        type User {
          name: String!
          profile: Profile!
        }
        type Profile {
          bio: String!
          avatar: String!
          location: String!
        }
      `);
      const documents = buildDocuments(`
        query GetUser {
          me {
            name
            profile {
              bio
              avatar
            }
          }
        }
      `);

      const result = parse(schema, documents);

      const userType = result.classes.get('User:output');
      const profileField = userType?.selectedOutputs?.find((f) => f.name === 'profile');
      expect(profileField?.selectedFields).toEqual(['bio', 'avatar']);
    });
  });
});
