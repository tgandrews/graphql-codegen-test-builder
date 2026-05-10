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
    const resolvedField = catalogue.getResolvedObjectField(
      operationClass.outputs[0],
      operationClass
    );

    expect(resolvedField?.kind).toBe('inline-pick');
    if (resolvedField?.kind !== 'inline-pick') {
      throw new Error('Expected inline-pick');
    }
    expect(resolvedField.pickTypeName).toBe('GetUserUserType');
    expect(resolvedField.projectedFields.map((field) => field.name)).toEqual(['name', 'email']);
  });

  it('uses base fields when filtering an explicit projected field set', () => {
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
    };

    parseResult.classes.set(userClass.id, userClass);

    const catalogue = buildSelectionCatalogue(parseResult);

    expect(
      catalogue.getFieldsToRender(userClass, ['name', 'email']).map((field) => field.name)
    ).toEqual(['name', 'email']);
  });

  it('uses the selected shape when no explicit field filter is provided', () => {
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
    };

    parseResult.classes.set(userClass.id, userClass);

    const catalogue = buildSelectionCatalogue(parseResult);

    expect(catalogue.getFieldsToRender(userClass).map((field) => field.name)).toEqual([
      'id',
      'name',
    ]);
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
    const resolvedField = catalogue.getResolvedObjectField(
      operationClass.outputs[0],
      operationClass
    );

    expect(resolvedField?.kind).toBe('inline');
  });

  it('preserves fragment-backed field metadata in projections', () => {
    parseResult.classes.set('Profile:output', {
      id: 'Profile:output',
      name: 'Profile',
      inputs: [],
      outputs: [createSimpleField('bio', GQLKind.String)],
      selectedOutputs: [createSimpleField('bio', GQLKind.String)],
      isInput: false,
    });

    const field = createObjectField(
      'profile',
      'Profile:output',
      false,
      ['bio'],
      ['ProfileSummary']
    );
    const catalogue = buildSelectionCatalogue(parseResult);
    const resolvedField = catalogue.getResolvedObjectField(field);

    expect(resolvedField?.kind).toBe('fragment-backed');
    if (resolvedField?.kind !== 'fragment-backed') {
      throw new Error('Expected fragment-backed');
    }
    expect(resolvedField.fragmentSpreads).toEqual(['ProfileSummary']);
  });

  it('does not generate pick projections for user-defined classes', () => {
    parseResult = new ParseResult({
      userDefinedClasses: {
        User: { path: '@/builders/UserBuilder', exportName: 'UserBuilder' },
      },
    });
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
    const resolvedField = catalogue.getResolvedObjectField(
      operationClass.outputs[0],
      operationClass
    );

    expect(resolvedField?.kind).toBe('user-defined');
  });

  it('resolves selection-builder fields', () => {
    parseResult.classes.set('UserSelection:output', {
      id: 'UserSelection:output',
      name: 'UserSelection',
      inputs: [],
      outputs: [createSimpleField('name', GQLKind.String)],
      isInput: false,
      isSelectionBuilder: true,
    });

    const catalogue = buildSelectionCatalogue(parseResult);
    const resolvedField = catalogue.getResolvedObjectField(
      createObjectField('user', 'UserSelection:output')
    );

    expect(resolvedField?.kind).toBe('selection-builder');
  });

  it('resolves inline input fields', () => {
    parseResult.classes.set('Filter:input', {
      id: 'Filter:input',
      name: 'Filter',
      inputs: [createSimpleField('name', GQLKind.String)],
      outputs: [],
      isInput: true,
    });

    const catalogue = buildSelectionCatalogue(parseResult);
    const resolvedField = catalogue.getResolvedObjectField(
      createObjectField('filter', 'Filter:input')
    );

    expect(resolvedField?.kind).toBe('inline-input');
  });

  it('resolves builder fields', () => {
    parseResult = new ParseResult({ enableOptimiser: false });
    parseResult.classes.set('User:output', {
      id: 'User:output',
      name: 'User',
      inputs: [],
      outputs: [createSimpleField('name', GQLKind.String)],
      isInput: false,
    });

    const catalogue = buildSelectionCatalogue(parseResult);
    const resolvedField = catalogue.getResolvedObjectField(
      createObjectField('user', 'User:output')
    );

    expect(resolvedField?.kind).toBe('builder');
  });

  it('disambiguates pick type names for different fields of the same object type', () => {
    parseResult.classes.set('User:output', {
      id: 'User:output',
      name: 'User',
      inputs: [],
      outputs: [
        createSimpleField('id', GQLKind.String),
        createSimpleField('name', GQLKind.String),
        createSimpleField('email', GQLKind.String),
      ],
      selectedOutputs: [createSimpleField('id', GQLKind.String)],
      isInput: false,
      hasMultipleQueries: true,
    });

    const operationClass: ClassObject = {
      id: 'GetTeam:output',
      name: 'GetTeam',
      inputs: [],
      outputs: [
        createObjectField('author', 'User:output', false, ['name']),
        createObjectField('reviewer', 'User:output', false, ['email']),
      ],
      isInput: false,
      operation: 'Query',
    };

    const catalogue = buildSelectionCatalogue(parseResult);
    const authorField = catalogue.getResolvedObjectField(operationClass.outputs[0], operationClass);
    const reviewerField = catalogue.getResolvedObjectField(
      operationClass.outputs[1],
      operationClass
    );

    expect(authorField?.kind).toBe('inline-pick');
    expect(reviewerField?.kind).toBe('inline-pick');

    if (authorField?.kind !== 'inline-pick' || reviewerField?.kind !== 'inline-pick') {
      throw new Error('Expected inline-pick fields');
    }

    expect(authorField.pickTypeName).toBe('GetTeamUserAuthorType');
    expect(reviewerField.pickTypeName).toBe('GetTeamUserReviewerType');
  });
});
