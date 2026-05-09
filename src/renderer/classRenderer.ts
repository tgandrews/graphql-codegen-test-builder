import { ClassObject, GQLKind, ParseResult } from '../parser';
import { buildSelectionCatalogue, SelectionCatalogue } from '../selection';
import { renderType } from './typeRenderer';
import { renderField, renderSetter } from './fieldRenderer';
import { renderBuild } from './buildRenderer';
import { determineFieldsToRender } from './helpers';

function renderClassAsType(
  klass: ClassObject,
  parseResult: ParseResult,
  selectionCatalogue: SelectionCatalogue
): string {
  const name = `Mock${klass.name}Type`;
  const fieldsToRender = determineFieldsToRender(klass, selectionCatalogue);
  return `type ${name} = {
    ${fieldsToRender
      .map(
        (field) =>
          `${field.name}: ${renderType(field, parseResult, undefined, selectionCatalogue)};`
      )
      .join('\n' + Array(4).fill(' ').join(''))}
  }`;
}

function renderPickTypes(
  klass: ClassObject,
  parseResult: ParseResult,
  selectionCatalogue: SelectionCatalogue
): string[] {
  if (!klass.operation) return [];

  const pickTypes: string[] = [];
  for (const field of klass.outputs) {
    if (field.type.kind !== GQLKind.Object) {
      continue;
    }

    const resolvedField = selectionCatalogue.getResolvedObjectField(field, klass);
    if (resolvedField?.kind === 'inline-pick') {
      const pickTypeName = resolvedField.pickTypeName;
      const referencedKlass = parseResult.classes.get(field.type.id);
      if (!referencedKlass) {
        throw new Error(`Unable to find reference to "${field.type.id}" from "${field.name}"`);
      }
      const baseTypeName = `Mock${referencedKlass.name}Type`;
      const selectedFieldsStr = resolvedField.selectedFieldNames
        .map((selectedField) => `"${selectedField}"`)
        .join(', ');
      pickTypes.push(`type ${pickTypeName} = Pick<${baseTypeName}, ${selectedFieldsStr}>;`);
    }
  }
  return pickTypes;
}

function renderOperationResponseModeFields(klass: ClassObject): string[] {
  if (!klass.operation) return [];
  return [
    `private responseMode: 'success' | 'networkError' | 'serviceError' = 'success';`,
    `private networkError: Error | null = null;`,
    `private serviceErrors: readonly GraphQLErrorLike[] = [];`,
    `private includeServiceData = true;`,
  ];
}

function renderOperationResponseModeSetters(klass: ClassObject): string[] {
  if (!klass.operation) return [];
  return [
    `returningNetworkError(error: Error = new Error('Network error')): this {
    this.responseMode = 'networkError'
    this.networkError = error
    return this
  }`,
    `returningServiceError(
    errors: readonly GraphQLErrorLike[] | string,
    options: { includeData?: boolean } = {}
  ): this {
    this.responseMode = 'serviceError'
    this.serviceErrors = typeof errors === 'string' ? [{ message: errors }] : errors
    this.includeServiceData = options.includeData ?? true
    return this
  }`,
  ];
}

export function renderClass(
  klass: ClassObject,
  parseResult: ParseResult,
  selectionCatalogue: SelectionCatalogue = buildSelectionCatalogue(parseResult)
): string {
  if (klass.shouldInline) {
    if (klass.operation) {
      throw new Error(`Attempting to inline operation: ${klass.name}`);
    }

    return renderClassAsType(klass, parseResult, selectionCatalogue);
  }

  const className = `Mock${klass.name}${klass.operation ?? ''}Builder`;
  const pickTypes = renderPickTypes(klass, parseResult, selectionCatalogue);

  const inputFields = klass.inputs.map((field) =>
    renderField(field, parseResult, klass, selectionCatalogue)
  );
  const outputFields = klass.outputs.map((field) =>
    renderField(field, parseResult, klass, selectionCatalogue)
  );
  const responseModeFields = renderOperationResponseModeFields(klass);
  const responseModeSetters = renderOperationResponseModeSetters(klass);

  const inputSetters = klass.inputs.map((field) =>
    renderSetter(field, 'for', parseResult, klass, selectionCatalogue)
  );
  const outputSetters = klass.outputs.map((field) =>
    renderSetter(field, 'having', parseResult, klass, selectionCatalogue)
  );

  const buildMethod = renderBuild(klass, parseResult, selectionCatalogue);

  const parts: Array<string> = [
    inputFields.join('\n'),
    outputFields.join('\n'),
    responseModeFields.join('\n'),
    inputSetters.join('\n'),
    outputSetters.join('\n'),
    responseModeSetters.join('\n\n'),
    buildMethod,
  ];
  const combinedParts = parts.flat().join('\n\n');

  const classBody = `class ${className} {
${combinedParts}
  }`;

  return pickTypes.length > 0 ? pickTypes.join('\n\n') + '\n\n' + classBody : classBody;
}
