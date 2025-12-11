import { ClassObject, FieldValue, GQLKind, ParseResult } from '../parser';
import { renderDefaultValue } from './typeRenderer';

function renderBuildReturnType(klass: ClassObject): string {
  if (!klass.operation) {
    return '';
  }

  const baseName = `${klass.name}${klass.operation}`;
  return `: MockedResponse<${baseName}Response, ${baseName}Variables>`;
}

function renderOutputField(
  field: FieldValue,
  parseResult: ParseResult,
  parentPath: string[] = [],
  selectedFieldsFilter?: string[]
): string {
  if (field.type.kind !== GQLKind.Object) {
    return `${field.name}: this.${[...parentPath, field.name].join('.')}`; // No need to call build() for non-object types
  }

  const referencedTypeId = field.type.id;
  const klass = parseResult.classes.get(referencedTypeId);
  if (!klass) {
    throw new Error(`Unable to find reference to "${referencedTypeId}" from "${field.name}"`);
  }
  if (klass.shouldInline && klass.isInput) {
    return `${field.name}: this.${[...parentPath, field.name].join('.')}`;
  }
  if (klass.shouldInline) {
    return `${field.name}: ${renderBuildObject(klass, parseResult, [...parentPath, field.name], selectedFieldsFilter)}`;
  }
  return `${field.name}: this.${[...parentPath, field.name].join('.')}.build()`;
}

function renderBuildObject(
  klass: ClassObject,
  parseResult: ParseResult,
  parentPath: string[],
  selectedFieldsFilter?: string[]
): string {
  // Use selectedFieldsFilter if provided, otherwise use selectedOutputs or all outputs
  let fieldsToRender = klass.outputs;
  if (selectedFieldsFilter && selectedFieldsFilter.length > 0) {
    fieldsToRender = klass.outputs.filter((f) => selectedFieldsFilter.includes(f.name));
  } else if (klass.selectedOutputs) {
    fieldsToRender = klass.selectedOutputs;
  }
  return `{
      __typename: '${klass.name}',
      ${fieldsToRender
        .map((field) => renderOutputField(field, parseResult, parentPath))
        .join(',\n      ')}
    }`;
}

function renderBuildVariables(klass: ClassObject, parseResult: ParseResult): string {
  if (!klass.inputs.length) {
    return '';
  }
  return `variables: {
    ${klass.inputs.map((field) => renderOutputField(field, parseResult)).join(',\n')}
  }`;
}

function renderBuildResult(klass: ClassObject, parseResult: ParseResult): string {
  if (!klass.operation) {
    return renderBuildObject(klass, parseResult, []);
  }

  const baseName = `${klass.name}${klass.operation}`;
  return `{
    request: {
      query: ${baseName}Document,
      ${renderBuildVariables(klass, parseResult)}
    },
    result: {
      data: {
        __typename: '${klass.operation}',
        ${klass.outputs
          .map((field) => renderOutputField(field, parseResult, [], field.selectedFields))
          .join(',\n        ')}
      }
    }
  }`;
}

export function renderBuild(klass: ClassObject, parseResult: ParseResult): string {
  return `build()${renderBuildReturnType(klass)} {
    return ${renderBuildResult(klass, parseResult)} as const
  }`;
}
