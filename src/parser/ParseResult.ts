import { ClassObject, FragmentObject, UnionObject } from './types';
import { mergeClasses } from './merge';
import { Config } from '../types';

export class ParseResult {
  classes: Map<string, ClassObject> = new Map();
  fragments: Map<string, FragmentObject> = new Map();
  unions: Map<string, UnionObject> = new Map();

  constructor(private readonly config: Config) {}

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

    this.fragments.set(fragment.name, {
      ...existingFragment,
      outputs: mergeClasses(
        {
          id: existingFragment.id,
          name: existingFragment.name,
          inputs: [],
          outputs: existingFragment.outputs,
          isInput: false,
        },
        {
          name: fragment.name,
          inputs: [],
          outputs: fragment.outputs,
          isInput: false,
        }
      ).outputs,
    });
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
