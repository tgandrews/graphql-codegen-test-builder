import { ClassObject, FieldValue, GQLKind, ParseResult } from '../parser';
import { TYPE_DEFS } from './typeDefs';

export function getPickTypeName(
  queryName: string,
  fieldName: string,
  fieldTypeName: string
): string {
  return `${queryName}${fieldTypeName}Type`;
}

export function renderType(
  field: FieldValue,
  parseResult: ParseResult,
  queryContext?: ClassObject
): string {
  const typeDef = TYPE_DEFS[field.type.kind];
  // TODO: Fix this typing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let baseType = typeDef.renderType(field as any, parseResult);

  // If we're in a query context and this field has selectedFields, check if we need Pick type
  if (
    queryContext?.operation &&
    field.type.kind === GQLKind.Object &&
    field.selectedFields &&
    field.selectedFields.length > 0
  ) {
    const referencedTypeId = field.type.id;
    const referencedKlass = parseResult.classes.get(referencedTypeId);
    if (referencedKlass && referencedKlass.shouldInline && referencedKlass.selectedOutputs) {
      // Only use Pick type if selected fields differ from base type's fields
      const baseTypeFields = referencedKlass.selectedOutputs.map((f) => f.name).sort();
      const querySelectedFields = [...field.selectedFields].sort();
      const needsPickType =
        baseTypeFields.length !== querySelectedFields.length ||
        !baseTypeFields.every((f, i) => f === querySelectedFields[i]);

      if (needsPickType) {
        baseType = getPickTypeName(queryContext.name, field.name, field.type.name);
      }
    }
  }

  const nullableSuffix = field.type.nullable ? ' | null' : '';
  const arraySuffix = field.isList ? '[]' : '';
  return `${baseType}${arraySuffix}${nullableSuffix}`;
}

export function renderDefaultValue(
  field: FieldValue,
  parseResult: ParseResult,
  queryContext?: ClassObject
): string {
  // If this is an array, render it as an empty array
  if (field.isList) {
    return '[]';
  }

  // If this is an object with selected fields in a query context, check if we need custom rendering
  if (
    queryContext?.operation &&
    field.type.kind === GQLKind.Object &&
    field.selectedFields &&
    field.selectedFields.length > 0
  ) {
    const referencedTypeId = field.type.id;
    const klass = parseResult.classes.get(referencedTypeId);
    if (klass && klass.shouldInline && klass.selectedOutputs) {
      // Only render selected fields if they differ from base type's fields
      const baseTypeFields = klass.selectedOutputs.map((f) => f.name).sort();
      const querySelectedFields = [...field.selectedFields].sort();
      const needsCustomRender =
        baseTypeFields.length !== querySelectedFields.length ||
        !baseTypeFields.every((f, i) => f === querySelectedFields[i]);

      if (needsCustomRender) {
        const fieldsToRender = klass.outputs.filter((f) => field.selectedFields?.includes(f.name));
        return `{
          ${fieldsToRender
            .map((output) => `${output.name}: ${renderDefaultValue(output, parseResult)}`)
            .join(',\n          ')}
        }`;
      }
    }
  }

  const typeDef = TYPE_DEFS[field.type.kind];
  // TODO: Fix this typing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return typeDef.renderDefaultValue(field as any, parseResult, renderDefaultValue);
}
