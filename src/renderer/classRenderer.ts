import { ClassObject, GQLKind, ParseResult } from '../parser';
import { renderType, getPickTypeName } from './typeRenderer';
import { renderField, renderSetter } from './fieldRenderer';
import { renderBuild } from './buildRenderer';

function renderClassAsType(klass: ClassObject, parseResult: ParseResult): string {
  const name = `Mock${klass.name}Type`;
  const fieldsToRender = klass.isInput
    ? klass.inputs
    : klass.hasMultipleQueries && klass.selectedOutputs
      ? klass.selectedOutputs
      : klass.outputs;
  return `type ${name} = {
    ${fieldsToRender
      .map((field) => `${field.name}: ${renderType(field, parseResult)};`)
      .join('\n    ')}
  }`;
}

function renderPickTypes(klass: ClassObject, parseResult: ParseResult): string[] {
  if (!klass.operation) return [];

  const pickTypes: string[] = [];
  for (const field of klass.outputs) {
    if (
      field.type.kind === GQLKind.Object &&
      field.selectedFields &&
      field.selectedFields.length > 0
    ) {
      const referencedTypeId = field.type.id;
      const referencedKlass = parseResult.classes.get(referencedTypeId);
      if (referencedKlass && referencedKlass.shouldInline && referencedKlass.selectedOutputs) {
        // Only generate Pick type if selected fields are different from base type's selected outputs
        const baseTypeFields = referencedKlass.selectedOutputs.map((f) => f.name).sort();
        const querySelectedFields = [...field.selectedFields].sort();
        const needsPickType =
          baseTypeFields.length !== querySelectedFields.length ||
          !baseTypeFields.every((f, i) => f === querySelectedFields[i]);

        if (needsPickType) {
          const pickTypeName = getPickTypeName(klass.name, field.name, field.type.name);
          const baseTypeName = `Mock${field.type.name}Type`;
          const selectedFieldsStr = field.selectedFields.map((f) => `"${f}"`).join(', ');
          pickTypes.push(`type ${pickTypeName} = Pick<${baseTypeName}, ${selectedFieldsStr}>;`);
        }
      }
    }
  }
  return pickTypes;
}

export function renderClass(klass: ClassObject, parseResult: ParseResult): string {
  if (klass.shouldInline) {
    if (klass.operation) {
      throw new Error(`Attempting to inline operation: ${klass.name}`);
    }

    return renderClassAsType(klass, parseResult);
  }

  const className = `Mock${klass.name}${klass.operation ?? ''}Builder`;
  const pickTypes = renderPickTypes(klass, parseResult);

  const classBody = `class ${className} {
    ${klass.inputs.map((field) => renderField(field, parseResult, klass)).join('\n')}

    ${klass.outputs.map((field) => renderField(field, parseResult, klass)).join('\n')}

    ${klass.inputs.map((field) => renderSetter(field, 'for', parseResult, klass)).join('\n')}

    ${klass.outputs.map((field) => renderSetter(field, 'having', parseResult, klass)).join('\n')}

    ${renderBuild(klass, parseResult)}
  }`;

  return pickTypes.length > 0 ? pickTypes.join('\n\n') + '\n\n' + classBody : classBody;
}
