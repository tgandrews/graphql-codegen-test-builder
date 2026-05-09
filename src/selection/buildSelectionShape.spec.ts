import { ParseResult } from '../parser/ParseResult';
import { ClassObject, FieldValue, GQLKind, GQLType } from '../parser/types';
import { buildSelectionCatalogue } from './buildSelectionShape';

describe('buildSelectionCatalogue', () => {
  let parseResult: ParseResult;

  beforeEach(() => {
    parseResult = new ParseResult({});
  });

  const createSimpleField = (name: string, kind: GQLKind, nullable = false): FieldValue => ({
    name,
    type: { kind, nullable } as GQLType,
  });

  const createObjectField = (
    name: string,
    id: string,
    nullable = false,
    selectedFields?: string[],
    fragmentSpreads?: string[]
  ): FieldValue => ({
    name,
    type: { kind: GQLKind.Object, name, id, nullable },
    selectedFields,
    fragmentSpreads,
  });

  it('uses selected outputs as the selected shape for generated mock types', () => {
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
      hasMultipleQueries: true,
      isCompleteSchema: true,
    };

    parseResult.classes.set(userClass.id, userClass);

    const catalogue = buildSelectionCatalogue(parseResult);
    const shape = catalogue.getSelectionShape(userClass.id);

    expect(shape).toEqual({
      typeId: 'User:output',
      typeName: 'User',
      baseFields: userClass.outputs,
      selectedFields: userClass.selectedOutputs,
      hasMultipleOperations: true,
      isCompleteSchema: true,
    });
  });

  it('computes an operation-specific pick projection when selected fields differ', () => {
    parseResult.classes.set('User:output', {
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
    });

    const operationClass: ClassObject = {
      id: 'GetUser:output',
      name: 'GetUser',
      inputs: [],
      outputs: [createObjectField('user', 'User:output', false, ['name', 'email'])],
      isInput: false,
      operation: 'Query',
    };

    const catalogue = buildSelectionCatalogue(parseResult);
    const projection = catalogue.getFieldProjection(operationClass.outputs[0], operationClass);

    expect(projection?.needsPickType).toBe(true);
    expect(projection?.projectionTypeName).toBe('GetUserUserType');
    expect(projection?.projectedFields.map((field) => field.name)).toEqual(['name', 'email']);
  });

  it('reuses the base generated mock type when selected fields match the selected shape', () => {
    parseResult.classes.set('User:output', {
      id: 'User:output',
      name: 'User',
      inputs: [],
      outputs: [createSimpleField('id', GQLKind.String), createSimpleField('name', GQLKind.String)],
      selectedOutputs: [
        createSimpleField('id', GQLKind.String),
        createSimpleField('name', GQLKind.String),
      ],
      isInput: false,
      shouldInline: true,
    });

    const operationClass: ClassObject = {
      id: 'GetUser:output',
      name: 'GetUser',
      inputs: [],
      outputs: [createObjectField('user', 'User:output', false, ['name', 'id'])],
      isInput: false,
      operation: 'Query',
    };

    const catalogue = buildSelectionCatalogue(parseResult);
    const projection = catalogue.getFieldProjection(operationClass.outputs[0], operationClass);

    expect(projection?.needsPickType).toBe(false);
    expect(projection?.projectionTypeName).toBeUndefined();
  });

  it('preserves fragment-backed field metadata in projections', () => {
    parseResult.classes.set('Profile:output', {
      id: 'Profile:output',
      name: 'Profile',
      inputs: [],
      outputs: [createSimpleField('bio', GQLKind.String)],
      selectedOutputs: [createSimpleField('bio', GQLKind.String)],
      isInput: false,
      shouldInline: true,
    });

    const field = createObjectField(
      'profile',
      'Profile:output',
      false,
      ['bio'],
      ['ProfileSummary']
    );
    const catalogue = buildSelectionCatalogue(parseResult);
    const projection = catalogue.getFieldProjection(field);

    expect(projection?.isFragmentBacked).toBe(true);
    expect(projection?.fragmentSpreads).toEqual(['ProfileSummary']);
    expect(projection?.needsPickType).toBe(false);
  });

  it('does not generate pick projections for user-defined classes', () => {
    parseResult.classes.set('User:output', {
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
      userDefined: { path: '@/builders/UserBuilder', exportName: 'UserBuilder' },
    });

    const operationClass: ClassObject = {
      id: 'GetUser:output',
      name: 'GetUser',
      inputs: [],
      outputs: [createObjectField('user', 'User:output', false, ['name', 'email'])],
      isInput: false,
      operation: 'Query',
    };

    const catalogue = buildSelectionCatalogue(parseResult);
    const projection = catalogue.getFieldProjection(operationClass.outputs[0], operationClass);

    expect(projection?.needsPickType).toBe(false);
    expect(projection?.projectionTypeName).toBeUndefined();
  });
});
