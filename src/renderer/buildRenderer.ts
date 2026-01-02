import { ClassObject, FieldValue, GQLKind, ParseResult } from '../parser';

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

  // Handle arrays
  if (field.isList) {
    const itemPath = [...parentPath, field.name].join('.');
    // For user-defined classes, map and extract fields
    if (klass.userDefined) {
      const fieldsToRender = selectedFieldsFilter
        ? klass.outputs.filter((f) => selectedFieldsFilter.includes(f.name))
        : klass.selectedOutputs ?? klass.outputs;
      return `${field.name}: this.${itemPath}.map(${field.name.slice(0, -1)} => ({
      __typename: '${klass.name}',
      ${fieldsToRender.map((f) => `${f.name}: ${field.name.slice(0, -1)}.${f.name}`).join(',\n      ')}
    }))`;
    }
    // For builders, map and call build()
    if (!klass.shouldInline) {
      return `${field.name}: this.${itemPath}.map(item => item.build())`;
    }
    // For inlined types, map and render inline
    return `${field.name}: this.${itemPath}.map(item => ${renderBuildObject(
      klass,
      parseResult,
      ['item'],
      selectedFieldsFilter
    )})`;
  }

  if (klass.shouldInline) {
    return `${field.name}: ${renderBuildObject(
      klass,
      parseResult,
      [...parentPath, field.name],
      selectedFieldsFilter
    )}`;
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

  if (fieldsToRender.length === 0) {
    throw new Error(`Class "${klass.name}" has no output fields to render`);
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

  if (klass.outputs.length === 0) {
    throw new Error(`Operation "${klass.name}" has no output fields to render`);
  }

  const baseName = `${klass.name}${klass.operation}`;
  const requestParts = [
    `query: ${baseName}Document,`,
    renderBuildVariables(klass, parseResult),
  ].filter(Boolean);

  return `{
    request: {
      ${requestParts.join('\n      ')}
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
