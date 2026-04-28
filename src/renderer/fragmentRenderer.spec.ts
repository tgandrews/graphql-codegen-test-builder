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

  it('should build nested fragment-backed object fields inside fragment builders', () => {
    parseResult.classes.set('Profile:output', {
      id: 'Profile:output',
      name: 'Profile',
      inputs: [],
      outputs: [createSimpleField('bio', GQLKind.String)],
      isInput: false,
      shouldInline: true,
      selectedOutputs: [createSimpleField('bio', GQLKind.String)],
    });
    parseResult.fragments.set('ProfileSummary', {
      id: 'ProfileSummary',
      name: 'ProfileSummary',
      typeName: 'Profile',
      outputs: [createSimpleField('bio', GQLKind.String)],
    });

    const fragment: FragmentObject = {
      id: 'UserSummary',
      name: 'UserSummary',
      typeName: 'User',
      outputs: [
        {
          name: 'profile',
          type: { kind: GQLKind.Object, name: 'Profile', id: 'Profile:output', nullable: false },
          selectedFields: ['bio'],
          fragmentSpreads: ['ProfileSummary'],
        },
      ],
    };

    const result = prettify(renderFragment(fragment, parseResult));

    expect(result).toContain('private profile: MockProfileSummaryFragmentBuilder =');
    expect(result).toContain('new MockProfileSummaryFragmentBuilder();');
    expect(result).toContain('profile: this.profile.build(),');
  });

  it('should build nullable nested fragment-backed singular fields safely', () => {
    parseResult.classes.set('Profile:output', {
      id: 'Profile:output',
      name: 'Profile',
      inputs: [],
      outputs: [createSimpleField('bio', GQLKind.String)],
      isInput: false,
      shouldInline: true,
      selectedOutputs: [createSimpleField('bio', GQLKind.String)],
    });
    parseResult.fragments.set('ProfileSummary', {
      id: 'ProfileSummary',
      name: 'ProfileSummary',
      typeName: 'Profile',
      outputs: [createSimpleField('bio', GQLKind.String)],
    });

    const fragment: FragmentObject = {
      id: 'UserSummary',
      name: 'UserSummary',
      typeName: 'User',
      outputs: [
        {
          name: 'profile',
          type: { kind: GQLKind.Object, name: 'Profile', id: 'Profile:output', nullable: true },
          selectedFields: ['bio'],
          fragmentSpreads: ['ProfileSummary'],
        },
      ],
    };

    const result = prettify(renderFragment(fragment, parseResult));

    expect(result).toContain('profile: this.profile?.build() ?? null,');
  });

  it('should build nullable nested fragment-backed list fields safely', () => {
    parseResult.classes.set('Profile:output', {
      id: 'Profile:output',
      name: 'Profile',
      inputs: [],
      outputs: [createSimpleField('bio', GQLKind.String)],
      isInput: false,
      shouldInline: true,
      selectedOutputs: [createSimpleField('bio', GQLKind.String)],
    });
    parseResult.fragments.set('ProfileSummary', {
      id: 'ProfileSummary',
      name: 'ProfileSummary',
      typeName: 'Profile',
      outputs: [createSimpleField('bio', GQLKind.String)],
    });

    const fragment: FragmentObject = {
      id: 'UserSummary',
      name: 'UserSummary',
      typeName: 'User',
      outputs: [
        {
          name: 'profiles',
          type: { kind: GQLKind.Object, name: 'Profile', id: 'Profile:output', nullable: true },
          isList: true,
          selectedFields: ['bio'],
          fragmentSpreads: ['ProfileSummary'],
        },
      ],
    };

    const result = prettify(renderFragment(fragment, parseResult));

    expect(result).toContain('profiles: this.profiles?.map((item) => item.build()) ?? null,');
  });
});
