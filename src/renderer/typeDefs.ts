import { FieldValue, GQLKind, GQLType, TransformResult } from '../transformer';

type RenderableKind = Exclude<GQLKind, GQLKind.Object>;

type TypeDefMap<T extends GQLKind = RenderableKind> = {
  [K in T]: {
    renderDefaultValue(
      field: FieldValue & { type: Extract<GQLType, { kind: K }> },
      parseResult: TransformResult,
      renderDefaultValueFn?: (field: FieldValue, parseResult: TransformResult) => string
    ): string;
    renderType(
      field: FieldValue & { type: Extract<GQLType, { kind: K }> },
      parseResult: TransformResult
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
};
