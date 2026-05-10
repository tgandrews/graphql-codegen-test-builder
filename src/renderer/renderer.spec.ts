import render from './index';
import { GQLKind, TransformResult } from '../transformer';

describe('renderer', () => {
  it('renders imports, type aliases, and builders from a transform result', () => {
    const result: TransformResult = {
      parsed: {
        schemaTypes: new Map(),
        operations: [],
        fragments: [],
      },
      imports: [],
      declarations: [],
      unions: [],
      fragments: [],
      userDefinedClasses: undefined,
      classes: [
        {
          id: 'User:output',
          name: 'User',
          inputs: [],
          outputs: [{ name: 'name', type: { kind: GQLKind.String, nullable: false } }],
          isInput: false,
          shouldInline: true,
        },
        {
          id: 'GetUser:input',
          name: 'GetUser',
          inputs: [],
          outputs: [
            {
              name: 'me',
              type: { kind: GQLKind.Object, name: 'User', id: 'User:output', nullable: false },
              selectedFields: ['name'],
            },
          ],
          isInput: true,
          operation: 'Query',
        },
      ],
    };

    const output = render(result);

    expect(output).toContain('type MockUserType = {');
    expect(output).toContain('class MockGetUserQueryBuilder {');
    expect(output).toContain(
      'build(): MockedResponse<GetUserQueryResponse, GetUserQueryVariables>'
    );
  });
});
