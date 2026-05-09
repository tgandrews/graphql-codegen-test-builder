import { ClassObject, FieldValue, GQLKind, ParseResult } from '../parser';
import { buildSelectionCatalogue, SelectionCatalogue } from '../selection';

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
  parentPath: string[],
  selectionCatalogue: SelectionCatalogue
): string {
  if (klass.outputs.length === 0) {
    throw new Error(`Class "${klass.name}" has no output fields to render`);
  }

  return `{
      ${klass.outputs
        .map((field) =>
          renderOutputField(field, parseResult, parentPath, undefined, selectionCatalogue)
        )
        .join(',\n      ')}
    }`;
}

function renderOutputField(
  field: FieldValue,
  parseResult: ParseResult,
  parentPath: string[] = [],
  selectedFieldsFilter?: string[],
  selectionCatalogue: SelectionCatalogue = buildSelectionCatalogue(parseResult)
): string {
  if (field.type.kind !== GQLKind.Object) {
    return `${field.name}: this.${[...parentPath, field.name].join('.')}`; // No need to call build() for non-object types
  }

  const strategy = selectionCatalogue.getObjectFieldStrategy(field);
  if (!strategy) {
    throw new Error(`Unable to resolve object field strategy for "${field.name}"`);
  }
  if (strategy.isInlineInput) {
    return `${field.name}: this.${[...parentPath, field.name].join('.')}`;
  }

  const itemPath = [...parentPath, field.name].join('.');
  const schemaTypeName = strategy.schemaTypeName;
  if (strategy.isSelectionBuilder) {
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

  if (strategy.isFragmentBacked) {
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
    if (strategy.isUserDefined) {
      const fieldsToRender = strategy.projectedFields;
      const itemName = 'item';
      return `${field.name}: this.${itemPath}.map(${itemName} => ({
      __typename: '${strategy.referencedClass.name}',
      ${fieldsToRender.map((f) => `${f.name}: ${itemName}.${f.name}`).join(',\n      ')}
    }))`;
    }
    // For builders, map and call build()
    if (!strategy.shouldInline) {
      return `${field.name}: this.${itemPath}.map(item => item.build())`;
    }
    // For inlined types, map and render inline
    return `${field.name}: this.${itemPath}.map(item => ${renderBuildObject(
      strategy.referencedClass,
      parseResult,
      ['item'],
      selectedFieldsFilter,
      selectionCatalogue
    )})`;
  }

  if (strategy.isUserDefined) {
    const baseObject = renderBuildObject(
      strategy.referencedClass,
      parseResult,
      [...parentPath, field.name],
      selectedFieldsFilter,
      selectionCatalogue
    );
    return `${field.name}: ${baseObject}`;
  }

  if (strategy.shouldInline) {
    const baseObject = renderBuildObject(
      strategy.referencedClass,
      parseResult,
      [...parentPath, field.name],
      selectedFieldsFilter,
      selectionCatalogue
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
  selectedFieldsFilter?: string[],
  selectionCatalogue: SelectionCatalogue = buildSelectionCatalogue(parseResult)
): string {
  if (klass.isInput) {
    if (klass.inputs.length === 0) {
      throw new Error(`Class "${klass.name}" has no input fields to render`);
    }

    return `{
      ${klass.inputs
        .map((field) =>
          renderOutputField(field, parseResult, parentPath, undefined, selectionCatalogue)
        )
        .join(',\n      ')}
    }`;
  }

  const fieldsToRender = selectionCatalogue.getFieldsToRender(klass, selectedFieldsFilter);

  if (fieldsToRender.length === 0) {
    throw new Error(`Class "${klass.name}" has no output fields to render`);
  }
  return `{
      __typename: '${klass.name}',
      ${fieldsToRender
        .map((field) =>
          renderOutputField(field, parseResult, parentPath, undefined, selectionCatalogue)
        )
        .join(',\n      ')}
    }`;
}

function renderBuildVariables(
  klass: ClassObject,
  parseResult: ParseResult,
  selectionCatalogue: SelectionCatalogue
): string {
  if (!klass.inputs.length) {
    return '';
  }
  return `variables: {
    ${klass.inputs
      .map((field) => renderOutputField(field, parseResult, [], undefined, selectionCatalogue))
      .join(',\n')}
  }`;
}

function renderOperationRequest(
  klass: ClassObject,
  parseResult: ParseResult,
  selectionCatalogue: SelectionCatalogue
): string {
  const baseName = `${klass.name}${klass.operation}`;
  const requestParts = [
    `query: ${baseName}Document,`,
    renderBuildVariables(klass, parseResult, selectionCatalogue),
  ].filter(Boolean);

  return `{
      ${requestParts.join('\n      ')}
    }`;
}

function renderOperationData(
  klass: ClassObject,
  parseResult: ParseResult,
  selectionCatalogue: SelectionCatalogue
): string {
  return `{
        __typename: '${klass.operation}',
        ${klass.outputs
          .map((field) =>
            renderOutputField(field, parseResult, [], field.selectedFields, selectionCatalogue)
          )
          .join(',\n        ')}
      }`;
}

function renderBuildResult(
  klass: ClassObject,
  parseResult: ParseResult,
  selectionCatalogue: SelectionCatalogue
): string {
  if (!klass.operation) {
    if (klass.isSelectionBuilder) {
      return renderSelectionBuilderObject(klass, parseResult, [], selectionCatalogue);
    }
    return renderBuildObject(klass, parseResult, [], undefined, selectionCatalogue);
  }

  if (klass.outputs.length === 0) {
    throw new Error(`Operation "${klass.name}" has no output fields to render`);
  }

  const request = renderOperationRequest(klass, parseResult, selectionCatalogue);
  const data = renderOperationData(klass, parseResult, selectionCatalogue);

  return `{
    request: ${request},
    ...(this.responseMode === 'networkError'
      ? { error: this.networkError ?? new Error('Network error') }
      : {}),
    ...(this.responseMode === 'serviceError'
      ? {
          result: {
            errors: this.serviceErrors,
            ...(this.includeServiceData ? { data: ${data} } : {})
          }
        }
      : {}),
    ...(this.responseMode === 'success' ? {
      result: {
        data: ${data}
      }
    } : {})
  }`;
}

export function renderBuild(
  klass: ClassObject,
  parseResult: ParseResult,
  selectionCatalogue: SelectionCatalogue = buildSelectionCatalogue(parseResult)
): string {
  return `build()${renderBuildReturnType(klass)} {
    return ${renderBuildResult(klass, parseResult, selectionCatalogue)} as const
  }`;
}
