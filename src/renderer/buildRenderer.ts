import { ClassObject, FieldValue, GQLKind, ParseResult } from '../parser';
import { isFragmentBackedField } from './typeRenderer';

function renderBuildReturnType(klass: ClassObject): string {
  if (!klass.operation) {
    return '';
  }

  const baseName = `${klass.name}${klass.operation}`;
  return `: MockedResponse<${baseName}Response, ${baseName}Variables>`;
}

function renderSelectionBuilderObject(
  klass: ClassObject,
  parseResult: ParseResult,
  parentPath: string[]
): string {
  if (klass.outputs.length === 0) {
    throw new Error(`Class "${klass.name}" has no output fields to render`);
  }

  return `{
      ${klass.outputs
        .map((field) => renderOutputField(field, parseResult, parentPath))
        .join(',\n      ')}
    }`;
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

  const itemPath = [...parentPath, field.name].join('.');
  const schemaTypeName = field.schemaTypeName ?? klass.name;
  if (klass.isSelectionBuilder) {
    if (field.isList) {
      if (field.type.nullable) {
        return `${field.name}: this.${itemPath}?.map(item => ({
      __typename: '${schemaTypeName}',
      ...item.build()
    })) ?? null`;
      }
      return `${field.name}: this.${itemPath}.map(item => ({
      __typename: '${schemaTypeName}',
      ...item.build()
    }))`;
    }

    if (field.type.nullable) {
      return `${field.name}: this.${itemPath} == null ? null : {
      __typename: '${schemaTypeName}',
      ...this.${itemPath}.build()
    }`;
    }

    return `${field.name}: {
      __typename: '${schemaTypeName}',
      ...this.${itemPath}.build()
    }`;
  }

  if (isFragmentBackedField(field)) {
    if (field.isList) {
      if (field.type.nullable) {
        return `${field.name}: this.${itemPath}?.map(item => ({
      __typename: '${schemaTypeName}',
      ...item.build()
    })) ?? null`;
      }
      return `${field.name}: this.${itemPath}.map(item => ({
      __typename: '${schemaTypeName}',
      ...item.build()
    }))`;
    }

    if (field.type.nullable) {
      return `${field.name}: this.${itemPath} == null ? null : {
      __typename: '${schemaTypeName}',
      ...this.${itemPath}.build()
    }`;
    }

    return `${field.name}: {
      __typename: '${schemaTypeName}',
      ...this.${itemPath}.build()
    }`;
  }

  // Handle arrays
  if (field.isList) {
    // For user-defined classes, map and extract fields
    if (klass.userDefined) {
      const fieldsToRender = selectedFieldsFilter
        ? klass.outputs.filter((f) => selectedFieldsFilter.includes(f.name))
        : klass.selectedOutputs ?? klass.outputs;
      const itemName = 'item';
      return `${field.name}: this.${itemPath}.map(${itemName} => ({
      __typename: '${klass.name}',
      ${fieldsToRender.map((f) => `${f.name}: ${itemName}.${f.name}`).join(',\n      ')}
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

  if (klass.userDefined) {
    const baseObject = renderBuildObject(
      klass,
      parseResult,
      [...parentPath, field.name],
      selectedFieldsFilter
    );
    return `${field.name}: ${baseObject}`;
  }

  if (klass.shouldInline) {
    const baseObject = renderBuildObject(
      klass,
      parseResult,
      [...parentPath, field.name],
      selectedFieldsFilter
    );
    return `${field.name}: ${baseObject}`;
  }

  const builtValue = `this.${[...parentPath, field.name].join('.')}.build()`;
  return `${field.name}: ${builtValue}`;
}

function renderBuildObject(
  klass: ClassObject,
  parseResult: ParseResult,
  parentPath: string[],
  selectedFieldsFilter?: string[]
): string {
  if (klass.isInput) {
    if (klass.inputs.length === 0) {
      throw new Error(`Class "${klass.name}" has no input fields to render`);
    }

    return `{
      ${klass.inputs
        .map((field) => renderOutputField(field, parseResult, parentPath))
        .join(',\n      ')}
    }`;
  }

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

function renderOperationRequest(klass: ClassObject, parseResult: ParseResult): string {
  const baseName = `${klass.name}${klass.operation}`;
  const requestParts = [
    `query: ${baseName}Document,`,
    renderBuildVariables(klass, parseResult),
  ].filter(Boolean);

  return `{
      ${requestParts.join('\n      ')}
    }`;
}

function renderOperationData(klass: ClassObject, parseResult: ParseResult): string {
  return `{
        __typename: '${klass.operation}',
        ${klass.outputs
          .map((field) => renderOutputField(field, parseResult, [], field.selectedFields))
          .join(',\n        ')}
      }`;
}

function renderBuildResult(klass: ClassObject, parseResult: ParseResult): string {
  if (!klass.operation) {
    if (klass.isSelectionBuilder) {
      return renderSelectionBuilderObject(klass, parseResult, []);
    }
    return renderBuildObject(klass, parseResult, []);
  }

  if (klass.outputs.length === 0) {
    throw new Error(`Operation "${klass.name}" has no output fields to render`);
  }

  const request = renderOperationRequest(klass, parseResult);
  const data = renderOperationData(klass, parseResult);

  return `{
    request: ${request},
    ...(this.responseMode === 'networkError'
      ? { error: this.networkError ?? new Error('Network error') }
      : {}),
    ...(this.responseMode === 'success' ? {
      result: {
        data: ${data}
      }
    } : {})
  }`;
}

export function renderBuild(klass: ClassObject, parseResult: ParseResult): string {
  return `build()${renderBuildReturnType(klass)} {
    return ${renderBuildResult(klass, parseResult)} as const
  }`;
}
