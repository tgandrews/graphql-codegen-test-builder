import { ClassObject, GQLKind, GQLType, ParseResult } from '../parser';
import { buildRenderPlan } from './buildRenderPlan';

const createSimpleField = (name: string, kind: GQLKind, nullable = false) => ({
  name,
  type: { kind, nullable } as GQLType,
});

describe('buildRenderPlan', () => {
  it('inlines generated output types by default', () => {
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

    expect(buildRenderPlan(parseResult).shouldInline(klass)).toBe(true);
  });

  it('inlines generated input types at or below the configured threshold', () => {
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

    expect(buildRenderPlan(parseResult).shouldInline(klass)).toBe(true);
  });

  it('does not inline generated input types above the configured threshold', () => {
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

    expect(buildRenderPlan(parseResult).shouldInline(klass)).toBe(false);
  });

  it('does not inline user-defined classes and exposes import config', () => {
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
    };

    parseResult.classes.set(klass.id, klass);

    const renderPlan = buildRenderPlan(parseResult);

    expect(renderPlan.shouldInline(klass)).toBe(false);
    expect(renderPlan.getUserDefinedClass(klass)).toEqual({
      path: './userModel',
      exportName: 'MockUserType',
    });
  });

  it('does not inline operation classes', () => {
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

    expect(buildRenderPlan(parseResult).shouldInline(klass)).toBe(false);
  });

  it('skips all inline planning when disabled', () => {
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

    const renderPlan = buildRenderPlan(parseResult);

    expect(renderPlan.shouldInline(outputKlass)).toBe(false);
    expect(renderPlan.shouldInline(inputKlass)).toBe(false);
  });
});
