import { FieldValue, GQLKind, GQLType, ParseResult } from '../parser';

type TypeDefMap<T extends GQLKind = GQLKind> = {
  [K in T]: {
    renderDefaultValue(
      field: FieldValue & { type: Extract<GQLType, { kind: K }> },
      parseResult: ParseResult,
      renderDefaultValueFn?: (field: FieldValue, parseResult: ParseResult) => string
    ): string;
    renderType(
      field: FieldValue & { type: Extract<GQLType, { kind: K }> },
      parseResult: ParseResult
    ): string;
  };
};

export const TYPE_DEFS: TypeDefMap = {
  [GQLKind.String]: {
    renderDefaultValue(field) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (field.type as any).nullable ? 'null' : `""`;
    },
    renderType() {
      return 'string';
    },
  },
  [GQLKind.Boolean]: {
    renderDefaultValue(field) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (field.type as any).nullable ? 'null' : 'false';
    },
    renderType() {
      return 'boolean';
    },
  },
  [GQLKind.Float]: {
    renderDefaultValue(field) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (field.type as any).nullable ? 'null' : '0.0';
    },
    renderType() {
      return 'number';
    },
  },
  [GQLKind.Int]: {
    renderDefaultValue(field) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (field.type as any).nullable ? 'null' : '0';
    },
    renderType() {
      return 'number';
    },
  },
  [GQLKind.Union]: {
    renderDefaultValue(field) {
      return field.type.name;
    },
    renderType(field) {
      return field.type.name;
    },
  },
  [GQLKind.Enum]: {
    renderDefaultValue(field) {
      return field.type.name;
    },
    renderType(field) {
      return field.type.name;
    },
  },
  [GQLKind.Object]: {
    renderDefaultValue(field, parseResult, renderDefaultValueFn) {
      const referencedTypeId = field.type.id;
      const klass = parseResult.classes.get(referencedTypeId);
      if (!klass) {
        throw new Error(`Unable to find reference to "${referencedTypeId}" from "${field.name}"`);
      }
      if (klass.shouldInline) {
        const fieldsToRender = klass.isInput
          ? klass.inputs
          : klass.hasMultipleQueries && klass.selectedOutputs
          ? klass.selectedOutputs
          : klass.outputs;
        if (!renderDefaultValueFn) {
          throw new Error('renderDefaultValueFn is required for Object type');
        }
        return `{
          ${fieldsToRender
            .map((output) => `${output.name}: ${renderDefaultValueFn(output, parseResult)}`)
            .join(',\n          ')}
        }`;
      }
      return `new Mock${klass.name}Builder()`;
    },
    renderType(field, parseResult) {
      const referencedTypeId = field.type.id;
      const klass = parseResult.classes.get(referencedTypeId);
      if (!klass) {
        throw new Error(`Unable to find reference to "${referencedTypeId}" from "${field.name}"`);
      }
      if (klass.shouldInline) {
        return `Mock${klass.name}Type`;
      }
      return `Mock${klass.name}Builder`;
    },
  },
};
