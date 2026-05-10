import { ClassObject, FieldValue, TransformResult } from '../transformer';
import { buildSelectionCatalogue, SelectionCatalogue } from '../transformer';
import { capitalise } from '../utils';
import { renderType, renderDefaultValue } from './typeRenderer';

function renderFunctionName(prefix: string, name: string): string {
  return `${prefix}${capitalise(name)}`;
}

export function renderField(
  field: FieldValue,
  parseResult: TransformResult,
  queryContext?: ClassObject,
  selectionCatalogue: SelectionCatalogue = buildSelectionCatalogue(parseResult)
): string {
  const type = renderType(field, parseResult, queryContext, selectionCatalogue);
  const defaultValue = renderDefaultValue(field, parseResult, queryContext, selectionCatalogue);
  return `private ${field.name}: ${type} = ${defaultValue}`;
}

export function renderSetter(
  field: FieldValue,
  prefix: string,
  parseResult: TransformResult,
  queryContext?: ClassObject,
  selectionCatalogue: SelectionCatalogue = buildSelectionCatalogue(parseResult)
): string {
  const type = renderType(field, parseResult, queryContext, selectionCatalogue);
  const name = field.name;
  return `${renderFunctionName(prefix, name)}(${name}: ${type}): this {
    this.${name} = ${name}
    return this
  }`;
}
