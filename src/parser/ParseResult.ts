import { ClassObject, UnionObject } from './types';
import { mergeClasses } from './merge';

export class ParseResult {
  classes: Map<string, ClassObject> = new Map();
  unions: Map<string, UnionObject> = new Map();

  addClass(klass: Omit<ClassObject, 'id'>): this {
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

  merge(otherParseResult: ParseResult): this {
    for (const klass of otherParseResult.classes.values()) {
      this.addClass(klass);
    }
    for (const union of otherParseResult.unions.values()) {
      this.addUnion(union);
    }
    return this;
  }
}
