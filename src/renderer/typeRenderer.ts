import { ClassObject, FieldValue, GQLKind, ParseResult } from '../parser';
import { buildSelectionCatalogue, SelectionCatalogue } from '../selection';
import { TYPE_DEFS } from './typeDefs';

export function isFragmentBackedField(field: FieldValue): boolean {
  return field.type.kind === GQLKind.Object && Boolean(field.fragmentSpreads?.length);
}

function getFragmentBuilderTypeNames(field: FieldValue): string[] {
  return (field.fragmentSpreads ?? []).map((fragmentName) => `Mock${fragmentName}FragmentBuilder`);
}

export function renderFragmentBackedFieldType(field: FieldValue): string {
  const fragmentBuilderTypes = getFragmentBuilderTypeNames(field);
  if (!fragmentBuilderTypes.length) {
    throw new Error(`Field "${field.name}" is not fragment-backed`);
  }

  if (field.isList) {
    const baseType =
      fragmentBuilderTypes.length === 1
        ? `${fragmentBuilderTypes[0]}[]`
        : `Array<${fragmentBuilderTypes.join(' | ')}>`;
    const nullableSuffix = field.type.nullable ? ' | null' : '';
    return `${baseType}${nullableSuffix}`;
  }

  const baseType =
    fragmentBuilderTypes.length === 1 ? fragmentBuilderTypes[0] : fragmentBuilderTypes.join(' | ');

  const nullableSuffix = field.type.nullable ? ' | null' : '';
  return `${baseType}${nullableSuffix}`;
}

export function renderFragmentBackedFieldDefaultValue(field: FieldValue): string {
  if (field.isList) {
    return '[]';
  }

  const [firstFragment] = field.fragmentSpreads ?? [];
  if (!firstFragment) {
    throw new Error(`Field "${field.name}" is not fragment-backed`);
  }

  return `new Mock${firstFragment}FragmentBuilder()`;
}

export function renderType(
  field: FieldValue,
  parseResult: ParseResult,
  queryContext?: ClassObject,
  selectionCatalogue: SelectionCatalogue = buildSelectionCatalogue(parseResult)
): string {
  if (isFragmentBackedField(field)) {
    return renderFragmentBackedFieldType(field);
  }

  if (field.type.kind === GQLKind.Object) {
    const resolvedField = selectionCatalogue.getResolvedObjectField(field, queryContext);
    if (!resolvedField) {
      throw new Error(`Unable to resolve object field for "${field.name}"`);
    }

    let baseType: string;
    switch (resolvedField.kind) {
      case 'user-defined':
        baseType =
          resolvedField.referencedClass.userDefined.exportName ||
          resolvedField.referencedClass.name;
        break;
      case 'inline':
      case 'inline-input':
        baseType = `Mock${field.type.name}Type`;
        break;
      case 'inline-pick':
        baseType = resolvedField.pickTypeName;
        break;
      case 'builder':
      case 'selection-builder':
        baseType = `Mock${resolvedField.referencedClass.name}Builder`;
        break;
      case 'fragment-backed':
        throw new Error(`Field "${field.name}" should have used fragment-backed type rendering`);
    }

    const nullableSuffix = field.type.nullable ? ' | null' : '';
    const arraySuffix = field.isList ? '[]' : '';
    return `${baseType}${arraySuffix}${nullableSuffix}`;
  }

  const typeDef = TYPE_DEFS[field.type.kind];
  // TODO: Fix this typing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const baseType = typeDef.renderType(field as any, parseResult);

  const nullableSuffix = field.type.nullable ? ' | null' : '';
  const arraySuffix = field.isList ? '[]' : '';
  return `${baseType}${arraySuffix}${nullableSuffix}`;
}

export function renderDefaultValue(
  field: FieldValue,
  parseResult: ParseResult,
  queryContext?: ClassObject,
  selectionCatalogue: SelectionCatalogue = buildSelectionCatalogue(parseResult)
): string {
  if (isFragmentBackedField(field)) {
    return renderFragmentBackedFieldDefaultValue(field);
  }

  if (field.type.kind === GQLKind.Object) {
    const resolvedField = selectionCatalogue.getResolvedObjectField(field, queryContext);
    if (!resolvedField) {
      throw new Error(`Unable to resolve object field for "${field.name}"`);
    }

    if (field.isList) {
      return '[]';
    }

    switch (resolvedField.kind) {
      case 'user-defined': {
        const fieldsToRender = resolvedField.referencedClass.outputs;
        return `{
          ${fieldsToRender
            .map(
              (output) =>
                `${output.name}: ${renderDefaultValue(
                  output,
                  parseResult,
                  undefined,
                  selectionCatalogue
                )}`
            )
            .join(',\n          ')}
        }`;
      }
      case 'inline':
      case 'inline-input':
      case 'inline-pick':
        return `{
          ${resolvedField.projectedFields
            .map(
              (output) =>
                `${output.name}: ${renderDefaultValue(
                  output,
                  parseResult,
                  undefined,
                  selectionCatalogue
                )}`
            )
            .join(',\n          ')}
        }`;
      case 'builder':
      case 'selection-builder':
        return `new Mock${resolvedField.referencedClass.name}Builder()`;
      case 'fragment-backed':
        throw new Error(`Field "${field.name}" should have used fragment-backed default rendering`);
    }
  }

  // If this is an array, render it as an empty array
  if (field.isList) {
    return '[]';
  }

  const typeDef = TYPE_DEFS[field.type.kind];
  // TODO: Fix this typing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return typeDef.renderDefaultValue(field as any, parseResult, renderDefaultValue);
}
