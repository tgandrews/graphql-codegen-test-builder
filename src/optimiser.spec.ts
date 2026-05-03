import optimiser from './optimiser';
import { ParseResult, ClassObject, GQLKind, GQLType } from './parser';

const createSimpleField = (name: string, kind: GQLKind, nullable = false) => ({
  name,
  type: { kind, nullable } as GQLType,
});

describe('optimiser', () => {
  it('should inline generated output types by default', () => {
    const parseResult = new ParseResult({});
    const klass: ClassObject = {
      id: 'User:output',
      name: 'User',
      inputs: [],
      outputs: [
        createSimpleField('id', GQLKind.String),
        createSimpleField('name', GQLKind.String),
        createSimpleField('email', GQLKind.String),
        createSimpleField('age', GQLKind.Int),
      ],
      isInput: false,
    };

    parseResult.classes.set(klass.id, klass);

    const result = optimiser(parseResult);

    expect(result.classes.get('User:output')?.shouldInline).toBe(true);
  });

  it('should inline generated input types at or below the configured threshold', () => {
    const parseResult = new ParseResult({ inlineFieldCountThreshold: 2 });
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

    parseResult.classes.set(klass.id, klass);

    const result = optimiser(parseResult);

    expect(result.classes.get('Filter:input')?.shouldInline).toBe(true);
  });

  it('should not inline generated input types above the configured threshold', () => {
    const parseResult = new ParseResult({ inlineFieldCountThreshold: 2 });
    const klass: ClassObject = {
      id: 'CreateUserInput:input',
      name: 'CreateUserInput',
      inputs: [
        createSimpleField('name', GQLKind.String),
        createSimpleField('age', GQLKind.Int, true),
        createSimpleField('email', GQLKind.String, true),
      ],
      outputs: [],
      isInput: true,
    };

    parseResult.classes.set(klass.id, klass);

    const result = optimiser(parseResult);

    expect(result.classes.get('CreateUserInput:input')?.shouldInline).toBeUndefined();
  });

  it('should not inline user-defined classes', () => {
    const parseResult = new ParseResult({
      userDefinedClasses: {
        User: { path: './userModel', exportName: 'MockUserType' },
      },
    });
    const klass: ClassObject = {
      id: 'User:output',
      name: 'User',
      inputs: [],
      outputs: [createSimpleField('name', GQLKind.String)],
      isInput: false,
      userDefined: { path: './userModel', exportName: 'MockUserType' },
    };

    parseResult.classes.set(klass.id, klass);

    const result = optimiser(parseResult);

    expect(result.classes.get('User:output')?.shouldInline).toBeUndefined();
  });

  it('should not inline operation classes', () => {
    const parseResult = new ParseResult({});
    const klass: ClassObject = {
      id: 'GetUser:input',
      name: 'GetUser',
      inputs: [],
      outputs: [createSimpleField('name', GQLKind.String)],
      isInput: true,
      operation: 'Query',
    };

    parseResult.classes.set(klass.id, klass);

    const result = optimiser(parseResult);

    expect(result.classes.get('GetUser:input')?.shouldInline).toBeUndefined();
  });

  it('should skip all optimisation when disabled', () => {
    const parseResult = new ParseResult({ enableOptimiser: false });
    const outputKlass: ClassObject = {
      id: 'User:output',
      name: 'User',
      inputs: [],
      outputs: [createSimpleField('name', GQLKind.String)],
      isInput: false,
    };
    const inputKlass: ClassObject = {
      id: 'CreateUserInput:input',
      name: 'CreateUserInput',
      inputs: [createSimpleField('name', GQLKind.String)],
      outputs: [],
      isInput: true,
    };

    parseResult.classes.set(outputKlass.id, outputKlass);
    parseResult.classes.set(inputKlass.id, inputKlass);

    const result = optimiser(parseResult);

    expect(result.classes.get('User:output')?.shouldInline).toBeUndefined();
    expect(result.classes.get('CreateUserInput:input')?.shouldInline).toBeUndefined();
  });
});
