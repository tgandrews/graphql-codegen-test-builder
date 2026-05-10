import { renderFragment } from './fragmentRenderer';
import { FragmentObject, GQLKind, TransformResult } from '../transformer';
import { prettify } from '../test/helpers';

const baseTransformResult = (overrides: Partial<TransformResult> = {}): TransformResult => ({
  parsed: {
    schemaTypes: new Map(),
    operations: [],
    fragments: [],
  },
  imports: [],
  declarations: [],
  unions: [],
  fragments: [],
  classes: [],
  ...overrides,
});

describe('fragmentRenderer', () => {
  it('renders scalar fragment fields and setters', () => {
    const fragment: FragmentObject = {
      id: 'UserSummary',
      name: 'UserSummary',
      typeName: 'User',
      outputs: [
        { name: 'name', type: { kind: GQLKind.String, nullable: false } },
        { name: 'email', type: { kind: GQLKind.String, nullable: false } },
      ],
    };

    const result = prettify(renderFragment(fragment, baseTransformResult()));

    expect(result).toContain('class MockUserSummaryFragmentBuilder {');
    expect(result).toContain('private name: string = "";');
    expect(result).toContain('havingEmail(email: string): this {');
    expect(result).toContain('name: this.name,');
    expect(result).toContain('email: this.email,');
  });

  it('builds nested fragment-backed object fields through fragment builders', () => {
    const transformResult = baseTransformResult({
      classes: [
        {
          id: 'Profile:output',
          name: 'Profile',
          inputs: [],
          outputs: [{ name: 'bio', type: { kind: GQLKind.String, nullable: false } }],
          selectedOutputs: [{ name: 'bio', type: { kind: GQLKind.String, nullable: false } }],
          isInput: false,
          shouldInline: true,
        },
      ],
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
        {
          name: 'profiles',
          type: { kind: GQLKind.Object, name: 'Profile', id: 'Profile:output', nullable: true },
          isList: true,
          selectedFields: ['bio'],
          fragmentSpreads: ['ProfileSummary'],
        },
      ],
    };

    const result = prettify(renderFragment(fragment, transformResult));

    expect(result).toContain('private profile: MockProfileSummaryFragmentBuilder | null =');
    expect(result).toContain('profile: this.profile?.build() ?? null,');
    expect(result).toContain('private profiles: MockProfileSummaryFragmentBuilder[] | null = [];');
    expect(result).toContain('profiles: this.profiles?.map((item) => item.build()) ?? null,');
  });

  it('builds inline object fields by returning stored values directly', () => {
    const transformResult = baseTransformResult({
      classes: [
        {
          id: 'Profile:output',
          name: 'Profile',
          inputs: [],
          outputs: [{ name: 'bio', type: { kind: GQLKind.String, nullable: false } }],
          isInput: false,
          shouldInline: true,
        },
      ],
    });
    const fragment: FragmentObject = {
      id: 'UserSummary',
      name: 'UserSummary',
      typeName: 'User',
      outputs: [
        {
          name: 'profile',
          type: { kind: GQLKind.Object, name: 'Profile', id: 'Profile:output', nullable: true },
        },
        {
          name: 'profiles',
          type: { kind: GQLKind.Object, name: 'Profile', id: 'Profile:output', nullable: true },
          isList: true,
        },
      ],
    };

    const result = prettify(renderFragment(fragment, transformResult));

    expect(result).toContain('profile: this.profile ?? null,');
    expect(result).toContain('profiles: this.profiles ?? null,');
  });

  it('builds builder-backed object fields through build()', () => {
    const transformResult = baseTransformResult({
      classes: [
        {
          id: 'Profile:output',
          name: 'Profile',
          inputs: [],
          outputs: [{ name: 'bio', type: { kind: GQLKind.String, nullable: false } }],
          isInput: false,
        },
      ],
    });
    const fragment: FragmentObject = {
      id: 'UserSummary',
      name: 'UserSummary',
      typeName: 'User',
      outputs: [
        {
          name: 'profile',
          type: { kind: GQLKind.Object, name: 'Profile', id: 'Profile:output', nullable: true },
        },
        {
          name: 'profiles',
          type: { kind: GQLKind.Object, name: 'Profile', id: 'Profile:output', nullable: false },
          isList: true,
        },
      ],
    };

    const result = prettify(renderFragment(fragment, transformResult));

    expect(result).toContain('profile: this.profile?.build() ?? null,');
    expect(result).toContain('profiles: this.profiles.map((item) => item.build()),');
  });
});
