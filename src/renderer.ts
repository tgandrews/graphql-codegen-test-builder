import { ClassObject, FieldValue, GQLKind, GQLType, ParseResult } from './parser';
import { capitalise } from './utils';

type TypeDefMap<T extends GQLKind = GQLKind> = {
  [K in T]: {
    renderDefaultValue(
      field: FieldValue & { type: Extract<GQLType, { kind: K }> },
      parseResult: ParseResult
    ): string;
    renderType(
      field: FieldValue & { type: Extract<GQLType, { kind: K }> },
      parseResult: ParseResult
    ): string;
  };
};

const TYPE_DEFS: TypeDefMap = {
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
    renderDefaultValue(field, parseResult) {
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
        return `{
          ${fieldsToRender
            .map((output) => `${output.name}: ${renderDefaultValue(output, parseResult)}`)
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

const renderType = (
  field: FieldValue,
  parseResult: ParseResult,
  queryContext?: ClassObject
): string => {
  const typeDef = TYPE_DEFS[field.type.kind];
  // TODO: Fix this typing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let baseType = typeDef.renderType(field as any, parseResult);

  // If we're in a query context and this field has selectedFields, check if we need Pick type
  if (
    queryContext?.operation &&
    field.type.kind === GQLKind.Object &&
    field.selectedFields &&
    field.selectedFields.length > 0
  ) {
    const referencedTypeId = field.type.id;
    const referencedKlass = parseResult.classes.get(referencedTypeId);
    if (referencedKlass && referencedKlass.shouldInline && referencedKlass.selectedOutputs) {
      // Only use Pick type if selected fields differ from base type's fields
      const baseTypeFields = referencedKlass.selectedOutputs.map((f) => f.name).sort();
      const querySelectedFields = [...field.selectedFields].sort();
      const needsPickType =
        baseTypeFields.length !== querySelectedFields.length ||
        !baseTypeFields.every((f, i) => f === querySelectedFields[i]);

      if (needsPickType) {
        baseType = getPickTypeName(queryContext.name, field.name, field.type.name);
      }
    }
  }

  const nullableSuffix = field.type.nullable ? ' | null' : '';
  return `${baseType}${nullableSuffix}`;
};

const renderDefaultValue = (
  field: FieldValue,
  parseResult: ParseResult,
  queryContext?: ClassObject
): string => {
  // If this is an object with selected fields in a query context, check if we need custom rendering
  if (
    queryContext?.operation &&
    field.type.kind === GQLKind.Object &&
    field.selectedFields &&
    field.selectedFields.length > 0
  ) {
    const referencedTypeId = field.type.id;
    const klass = parseResult.classes.get(referencedTypeId);
    if (klass && klass.shouldInline && klass.selectedOutputs) {
      // Only render selected fields if they differ from base type's fields
      const baseTypeFields = klass.selectedOutputs.map((f) => f.name).sort();
      const querySelectedFields = [...field.selectedFields].sort();
      const needsCustomRender =
        baseTypeFields.length !== querySelectedFields.length ||
        !baseTypeFields.every((f, i) => f === querySelectedFields[i]);

      if (needsCustomRender) {
        const fieldsToRender = klass.outputs.filter((f) =>
          field.selectedFields?.includes(f.name)
        );
        return `{
          ${fieldsToRender
            .map((output) => `${output.name}: ${renderDefaultValue(output, parseResult)}`)
            .join(',\n          ')}
        }`;
      }
    }
  }

  const typeDef = TYPE_DEFS[field.type.kind];
  // TODO: Fix this typing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return typeDef.renderDefaultValue(field as any, parseResult);
};

const renderField = (
  field: FieldValue,
  parseResult: ParseResult,
  queryContext?: ClassObject
): string => {
  const type = renderType(field, parseResult, queryContext);
  const defaultValue = renderDefaultValue(field, parseResult, queryContext);
  return `private ${field.name}:${type} = ${defaultValue}`;
};

const renderFunctionName = (prefix: string, name: string) => {
  return `${prefix}${capitalise(name)}`;
};

const renderSetter = (
  field: FieldValue,
  prefix: string,
  parseResult: ParseResult,
  queryContext?: ClassObject
): string => {
  const type = renderType(field, parseResult, queryContext);
  const name = field.name;
  return `${renderFunctionName(prefix, name)}(${name}: ${type}): this {
    this.${name} = ${name}
    return this
  }`;
};

const renderBuildReturnType = (klass: ClassObject): string => {
  if (!klass.operation) {
    return '';
  }

  const baseName = `${klass.name}${klass.operation}`;
  return `: MockedResponse<${baseName}Response, ${baseName}Variables>`;
};

const renderOutputField = (
  field: FieldValue,
  parseResult: ParseResult,
  parentPath: string[] = [],
  selectedFieldsFilter?: string[]
): string => {
  if (field.type.kind !== GQLKind.Object) {
    return `${field.name}: this.${[...parentPath, field.name].join('.')}`; // No need to call build() for non-object types
  }

  const referencedTypeId = field.type.id;
  const klass = parseResult.classes.get(referencedTypeId);
  if (!klass) {
    throw new Error(`Unable to find reference to "${referencedTypeId}" from "${field.name}"`);
  }
  if (klass.shouldInline && klass.isInput) {
    return `${field.name}: this.${[...parentPath, field.name].join('.')}`;
  }
  if (klass.shouldInline) {
    return `${field.name}: ${renderBuildObject(klass, parseResult, [...parentPath, field.name], selectedFieldsFilter)}`;
  }
  return `${field.name}: this.${[...parentPath, field.name].join('.')}.build()`;
};

const renderBuildObject = (
  klass: ClassObject,
  parseResult: ParseResult,
  parentPath: string[],
  selectedFieldsFilter?: string[]
): string => {
  // Use selectedFieldsFilter if provided, otherwise use selectedOutputs or all outputs
  let fieldsToRender = klass.outputs;
  if (selectedFieldsFilter && selectedFieldsFilter.length > 0) {
    fieldsToRender = klass.outputs.filter((f) => selectedFieldsFilter.includes(f.name));
  } else if (klass.selectedOutputs) {
    fieldsToRender = klass.selectedOutputs;
  }
  return `{
      __typename: '${klass.name}',
      ${fieldsToRender
        .map((field) => renderOutputField(field, parseResult, parentPath))
        .join(',\n      ')}
    }`;
};

const renderBuildVariables = (klass: ClassObject, parseResult: ParseResult): string => {
  if (!klass.inputs.length) {
    return '';
  }
  return `variables: {
    ${klass.inputs.map((field) => renderOutputField(field, parseResult)).join(',\n')}
  }`;
};

const renderBuildResult = (klass: ClassObject, parseResult: ParseResult): string => {
  if (!klass.operation) {
    return renderBuildObject(klass, parseResult, []);
  }

  const baseName = `${klass.name}${klass.operation}`;
  return `{
    request: {
      query: ${baseName}Document,
      ${renderBuildVariables(klass, parseResult)}
    },
    result: {
      data: {
        __typename: '${klass.operation}',
        ${klass.outputs
          .map((field) => renderOutputField(field, parseResult, [], field.selectedFields))
          .join(',\n        ')}
      }
    }
  }`;
};

const renderBuild = (klass: ClassObject, parseResult: ParseResult): string => {
  return `build()${renderBuildReturnType(klass)} {
    return ${renderBuildResult(klass, parseResult)} as const
  }`;
};

const renderClassAsType = (klass: ClassObject, parseResult: ParseResult): string => {
  const name = `Mock${klass.name}Type`;
  const fieldsToRender = klass.isInput
    ? klass.inputs
    : klass.hasMultipleQueries && klass.selectedOutputs
      ? klass.selectedOutputs
      : klass.outputs;
  return `type ${name} = {
    ${fieldsToRender
      .map((field) => `${field.name}: ${renderType(field, parseResult)};`)
      .join('\n    ')}
  }`;
};

const getPickTypeName = (queryName: string, fieldName: string, fieldTypeName: string): string => {
  return `${queryName}${fieldTypeName}Type`;
};

const renderPickTypes = (klass: ClassObject, parseResult: ParseResult): string[] => {
  if (!klass.operation) return [];

  const pickTypes: string[] = [];
  for (const field of klass.outputs) {
    if (
      field.type.kind === GQLKind.Object &&
      field.selectedFields &&
      field.selectedFields.length > 0
    ) {
      const referencedTypeId = field.type.id;
      const referencedKlass = parseResult.classes.get(referencedTypeId);
      if (referencedKlass && referencedKlass.shouldInline && referencedKlass.selectedOutputs) {
        // Only generate Pick type if selected fields are different from base type's selected outputs
        const baseTypeFields = referencedKlass.selectedOutputs.map((f) => f.name).sort();
        const querySelectedFields = [...field.selectedFields].sort();
        const needsPickType =
          baseTypeFields.length !== querySelectedFields.length ||
          !baseTypeFields.every((f, i) => f === querySelectedFields[i]);

        if (needsPickType) {
          const pickTypeName = getPickTypeName(klass.name, field.name, field.type.name);
          const baseTypeName = `Mock${field.type.name}Type`;
          const selectedFieldsStr = field.selectedFields.map((f) => `"${f}"`).join(', ');
          pickTypes.push(`type ${pickTypeName} = Pick<${baseTypeName}, ${selectedFieldsStr}>;`);
        }
      }
    }
  }
  return pickTypes;
};

const renderClass = (klass: ClassObject, parseResult: ParseResult): string => {
  if (klass.shouldInline) {
    if (klass.operation) {
      throw new Error(`Attempting to inline operation: ${klass.name}`);
    }

    return renderClassAsType(klass, parseResult);
  }

  const className = `Mock${klass.name}${klass.operation ?? ''}Builder`;
  const pickTypes = renderPickTypes(klass, parseResult);

  const classBody = `class ${className} {
    ${klass.inputs.map((field) => renderField(field, parseResult, klass)).join('\n')}

    ${klass.outputs.map((field) => renderField(field, parseResult, klass)).join('\n')}

    ${klass.inputs.map((field) => renderSetter(field, 'for', parseResult, klass)).join('\n')}

    ${klass.outputs.map((field) => renderSetter(field, 'having', parseResult, klass)).join('\n')}

    ${renderBuild(klass, parseResult)}
  }`;

  return pickTypes.length > 0 ? pickTypes.join('\n\n') + '\n\n' + classBody : classBody;
};

const render = (parseResult: ParseResult): string => {
  const classes: string[] = [];
  parseResult.classes.forEach((klass) => classes.push(renderClass(klass, parseResult)));
  return classes.join('\n\n');
};

export default render;
