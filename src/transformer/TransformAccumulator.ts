import { Config } from '../types';
import { ClassObject, FragmentObject, TransformResult, UnionObject } from './types';
import { mergeClasses, mergeFieldValuesByName } from './merge';
import { ParsedDocument } from '../parser';

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

export class TransformAccumulator {
  private classes: Map<string, ClassObject> = new Map();
  private fragments: Map<string, FragmentObject> = new Map();
  private unions: Map<string, UnionObject> = new Map();

  constructor(private readonly config: Config) {}

  getClass(id: string): ClassObject | undefined {
    return this.classes.get(id);
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

  addClass(klass: Omit<ClassObject, 'id'>): this {
    const userDefined = this.config.userDefinedClasses?.[klass.name];
    const incoming = userDefined ? { ...klass, userDefined } : klass;
    const klassId = `${incoming.name}:${incoming.isInput ? 'input' : 'output'}`;
    const existingKlass = this.classes.get(klassId);

    if (!existingKlass) {
      this.classes.set(klassId, { ...incoming, id: klassId });
      return this;
    }

    if (
      existingKlass.isInput !== incoming.isInput ||
      existingKlass.operation !== incoming.operation
    ) {
      throw new Error(
        `Conflicting classes with the same name (${incoming.name}) but different types`
      );
    }

    this.classes.set(klassId, mergeClasses(existingKlass, incoming));
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

  merge(other: TransformAccumulator): this {
    for (const klass of other.getClasses()) {
      this.addClass(klass);
    }
    for (const fragment of other.getFragments()) {
      this.addFragment(fragment);
    }
    for (const union of other.getUnions()) {
      this.addUnion(union);
    }
    return this;
  }

  toTransformResult(parsed: ParsedDocument): TransformResult {
    return {
      parsed,
      imports: [],
      declarations: [],
      classes: this.getClasses(),
      fragments: this.getFragments(),
      unions: this.getUnions(),
      userDefinedClasses: this.config.userDefinedClasses,
    };
  }
}
