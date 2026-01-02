import { renderClass } from './classRenderer';
import { ParseResult } from '../parser/ParseResult';
import { ClassObject, FieldValue, GQLKind, GQLType } from '../parser/types';
import { prettify } from '../test/helpers';

describe('classRenderer', () => {
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

  describe('renderClass', () => {
    describe('inline classes (types)', () => {
      it('should render simple class as type with input fields', () => {
        const klass: ClassObject = {
          id: 'User:input',
          name: 'User',
          inputs: [
            createSimpleField('name', GQLKind.String),
            createSimpleField('age', GQLKind.Int),
          ],
          outputs: [],
          isInput: true,
          shouldInline: true,
        };

        const result = prettify(renderClass(klass, parseResult));

        expect(result).toBe(`type MockUserType = {
  name: string;
  age: number;
};
`);
      });

      it('should render simple class as type with output fields', () => {
        const klass: ClassObject = {
          id: 'User:output',
          name: 'User',
          inputs: [],
          outputs: [
            createSimpleField('id', GQLKind.String),
            createSimpleField('email', GQLKind.String),
          ],
          isInput: false,
          shouldInline: true,
        };

        const result = prettify(renderClass(klass, parseResult));

        expect(result).toBe(`type MockUserType = {
  id: string;
  email: string;
};
`);
      });

      it('should use selectedOutputs when hasMultipleQueries is true', () => {
        const klass: ClassObject = {
          id: 'User:output',
          name: 'User',
          inputs: [],
          outputs: [
            createSimpleField('id', GQLKind.String),
            createSimpleField('name', GQLKind.String),
            createSimpleField('email', GQLKind.String),
          ],
          selectedOutputs: [
            createSimpleField('id', GQLKind.String),
            createSimpleField('name', GQLKind.String),
          ],
          isInput: false,
          shouldInline: true,
          hasMultipleQueries: true,
        };

        const result = prettify(renderClass(klass, parseResult));

        expect(result).toBe(`type MockUserType = {
  id: string;
  name: string;
};
`);
      });

      it('should throw error when trying to inline an operation', () => {
        const klass: ClassObject = {
          id: 'GetUser:output',
          name: 'GetUser',
          inputs: [],
          outputs: [createSimpleField('name', GQLKind.String)],
          isInput: false,
          shouldInline: true,
          operation: 'Query',
        };

        expect(() => renderClass(klass, parseResult)).toThrow(
          'Attempting to inline operation: GetUser'
        );
      });
    });

    describe('builder classes', () => {
      it('should render simple builder class with input and output fields', () => {
        const klass: ClassObject = {
          id: 'User:output',
          name: 'User',
          inputs: [createSimpleField('id', GQLKind.String)],
          outputs: [
            createSimpleField('name', GQLKind.String),
            createSimpleField('email', GQLKind.String),
          ],
          isInput: false,
        };

        const result = prettify(renderClass(klass, parseResult));

        expect(result).toBe(`class MockUserBuilder {
  private id: string = "";

  private name: string = "";
  private email: string = "";

  forId(id: string): this {
    this.id = id;
    return this;
  }

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
      __typename: "User",
      name: this.name,
      email: this.email,
    } as const;
  }
}
`);
      });

      it('should render query operation builder class', () => {
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

        const result = prettify(renderClass(klass, parseResult));

        expect(result).toBe(`class MockGetUserQueryBuilder {
  private id: string = "";

  private user: MockUserBuilder = new MockUserBuilder();

  forId(id: string): this {
    this.id = id;
    return this;
  }

  havingUser(user: MockUserBuilder): this {
    this.user = user;
    return this;
  }

  build(): MockedResponse<GetUserQueryResponse, GetUserQueryVariables> {
    return {
      request: {
        query: GetUserQueryDocument,
        variables: {
          id: this.id,
        },
      },
      result: {
        data: {
          __typename: "Query",
          user: this.user.build(),
        },
      },
    } as const;
  }
}
`);
      });

      it('should render mutation operation builder class', () => {
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
          outputs: [createSimpleField('id', GQLKind.String)],
          isInput: false,
        };

        parseResult.classes.set('User:output', userClass);

        const result = prettify(renderClass(klass, parseResult));

        expect(result).toBe(`class MockCreateUserMutationBuilder {
  private name: string = "";
  private email: string = "";

  private user: MockUserBuilder = new MockUserBuilder();

  forName(name: string): this {
    this.name = name;
    return this;
  }
  forEmail(email: string): this {
    this.email = email;
    return this;
  }

  havingUser(user: MockUserBuilder): this {
    this.user = user;
    return this;
  }

  build(): MockedResponse<
    CreateUserMutationResponse,
    CreateUserMutationVariables
  > {
    return {
      request: {
        query: CreateUserMutationDocument,
        variables: {
          name: this.name,
          email: this.email,
        },
      },
      result: {
        data: {
          __typename: "Mutation",
          user: this.user.build(),
        },
      },
    } as const;
  }
}
`);
      });
    });

    describe('pick types generation', () => {
      it('should generate pick types for operations with selectedFields', () => {
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
            createSimpleField('id', GQLKind.String),
            createSimpleField('name', GQLKind.String),
            createSimpleField('email', GQLKind.String),
            createSimpleField('age', GQLKind.Int),
          ],
          selectedOutputs: [
            createSimpleField('id', GQLKind.String),
            createSimpleField('name', GQLKind.String),
            createSimpleField('age', GQLKind.Int),
          ],
          isInput: false,
          shouldInline: true,
        };

        parseResult.classes.set('User:output', userClass);

        const result = prettify(renderClass(klass, parseResult));

        expect(result).toContain('type GetUserUserType = Pick<MockUserType, "name", "email">;');
        expect(result).toContain('class MockGetUserQueryBuilder {');
      });

      it('should not generate pick types when selectedFields match base type selectedOutputs', () => {
        const klass: ClassObject = {
          id: 'GetUser:output',
          name: 'GetUser',
          inputs: [],
          outputs: [
            {
              name: 'user',
              type: { kind: GQLKind.Object, name: 'User', id: 'User:output', nullable: false },
              selectedFields: ['id', 'name'],
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
            createSimpleField('id', GQLKind.String),
            createSimpleField('name', GQLKind.String),
            createSimpleField('email', GQLKind.String),
          ],
          selectedOutputs: [
            createSimpleField('id', GQLKind.String),
            createSimpleField('name', GQLKind.String),
          ],
          isInput: false,
          shouldInline: true,
        };

        parseResult.classes.set('User:output', userClass);

        const result = prettify(renderClass(klass, parseResult));

        expect(result).not.toContain('type GetUserQueryUserType = Pick');
        expect(result).toContain('class MockGetUserQueryBuilder {');
      });

      it('should not generate pick types for non-operation classes', () => {
        const klass: ClassObject = {
          id: 'User:output',
          name: 'User',
          inputs: [],
          outputs: [
            {
              name: 'profile',
              type: {
                kind: GQLKind.Object,
                name: 'Profile',
                id: 'Profile:output',
                nullable: false,
              },
              selectedFields: ['bio'],
            },
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

        const result = prettify(renderClass(klass, parseResult));

        expect(result).not.toContain('type UserUserType = Pick');
        expect(result).toContain('class MockUserBuilder {');
      });
    });

    describe('complex scenarios', () => {
      it('should render class with mixed field types', () => {
        const klass: ClassObject = {
          id: 'User:output',
          name: 'User',
          inputs: [createSimpleField('filter', GQLKind.String)],
          outputs: [
            createSimpleField('id', GQLKind.String),
            createSimpleField('age', GQLKind.Int),
            createSimpleField('isActive', GQLKind.Boolean),
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

        const result = prettify(renderClass(klass, parseResult));

        expect(result).toBe(`class MockUserBuilder {
  private filter: string = "";

  private id: string = "";
  private age: number = 0;
  private isActive: boolean = false;
  private profile: MockProfileBuilder = new MockProfileBuilder();

  forFilter(filter: string): this {
    this.filter = filter;
    return this;
  }

  havingId(id: string): this {
    this.id = id;
    return this;
  }
  havingAge(age: number): this {
    this.age = age;
    return this;
  }
  havingIsActive(isActive: boolean): this {
    this.isActive = isActive;
    return this;
  }
  havingProfile(profile: MockProfileBuilder): this {
    this.profile = profile;
    return this;
  }

  build() {
    return {
      __typename: "User",
      id: this.id,
      age: this.age,
      isActive: this.isActive,
      profile: this.profile.build(),
    } as const;
  }
}
`);
      });

      it('should throw error for empty inputs and outputs in builder classes', () => {
        const klass: ClassObject = {
          id: 'Empty:output',
          name: 'Empty',
          inputs: [],
          outputs: [],
          isInput: false,
        };

        expect(() => renderClass(klass, parseResult)).toThrow(
          'Class "Empty" has no output fields to render'
        );
      });
    });

    describe('edge cases', () => {
      it('should throw error for class with only input fields', () => {
        const klass: ClassObject = {
          id: 'Filter:input',
          name: 'Filter',
          inputs: [
            createSimpleField('search', GQLKind.String),
            createSimpleField('limit', GQLKind.Int),
          ],
          outputs: [],
          isInput: true,
        };

        expect(() => renderClass(klass, parseResult)).toThrow(
          'Class "Filter" has no output fields to render'
        );
      });

      it('should render class with only output fields', () => {
        const klass: ClassObject = {
          id: 'Result:output',
          name: 'Result',
          inputs: [],
          outputs: [
            createSimpleField('success', GQLKind.Boolean),
            createSimpleField('message', GQLKind.String),
          ],
          isInput: false,
        };

        const result = prettify(renderClass(klass, parseResult));

        expect(result).toBe(`class MockResultBuilder {
  private success: boolean = false;
  private message: string = "";

  havingSuccess(success: boolean): this {
    this.success = success;
    return this;
  }
  havingMessage(message: string): this {
    this.message = message;
    return this;
  }

  build() {
    return {
      __typename: "Result",
      success: this.success,
      message: this.message,
    } as const;
  }
}
`);
      });
    });
  });
});
