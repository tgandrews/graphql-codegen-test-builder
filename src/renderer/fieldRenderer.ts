import { ClassObject, FieldValue, ParseResult } from '../parser';
import { capitalise } from '../utils';
import { renderType, renderDefaultValue } from './typeRenderer';

function renderFunctionName(prefix: string, name: string): string {
  return `${prefix}${capitalise(name)}`;
}

export function renderField(
  field: FieldValue,
  parseResult: ParseResult,
  queryContext?: ClassObject
): string {
  const type = renderType(field, parseResult, queryContext);
  const defaultValue = renderDefaultValue(field, parseResult, queryContext);
  return `private ${field.name}:${type} = ${defaultValue}`;
}

export function renderSetter(
  field: FieldValue,
  prefix: string,
  parseResult: ParseResult,
  queryContext?: ClassObject
): string {
  const type = renderType(field, parseResult, queryContext);
  const name = field.name;
  return `${renderFunctionName(prefix, name)}(${name}: ${type}): this {
    this.${name} = ${name}
    return this
  }`;
}
