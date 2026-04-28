import { FieldValue, FragmentObject, GQLKind, ParseResult } from '../parser';
import { renderField, renderSetter } from './fieldRenderer';
import { isFragmentBackedField } from './typeRenderer';

function renderFragmentOutputField(
  field: FieldValue,
  parseResult: ParseResult,
  parentPath: string[] = []
): string {
  const fieldPath = [...parentPath, field.name].join('.');
  if (field.type.kind !== GQLKind.Object) {
    return `${field.name}: this.${fieldPath}`;
  }

  const klass = parseResult.classes.get(field.type.id);
  if (!klass) {
    throw new Error(`Unable to find reference to "${field.type.id}" from "${field.name}"`);
  }

  if (isFragmentBackedField(field)) {
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
    if (klass.shouldInline || klass.userDefined) {
      return `${field.name}: this.${fieldPath}`;
    }
    return `${field.name}: this.${fieldPath}.map(item => item.build())`;
  }

  if (klass.shouldInline || klass.userDefined) {
    return `${field.name}: this.${fieldPath}`;
  }

  return `${field.name}: this.${fieldPath}.build()`;
}

export function renderFragment(fragment: FragmentObject, parseResult: ParseResult): string {
  const className = `Mock${fragment.name}FragmentBuilder`;
  const fields = fragment.outputs.map((field) => renderField(field, parseResult));
  const setters = fragment.outputs.map((field) => renderSetter(field, 'having', parseResult));
  const buildFields = fragment.outputs.map((field) =>
    renderFragmentOutputField(field, parseResult)
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
