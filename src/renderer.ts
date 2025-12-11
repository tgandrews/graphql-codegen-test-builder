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
        const fieldsToRender = klass.isInput ? klass.inputs : klass.outputs;
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

const renderType = (field: FieldValue, parseResult: ParseResult): string => {
  const typeDef = TYPE_DEFS[field.type.kind];
  // TODO: Fix this typing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const baseType = typeDef.renderType(field as any, parseResult);
  const nullableSuffix = field.type.nullable ? ' | null' : '';
  return `${baseType}${nullableSuffix}`;
};

const renderDefaultValue = (field: FieldValue, parseResult: ParseResult): string => {
  const typeDef = TYPE_DEFS[field.type.kind];
  // TODO: Fix this typing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return typeDef.renderDefaultValue(field as any, parseResult);
};

const renderField = (field: FieldValue, parseResult: ParseResult): string => {
  const type = renderType(field, parseResult);
  const defaultValue = renderDefaultValue(field, parseResult);
  return `private ${field.name}:${type} = ${defaultValue}`;
};

const renderFunctionName = (prefix: string, name: string) => {
  return `${prefix}${capitalise(name)}`;
};

const renderSetter = (field: FieldValue, prefix: string, parseResult: ParseResult): string => {
  const type = renderType(field, parseResult);
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
  parentPath: string[] = []
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
    return `${field.name}: ${renderBuildObject(klass, parseResult, [...parentPath, field.name])}`;
  }
  return `${field.name}: this.${[...parentPath, field.name].join('.')}.build()`;
};

const renderBuildObject = (
  klass: ClassObject,
  parseResult: ParseResult,
  parentPath: string[]
): string => {
  // Use selectedOutputs if available (for result objects), otherwise use all outputs (for type definitions)
  const fieldsToRender = klass.selectedOutputs || klass.outputs;
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
        ${klass.outputs.map((field) => renderOutputField(field, parseResult))}
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
  const fieldsToRender = klass.isInput ? klass.inputs : klass.outputs;
  return `type ${name} = {
    ${fieldsToRender
      .map((field) => `${field.name}: ${renderType(field, parseResult)};`)
      .join('\n    ')}
  }`;
};

const renderClass = (klass: ClassObject, parseResult: ParseResult): string => {
  if (klass.shouldInline) {
    if (klass.operation) {
      throw new Error(`Attempting to inline operation: ${klass.name}`);
    }

    return renderClassAsType(klass, parseResult);
  }

  const className = `Mock${klass.name}${klass.operation ?? ''}Builder`;

  return `class ${className} {
    ${klass.inputs.map((field) => renderField(field, parseResult)).join('\n')}
    
    ${klass.outputs.map((field) => renderField(field, parseResult)).join('\n')}

    ${klass.inputs.map((field) => renderSetter(field, 'for', parseResult)).join('\n')}

    ${klass.outputs.map((field) => renderSetter(field, 'having', parseResult)).join('\n')}

    ${renderBuild(klass, parseResult)}
  }`;
};

const render = (parseResult: ParseResult): string => {
  const classes: string[] = [];
  parseResult.classes.forEach((klass) => classes.push(renderClass(klass, parseResult)));
  return classes.join('\n\n');
};

export default render;
