import optimiser from './optimiser';
import { ParseResult, ClassObject, GQLKind, GQLType } from './parser';

const createSimpleField = (name: string, kind: GQLKind, nullable = false) => ({
  name,
  type: { kind, nullable } as GQLType,
});

describe('optimiser', () => {
  it('should inline generated output types by default', () => {
    const parseResult = new ParseResult();
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

    parseResult.addClass(klass);

    const result = optimiser(parseResult);

    expect(result.getClass('User:output')?.shouldInline).toBe(true);
  });

  it('should inline generated input types at or below the configured threshold', () => {
    const parseResult = new ParseResult();
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

    parseResult.addClass(klass);

    const result = optimiser(parseResult, { inlineFieldCountThreshold: 2 });

    expect(result.getClass('Filter:input')?.shouldInline).toBe(true);
  });

  it('should not inline generated input types above the configured threshold', () => {
    const parseResult = new ParseResult();
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

    parseResult.addClass(klass);

    const result = optimiser(parseResult, { inlineFieldCountThreshold: 2 });

    expect(result.getClass('CreateUserInput:input')?.shouldInline).toBeUndefined();
  });

  it('should not inline user-defined classes', () => {
    const parseResult = new ParseResult();
    const klass: ClassObject = {
      id: 'User:output',
      name: 'User',
      inputs: [],
      outputs: [createSimpleField('name', GQLKind.String)],
      isInput: false,
      userDefined: { path: './userModel', exportName: 'MockUserType' },
    };

    parseResult.addClass(klass);

    const result = optimiser(parseResult);

    expect(result.getClass('User:output')?.shouldInline).toBeUndefined();
  });

  it('should not inline operation classes', () => {
    const parseResult = new ParseResult();
    const klass: ClassObject = {
      id: 'GetUser:input',
      name: 'GetUser',
      inputs: [],
      outputs: [createSimpleField('name', GQLKind.String)],
      isInput: true,
      operation: 'Query',
    };

    parseResult.addClass(klass);

    const result = optimiser(parseResult);

    expect(result.getClass('GetUser:input')?.shouldInline).toBeUndefined();
  });

  it('should skip all optimisation when disabled', () => {
    const parseResult = new ParseResult();
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

    parseResult.addClass(outputKlass);
    parseResult.addClass(inputKlass);

    const result = optimiser(parseResult, { enableOptimiser: false });

    expect(result.getClass('User:output')?.shouldInline).toBeUndefined();
    expect(result.getClass('CreateUserInput:input')?.shouldInline).toBeUndefined();
  });
});
