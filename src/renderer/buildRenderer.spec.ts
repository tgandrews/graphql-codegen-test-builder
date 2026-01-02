import { renderBuild } from './buildRenderer';
import { ParseResult } from '../parser/ParseResult';
import { ClassObject, FieldValue, GQLKind, GQLType } from '../parser/types';

describe('buildRenderer', () => {
  let parseResult: ParseResult;

  beforeEach(() => {
    parseResult = new ParseResult({});
  });

  const createSimpleField = (name: string, kind: GQLKind, nullable = false): FieldValue => ({
    name,
    type: { kind, nullable } as GQLType,
  });

  const createObjectField = (name: string, id: string, nullable = false): FieldValue => ({
    name,
    type: { kind: GQLKind.Object, name, id, nullable },
  });

  describe('renderBuild', () => {
    describe('non-operation classes (regular types)', () => {
      it('should render build method for simple scalar fields', () => {
        const klass: ClassObject = {
          id: 'User:output',
          name: 'User',
          inputs: [],
          outputs: [
            createSimpleField('name', GQLKind.String),
            createSimpleField('age', GQLKind.Int),
            createSimpleField('isActive', GQLKind.Boolean),
          ],
          isInput: false,
        };

        const result = renderBuild(klass, parseResult);

        expect(result).toBe(`build() {
    return {
      __typename: 'User',
      name: this.name,
      age: this.age,
      isActive: this.isActive
    } as const
  }`);
      });

      it('should render build method for nested object fields with build() calls', () => {
        const userClass: ClassObject = {
          id: 'User:output',
          name: 'User',
          inputs: [],
          outputs: [
            createSimpleField('name', GQLKind.String),
            createObjectField('profile', 'Profile:output'),
          ],
          isInput: false,
        };

        const profileClass: ClassObject = {
          id: 'Profile:output',
          name: 'Profile',
          inputs: [],
          outputs: [createSimpleField('bio', GQLKind.String)],
          isInput: false,
        };

        parseResult.classes.set('Profile:output', profileClass);

        const result = renderBuild(userClass, parseResult);

        expect(result).toBe(`build() {
    return {
      __typename: 'User',
      name: this.name,
      profile: this.profile.build()
    } as const
  }`);
      });

      it('should render build method for inline objects', () => {
        const userClass: ClassObject = {
          id: 'User:output',
          name: 'User',
          inputs: [],
          outputs: [
            createSimpleField('name', GQLKind.String),
            createObjectField('profile', 'Profile:output'),
          ],
          isInput: false,
        };

        const profileClass: ClassObject = {
          id: 'Profile:output',
          name: 'Profile',
          inputs: [],
          outputs: [createSimpleField('bio', GQLKind.String)],
          isInput: false,
          shouldInline: true,
        };

        parseResult.classes.set('Profile:output', profileClass);

        const result = renderBuild(userClass, parseResult);

        expect(result).toBe(`build() {
    return {
      __typename: 'User',
      name: this.name,
      profile: {
      __typename: 'Profile',
      bio: this.profile.bio
    }
    } as const
  }`);
      });

      it('should render build method for inline input objects', () => {
        const userClass: ClassObject = {
          id: 'User:output',
          name: 'User',
          inputs: [],
          outputs: [
            createSimpleField('name', GQLKind.String),
            createObjectField('settings', 'Settings:output'),
          ],
          isInput: false,
        };

        const settingsClass: ClassObject = {
          id: 'Settings:output',
          name: 'Settings',
          inputs: [],
          outputs: [createSimpleField('theme', GQLKind.String)],
          isInput: true,
          shouldInline: true,
        };

        parseResult.classes.set('Settings:output', settingsClass);

        const result = renderBuild(userClass, parseResult);

        expect(result).toBe(`build() {
    return {
      __typename: 'User',
      name: this.name,
      settings: this.settings
    } as const
  }`);
      });

      it('should use selectedOutputs when available', () => {
        const klass: ClassObject = {
          id: 'User:output',
          name: 'User',
          inputs: [],
          outputs: [
            createSimpleField('name', GQLKind.String),
            createSimpleField('age', GQLKind.Int),
            createSimpleField('email', GQLKind.String),
          ],
          selectedOutputs: [
            createSimpleField('name', GQLKind.String),
            createSimpleField('email', GQLKind.String),
          ],
          isInput: false,
        };

        const result = renderBuild(klass, parseResult);

        expect(result).toBe(`build() {
    return {
      __typename: 'User',
      name: this.name,
      email: this.email
    } as const
  }`);
      });
    });

    describe('operation classes (queries/mutations)', () => {
      it('should render build method for query operation with no variables', () => {
        const klass: ClassObject = {
          id: 'GetUser:output',
          name: 'GetUser',
          inputs: [],
          outputs: [createObjectField('user', 'User:output')],
          isInput: false,
          operation: 'Query',
        };

        const userClass: ClassObject = {
          id: 'User:output',
          name: 'User',
          inputs: [],
          outputs: [createSimpleField('name', GQLKind.String)],
          isInput: false,
        };

        parseResult.classes.set('User:output', userClass);

        const result = renderBuild(klass, parseResult);

        expect(result).toBe(`build(): MockedResponse<GetUserQueryResponse, GetUserQueryVariables> {
    return {
    request: {
      query: GetUserQueryDocument,
    },
    result: {
      data: {
        __typename: 'Query',
        user: this.user.build()
      }
    }
  } as const
  }`);
      });

      it('should render build method for query operation with variables', () => {
        const klass: ClassObject = {
          id: 'GetUser:output',
          name: 'GetUser',
          inputs: [createSimpleField('id', GQLKind.String)],
          outputs: [createObjectField('user', 'User:output')],
          isInput: false,
          operation: 'Query',
        };

        const userClass: ClassObject = {
          id: 'User:output',
          name: 'User',
          inputs: [],
          outputs: [createSimpleField('name', GQLKind.String)],
          isInput: false,
        };

        parseResult.classes.set('User:output', userClass);

        const result = renderBuild(klass, parseResult);

        expect(result).toBe(`build(): MockedResponse<GetUserQueryResponse, GetUserQueryVariables> {
    return {
    request: {
      query: GetUserQueryDocument,
      variables: {
    id: this.id
  }
    },
    result: {
      data: {
        __typename: 'Query',
        user: this.user.build()
      }
    }
  } as const
  }`);
      });

      it('should render build method for mutation operation', () => {
        const klass: ClassObject = {
          id: 'CreateUser:output',
          name: 'CreateUser',
          inputs: [
            createSimpleField('name', GQLKind.String),
            createSimpleField('email', GQLKind.String),
          ],
          outputs: [createObjectField('user', 'User:output')],
          isInput: false,
          operation: 'Mutation',
        };

        const userClass: ClassObject = {
          id: 'User:output',
          name: 'User',
          inputs: [],
          outputs: [createSimpleField('name', GQLKind.String)],
          isInput: false,
        };

        parseResult.classes.set('User:output', userClass);

        const result = renderBuild(klass, parseResult);

        expect(result)
          .toBe(`build(): MockedResponse<CreateUserMutationResponse, CreateUserMutationVariables> {
    return {
    request: {
      query: CreateUserMutationDocument,
      variables: {
    name: this.name,
email: this.email
  }
    },
    result: {
      data: {
        __typename: 'Mutation',
        user: this.user.build()
      }
    }
  } as const
  }`);
      });

      it('should handle selectedFields in operation outputs', () => {
        const klass: ClassObject = {
          id: 'GetUser:output',
          name: 'GetUser',
          inputs: [],
          outputs: [
            {
              name: 'user',
              type: { kind: GQLKind.Object, name: 'User', id: 'User:output', nullable: false },
              selectedFields: ['name', 'email'],
            },
          ],
          isInput: false,
          operation: 'Query',
        };

        const userClass: ClassObject = {
          id: 'User:output',
          name: 'User',
          inputs: [],
          outputs: [
            createSimpleField('name', GQLKind.String),
            createSimpleField('age', GQLKind.Int),
            createSimpleField('email', GQLKind.String),
          ],
          isInput: false,
        };

        parseResult.classes.set('User:output', userClass);

        const result = renderBuild(klass, parseResult);

        expect(result).toBe(`build(): MockedResponse<GetUserQueryResponse, GetUserQueryVariables> {
    return {
    request: {
      query: GetUserQueryDocument,
    },
    result: {
      data: {
        __typename: 'Query',
        user: this.user.build()
      }
    }
  } as const
  }`);
      });
    });

    describe('error cases', () => {
      it('should throw error when referenced class is not found', () => {
        const klass: ClassObject = {
          id: 'User:output',
          name: 'User',
          inputs: [],
          outputs: [createObjectField('profile', 'NonExistent:output')],
          isInput: false,
        };

        expect(() => renderBuild(klass, parseResult)).toThrow(
          'Unable to find reference to "NonExistent:output" from "profile"'
        );
      });
    });

    describe('complex nested structures', () => {
      it('should handle deeply nested inline and regular objects', () => {
        const userClass: ClassObject = {
          id: 'User:output',
          name: 'User',
          inputs: [],
          outputs: [
            createSimpleField('name', GQLKind.String),
            createObjectField('profile', 'Profile:output'),
            createObjectField('address', 'Address:output'),
          ],
          isInput: false,
        };

        const profileClass: ClassObject = {
          id: 'Profile:output',
          name: 'Profile',
          inputs: [],
          outputs: [
            createSimpleField('bio', GQLKind.String),
            createObjectField('avatar', 'Avatar:output'),
          ],
          isInput: false,
          shouldInline: true,
        };

        const avatarClass: ClassObject = {
          id: 'Avatar:output',
          name: 'Avatar',
          inputs: [],
          outputs: [createSimpleField('url', GQLKind.String)],
          isInput: false,
        };

        const addressClass: ClassObject = {
          id: 'Address:output',
          name: 'Address',
          inputs: [],
          outputs: [
            createSimpleField('street', GQLKind.String),
            createSimpleField('city', GQLKind.String),
          ],
          isInput: false,
        };

        parseResult.classes.set('Profile:output', profileClass);
        parseResult.classes.set('Avatar:output', avatarClass);
        parseResult.classes.set('Address:output', addressClass);

        const result = renderBuild(userClass, parseResult);

        expect(result).toBe(`build() {
    return {
      __typename: 'User',
      name: this.name,
      profile: {
      __typename: 'Profile',
      bio: this.profile.bio,
      avatar: this.profile.avatar.build()
    },
      address: this.address.build()
    } as const
  }`);
      });
    });

    describe('edge cases', () => {
      it('should throw error for empty outputs array', () => {
        const klass: ClassObject = {
          id: 'Empty:output',
          name: 'Empty',
          inputs: [],
          outputs: [],
          isInput: false,
        };

        expect(() => renderBuild(klass, parseResult)).toThrow(
          'Class "Empty" has no output fields to render'
        );
      });

      it('should throw error for operation with empty outputs', () => {
        const klass: ClassObject = {
          id: 'EmptyQuery:output',
          name: 'EmptyQuery',
          inputs: [],
          outputs: [],
          isInput: false,
          operation: 'Query',
        };

        expect(() => renderBuild(klass, parseResult)).toThrow(
          'Operation "EmptyQuery" has no output fields to render'
        );
      });
    });
  });
});
