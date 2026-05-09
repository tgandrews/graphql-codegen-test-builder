import { ParseResult } from './ParseResult';
import { FieldValue, GQLKind } from './types';

const stringField = (name: string, nullable = false): FieldValue => ({
  name,
  type: { kind: GQLKind.String, nullable },
});

describe('ParseResult', () => {
  it('registers and retrieves classes through the aggregate API', () => {
    const result = new ParseResult().addClass({
      name: 'User',
      inputs: [],
      outputs: [stringField('name')],
      isInput: false,
    });

    expect(result.hasClass('User:output')).toBe(true);
    expect(result.getOutputClass('User')?.name).toBe('User');
    expect(result.requireClass('User:output').outputs.map((field) => field.name)).toEqual(['name']);
  });

  it('registers and retrieves input classes through named helpers', () => {
    const result = new ParseResult().addClass({
      name: 'CreateUserInput',
      inputs: [stringField('name')],
      outputs: [],
      isInput: true,
    });

    expect(result.hasClass('CreateUserInput:input')).toBe(true);
    expect(result.getInputClass('CreateUserInput')?.inputs.map((field) => field.name)).toEqual([
      'name',
    ]);
    expect(result.requireInputClass('CreateUserInput').name).toBe('CreateUserInput');
  });

  it('registers and retrieves fragments and unions', () => {
    const result = new ParseResult()
      .addFragment({
        name: 'UserSummary',
        typeName: 'User',
        outputs: [stringField('name')],
      })
      .addUnion({
        name: 'Node',
        subTypes: ['User', 'Team'],
      });

    expect(result.hasFragment('UserSummary')).toBe(true);
    expect(result.getFragment('UserSummary')?.typeName).toBe('User');
    expect(result.hasUnion('Node')).toBe(true);
    expect(result.getUnion('Node')?.subTypes).toEqual(['User', 'Team']);
  });

  it('throws descriptive errors for missing classes', () => {
    const result = new ParseResult();

    expect(() => result.requireClass('Missing:output')).toThrow(
      'Unable to find class: Missing:output'
    );
    expect(() => result.requireOutputClass('Missing')).toThrow(
      'Unable to find output class: Missing'
    );
    expect(() => result.requireInputClass('Missing')).toThrow(
      'Unable to find input class: Missing'
    );
  });

  it('merges compatible duplicate classes through addClass', () => {
    const result = new ParseResult()
      .addClass({
        name: 'User',
        inputs: [],
        outputs: [stringField('name')],
        isInput: false,
      })
      .addClass({
        name: 'User',
        inputs: [],
        outputs: [stringField('email')],
        isInput: false,
      });

    expect(result.requireOutputClass('User').outputs.map((field) => field.name)).toEqual([
      'email',
      'name',
    ]);
  });

  it('throws for conflicting duplicate classes', () => {
    const result = new ParseResult().addClass({
      name: 'User',
      inputs: [],
      outputs: [stringField('name')],
      isInput: false,
    });

    expect(() =>
      result.addClass({
        name: 'User',
        inputs: [],
        outputs: [stringField('name')],
        isInput: false,
        operation: 'Query',
      })
    ).toThrow('Conflicting classes with the same name (User) but different types');
  });

  it('accepts equivalent duplicate fragments and rejects conflicting ones', () => {
    const result = new ParseResult().addFragment({
      name: 'UserSummary',
      typeName: 'User',
      outputs: [stringField('email'), stringField('name')],
    });

    result.addFragment({
      name: 'UserSummary',
      typeName: 'User',
      outputs: [stringField('name'), stringField('email')],
    });

    expect(() =>
      result.addFragment({
        name: 'UserSummary',
        typeName: 'User',
        outputs: [stringField('id')],
      })
    ).toThrow('Conflicting fragments with the same name (UserSummary)');
  });

  it('merges another aggregate and returns collection snapshots', () => {
    const left = new ParseResult().addClass({
      name: 'User',
      inputs: [],
      outputs: [stringField('name')],
      isInput: false,
    });
    const right = new ParseResult()
      .addClass({
        name: 'Profile',
        inputs: [],
        outputs: [stringField('bio')],
        isInput: false,
      })
      .addFragment({
        name: 'ProfileSummary',
        typeName: 'Profile',
        outputs: [stringField('bio')],
      });

    const merged = left.merge(right);
    const classes = merged.getClasses();

    expect(classes.map((klass) => klass.name)).toEqual(['User', 'Profile']);
    expect(merged.getFragments().map((fragment) => fragment.name)).toEqual(['ProfileSummary']);

    classes.pop();
    expect(merged.getClasses()).toHaveLength(2);
  });
});
