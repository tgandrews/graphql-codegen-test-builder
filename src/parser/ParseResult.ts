import { ClassObject, FragmentObject, UnionObject } from './types';
import { mergeClasses, mergeFieldValuesByName } from './merge';

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
  private classes: Map<string, ClassObject> = new Map();
  private fragments: Map<string, FragmentObject> = new Map();
  private unions: Map<string, UnionObject> = new Map();

  getClass(id: string): ClassObject | undefined {
    return this.classes.get(id);
  }

  getFragment(name: string): FragmentObject | undefined {
    return this.fragments.get(name);
  }

  getUnion(name: string): UnionObject | undefined {
    return this.unions.get(name);
  }

  getClasses(): ClassObject[] {
    return Array.from(this.classes.values());
  }

  getFragments(): FragmentObject[] {
    return Array.from(this.fragments.values());
  }

  getUnions(): UnionObject[] {
    return Array.from(this.unions.values());
  }

  hasClass(id: string): boolean {
    return this.classes.has(id);
  }

  hasFragment(name: string): boolean {
    return this.fragments.has(name);
  }

  hasUnion(name: string): boolean {
    return this.unions.has(name);
  }

  getOutputClass(name: string): ClassObject | undefined {
    return this.getClass(`${name}:output`);
  }

  getInputClass(name: string): ClassObject | undefined {
    return this.getClass(`${name}:input`);
  }

  requireClass(id: string): ClassObject {
    const klass = this.getClass(id);
    if (!klass) {
      throw new Error(`Unable to find class: ${id}`);
    }
    return klass;
  }

  requireOutputClass(name: string): ClassObject {
    const klass = this.getOutputClass(name);
    if (!klass) {
      throw new Error(`Unable to find output class: ${name}`);
    }
    return klass;
  }

  requireInputClass(name: string): ClassObject {
    const klass = this.getInputClass(name);
    if (!klass) {
      throw new Error(`Unable to find input class: ${name}`);
    }
    return klass;
  }

  addClass(klass: Omit<ClassObject, 'id'>): this {
    const klassId = `${klass.name}:${klass.isInput ? 'input' : 'output'}`;
    const existingKlass = this.getClass(klassId);

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
    if (this.hasUnion(union.name)) {
      throw new Error(`Duplicate unions with the same name (${union.name})`);
    }
    this.unions.set(union.name, union);
    return this;
  }

  addFragment(fragment: Omit<FragmentObject, 'id'>): this {
    const existingFragment = this.getFragment(fragment.name);
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
    for (const klass of otherParseResult.getClasses()) {
      this.addClass(klass);
    }
    for (const fragment of otherParseResult.getFragments()) {
      this.addFragment(fragment);
    }
    for (const union of otherParseResult.getUnions()) {
      this.addUnion(union);
    }
    return this;
  }
}
