import { renderFragment } from './fragmentRenderer';
import { ParseResult } from '../parser/ParseResult';
import { FragmentObject, FieldValue, GQLKind, GQLType } from '../parser/types';
import { prettify } from '../test/helpers';

describe('fragmentRenderer', () => {
  let parseResult: ParseResult;

  beforeEach(() => {
    parseResult = new ParseResult({});
  });

  const createSimpleField = (name: string, kind: GQLKind, nullable = false): FieldValue => ({
    name,
    type: { kind, nullable } as GQLType,
  });

  it('should render a fragment builder with scalar fields', () => {
    const fragment: FragmentObject = {
      id: 'UserSummary',
      name: 'UserSummary',
      typeName: 'User',
      outputs: [
        createSimpleField('name', GQLKind.String),
        createSimpleField('email', GQLKind.String),
      ],
    };

    const result = prettify(renderFragment(fragment, parseResult));

    expect(result).toBe(`class MockUserSummaryFragmentBuilder {
  private name: string = "";

  private email: string = "";

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
      name: this.name,
      email: this.email,
    } as const;
  }
}
`);
  });
});
