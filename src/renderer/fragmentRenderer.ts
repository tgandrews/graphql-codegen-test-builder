import { FieldValue, FragmentObject, GQLKind, ParseResult } from '../parser';
import { buildSelectionCatalogue, SelectionCatalogue } from '../selection';
import { renderField, renderSetter } from './fieldRenderer';

function renderFragmentOutputField(
  field: FieldValue,
  parseResult: ParseResult,
  parentPath: string[] = [],
  selectionCatalogue: SelectionCatalogue = buildSelectionCatalogue(parseResult)
): string {
  const fieldPath = [...parentPath, field.name].join('.');
  if (field.type.kind !== GQLKind.Object) {
    return `${field.name}: this.${fieldPath}`;
  }

  const resolvedField = selectionCatalogue.getResolvedObjectField(field);
  if (!resolvedField) {
    throw new Error(`Unable to resolve object field for "${field.name}"`);
  }

  if (resolvedField.kind === 'fragment-backed') {
    if (field.isList) {
      if (field.type.nullable) {
        return `${field.name}: this.${fieldPath}?.map(item => item.build()) ?? null`;
      }
      return `${field.name}: this.${fieldPath}.map(item => item.build())`;
    }
    if (field.type.nullable) {
      return `${field.name}: this.${fieldPath}?.build() ?? null`;
    }
    return `${field.name}: this.${fieldPath}.build()`;
  }

  if (field.isList) {
    if (
      resolvedField.kind === 'inline' ||
      resolvedField.kind === 'inline-input' ||
      resolvedField.kind === 'inline-pick' ||
      resolvedField.kind === 'user-defined'
    ) {
      if (field.type.nullable) {
        return `${field.name}: this.${fieldPath} ?? null`;
      }
      return `${field.name}: this.${fieldPath}`;
    }
    if (field.type.nullable) {
      return `${field.name}: this.${fieldPath}?.map(item => item.build()) ?? null`;
    }
    return `${field.name}: this.${fieldPath}.map(item => item.build())`;
  }

  if (
    resolvedField.kind === 'inline' ||
    resolvedField.kind === 'inline-input' ||
    resolvedField.kind === 'inline-pick' ||
    resolvedField.kind === 'user-defined'
  ) {
    if (field.type.nullable) {
      return `${field.name}: this.${fieldPath} ?? null`;
    }
    return `${field.name}: this.${fieldPath}`;
  }

  if (field.type.nullable) {
    return `${field.name}: this.${fieldPath}?.build() ?? null`;
  }
  return `${field.name}: this.${fieldPath}.build()`;
}

export function renderFragment(
  fragment: FragmentObject,
  parseResult: ParseResult,
  selectionCatalogue: SelectionCatalogue = buildSelectionCatalogue(parseResult)
): string {
  const className = `Mock${fragment.name}FragmentBuilder`;
  const fields = fragment.outputs.map((field) =>
    renderField(field, parseResult, undefined, selectionCatalogue)
  );
  const setters = fragment.outputs.map((field) =>
    renderSetter(field, 'having', parseResult, undefined, selectionCatalogue)
  );
  const buildFields = fragment.outputs.map((field) =>
    renderFragmentOutputField(field, parseResult, [], selectionCatalogue)
  );

  return `class ${className} {
${fields.join('\n\n')}

${setters.join('\n')}

  build() {
    return {
      ${buildFields.join(',\n      ')}
    } as const
  }
}`;
}
