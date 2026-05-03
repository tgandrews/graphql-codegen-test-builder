import { ClassObject, FragmentObject, UnionObject } from './types';
import { mergeClasses, mergeFieldValuesByName } from './merge';
import { Config } from '../types';

function normalizeStringArray(values?: string[]): string[] | undefined {
  if (!values?.length) {
    return undefined;
  }

  return [...values].sort();
}

function normalizeFragmentOutputs(fragment: FragmentObject): string {
  const normalizedOutputs = mergeFieldValuesByName(fragment.outputs)
    .map((field) => ({
      name: field.name,
      type: field.type,
      isList: field.isList,
      selectedFields: normalizeStringArray(field.selectedFields),
      fragmentSpreads: normalizeStringArray(field.fragmentSpreads),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  return JSON.stringify(normalizedOutputs);
}

export class ParseResult {
  classes: Map<string, ClassObject> = new Map();
  fragments: Map<string, FragmentObject> = new Map();
  unions: Map<string, UnionObject> = new Map();

  constructor(private readonly config: Config) {}

  getConfig(): Config {
    return this.config;
  }

  addClass(klass: Omit<ClassObject, 'id'>): this {
    // Apply user-defined class configuration
    const userDefinedClassConfig = this.config.userDefinedClasses?.[klass.name];
    if (userDefinedClassConfig) {
      klass.userDefined = userDefinedClassConfig;
    }

    const klassId = `${klass.name}:${klass.isInput ? 'input' : 'output'}`;
    const existingKlass = this.classes.get(klassId);

    if (!existingKlass) {
      this.classes.set(klassId, { ...klass, id: klassId });
      return this;
    }

    if (existingKlass.isInput !== klass.isInput || existingKlass.operation !== klass.operation) {
      throw new Error(`Conflicting classes with the same name (${klass.name}) but different types`);
    }

    // Merge the classes
    const mergedKlass = mergeClasses(existingKlass, klass);
    this.classes.set(klassId, mergedKlass);
    return this;
  }

  addUnion(union: UnionObject): this {
    if (this.unions.has(union.name)) {
      throw new Error(`Duplicate unions with the same name (${union.name})`);
    }
    this.unions.set(union.name, union);
    return this;
  }

  addFragment(fragment: Omit<FragmentObject, 'id'>): this {
    const existingFragment = this.fragments.get(fragment.name);
    if (!existingFragment) {
      this.fragments.set(fragment.name, { ...fragment, id: fragment.name });
      return this;
    }

    if (existingFragment.typeName !== fragment.typeName) {
      throw new Error(`Conflicting fragments with the same name (${fragment.name})`);
    }

    const incomingFragment: FragmentObject = { ...fragment, id: fragment.name };
    if (normalizeFragmentOutputs(existingFragment) !== normalizeFragmentOutputs(incomingFragment)) {
      throw new Error(`Conflicting fragments with the same name (${fragment.name})`);
    }

    return this;
  }

  merge(otherParseResult: ParseResult): this {
    for (const klass of otherParseResult.classes.values()) {
      this.addClass(klass);
    }
    for (const fragment of otherParseResult.fragments.values()) {
      this.addFragment(fragment);
    }
    for (const union of otherParseResult.unions.values()) {
      this.addUnion(union);
    }
    return this;
  }
}
