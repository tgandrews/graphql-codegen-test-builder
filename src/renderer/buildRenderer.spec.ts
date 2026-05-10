import { renderBuild } from './buildRenderer';
import { ClassObject, GQLKind, TransformResult } from '../transformer';

const baseTransformResult = (classes: ClassObject[]): TransformResult => ({
  parsed: {
    schemaTypes: new Map(),
    operations: [],
    fragments: [],
  },
  imports: [],
  declarations: [],
  unions: [],
  fragments: [],
  classes,
});

describe('buildRenderer', () => {
  it('renders operation requests with variables and success/service/network modes', () => {
    const operation: ClassObject = {
      id: 'GetUser:input',
      name: 'GetUser',
      inputs: [{ name: 'id', type: { kind: GQLKind.String, nullable: false } }],
      outputs: [
        {
          name: 'me',
          type: { kind: GQLKind.Object, name: 'User', id: 'User:output', nullable: false },
          selectedFields: ['name'],
        },
      ],
      isInput: true,
      operation: 'Query',
    };
    const user: ClassObject = {
      id: 'User:output',
      name: 'User',
      inputs: [],
      outputs: [{ name: 'name', type: { kind: GQLKind.String, nullable: false } }],
      isInput: false,
    };

    const result = renderBuild(operation, baseTransformResult([user, operation]));

    expect(result).toContain(
      'build(): MockedResponse<GetUserQueryResponse, GetUserQueryVariables>'
    );
    expect(result).toContain('query: GetUserQueryDocument');
    expect(result).toContain('variables: {');
    expect(result).toContain('id: this.id');
    expect(result).toContain("this.responseMode === 'networkError'");
    expect(result).toContain("this.responseMode === 'serviceError'");
    expect(result).toContain("this.responseMode === 'success'");
    expect(result).toContain('me: this.me.build()');
  });

  it('renders inline input objects as variables without calling build()', () => {
    const operation: ClassObject = {
      id: 'CreateUser:input',
      name: 'CreateUser',
      inputs: [
        {
          name: 'input',
          type: {
            kind: GQLKind.Object,
            name: 'CreateUserInput',
            id: 'CreateUserInput:input',
            nullable: false,
          },
        },
      ],
      outputs: [{ name: 'createUser', type: { kind: GQLKind.String, nullable: false } }],
      isInput: true,
      operation: 'Mutation',
    };
    const input: ClassObject = {
      id: 'CreateUserInput:input',
      name: 'CreateUserInput',
      inputs: [{ name: 'name', type: { kind: GQLKind.String, nullable: false } }],
      outputs: [],
      isInput: true,
      shouldInline: true,
    };

    const result = renderBuild(operation, baseTransformResult([input, operation]));

    expect(result).toContain('input: this.input');
    expect(result).not.toContain('input: this.input.build()');
  });

  it('adds concrete typenames when building selection and fragment-backed fields', () => {
    const operation: ClassObject = {
      id: 'GetUser:input',
      name: 'GetUser',
      inputs: [],
      outputs: [
        {
          name: 'me',
          type: {
            kind: GQLKind.Object,
            name: 'GetUserMeSelection',
            id: 'GetUserMeSelection:output',
            nullable: true,
          },
          schemaTypeName: 'User',
        },
        {
          name: 'friends',
          type: { kind: GQLKind.Object, name: 'User', id: 'User:output', nullable: true },
          isList: true,
          fragmentSpreads: ['UserSummary'],
        },
      ],
      isInput: true,
      operation: 'Query',
    };
    const selectionBuilder: ClassObject = {
      id: 'GetUserMeSelection:output',
      name: 'GetUserMeSelection',
      inputs: [],
      outputs: [{ name: 'name', type: { kind: GQLKind.String, nullable: false } }],
      isInput: false,
      isSelectionBuilder: true,
    };
    const user: ClassObject = {
      id: 'User:output',
      name: 'User',
      inputs: [],
      outputs: [{ name: 'name', type: { kind: GQLKind.String, nullable: false } }],
      isInput: false,
      shouldInline: true,
    };

    const result = renderBuild(operation, baseTransformResult([selectionBuilder, user, operation]));

    expect(result).toContain("me: this.me == null ? null : {\n      __typename: 'User',");
    expect(result).toContain("friends: this.friends?.map(item => ({\n      __typename: 'User',");
    expect(result).toContain('...item.build()');
  });

  it('renders nullable user-defined lists by projecting fields', () => {
    const operation: ClassObject = {
      id: 'GetUsers:input',
      name: 'GetUsers',
      inputs: [],
      outputs: [
        {
          name: 'users',
          type: { kind: GQLKind.Object, name: 'User', id: 'User:output', nullable: true },
          isList: true,
        },
      ],
      isInput: true,
      operation: 'Query',
    };
    const user: ClassObject = {
      id: 'User:output',
      name: 'User',
      inputs: [],
      outputs: [
        { name: 'name', type: { kind: GQLKind.String, nullable: false } },
        { name: 'email', type: { kind: GQLKind.String, nullable: false } },
      ],
      isInput: false,
      userDefined: { path: './userModel', exportName: 'UserModel' },
    };

    const result = renderBuild(operation, baseTransformResult([user, operation]));

    expect(result).toContain("users: this.users?.map(item => ({\n      __typename: 'User',");
    expect(result).toContain('name: item.name');
    expect(result).toContain('email: item.email');
    expect(result).toContain('})) ?? null');
  });

  it('throws for empty output builders', () => {
    const klass: ClassObject = {
      id: 'Empty:output',
      name: 'Empty',
      inputs: [],
      outputs: [],
      isInput: false,
    };

    expect(() => renderBuild(klass, baseTransformResult([klass]))).toThrow(
      'Class "Empty" has no output fields to render'
    );
  });

  it('renders selection-builder build objects without typename wrapping', () => {
    const klass: ClassObject = {
      id: 'GetUserMeSelection:output',
      name: 'GetUserMeSelection',
      inputs: [],
      outputs: [{ name: 'name', type: { kind: GQLKind.String, nullable: false } }],
      isInput: false,
      isSelectionBuilder: true,
    };

    const result = renderBuild(klass, baseTransformResult([klass]));

    expect(result).toContain('return {');
    expect(result).toContain('name: this.name');
    expect(result).not.toContain('__typename');
  });
});
