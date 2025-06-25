import { ClassObject, FieldValue, GQLKind, GQLType, ParseResult } from './parser'

const renderDefaultValue = (type: GQLType): string => {
  switch (type.kind) {
    case GQLKind.String:
      return 'string'
    case GQLKind.Boolean:
      return 'boolean'
    case GQLKind.Int:
      return 'number'
    case GQLKind.Float:
      return 'number'
    case GQLKind.Union:
      return type.name
    case GQLKind.Enum:
      return type.name
    case GQLKind.Object:
      return `new Mock${type.name}Builder()`
    default:
      throw new Error(`Unknown type: ${type}`)
  }
}

const renderType = (type: GQLType): string => {
  switch (type.kind) {
    case GQLKind.String:
      return `''`
    case GQLKind.Boolean:
      return 'false'
    case GQLKind.Int:
      return '0'
    case GQLKind.Float:
      return '0'
    case GQLKind.Union:
      return type.name
    case GQLKind.Enum:
      return type.name
    case GQLKind.Object:
      return `Mock${type.name}Builder`
    default:
      throw new Error(`Unknown type: ${type}`)
  }
}

const renderField = (field: FieldValue): string => {
  const type = renderType(field.gqlType)
  const defaultValue = renderDefaultValue(field.gqlType)
  return `private ${field.name}:${type} = ${defaultValue}`
}

const renderSetter = (field: FieldValue, prefix: string): string => {
  const type = renderType(field.gqlType)
  const name = field.name
  return `${prefix}${name}(${name}: ${type}): this {
    this.${name} = ${name}
    return this
  }`
}

const renderBuildReturnType = (klass: ClassObject): string => {
  if (!klass.operation) {
    return ''
  }

  const baseName = `${klass.name}${klass.operation}`
  return `: MockedResponse<${baseName}Response, ${baseName}Variables>`
}

const renderOutputField = (field: FieldValue): string => {
  const suffix = field.gqlType.kind === 'object' ? '.build()' : ''
  return `${field.name}: this.${field.name}${suffix}`
}

const renderBuildObject = (klass: ClassObject): string => {
    return `{
      __typename: '${klass.name}',
      ${klass.outputs.map((field) => renderOutputField(field))}
    } as const`
}

const renderBuildResult = (klass: ClassObject): string => {
  if (!klass.operation) {
    return renderBuildObject(klass)
  }
  
  const baseName = `${klass.name}${klass.operation}`
  return `{
    request: {
      query: ${baseName}Document,
    },
    result: {
      data: {
        __typename: '${klass.operation}',
        ${klass.name}: ${renderBuildObject(klass)}
      }
    }
  } as const`
}

const renderBuild = (klass: ClassObject): string => {
  return `build()${renderBuildReturnType(klass)} {
    return ${renderBuildResult(klass)}
  }`
}

const renderClass = (klass: ClassObject): string => {
  const className = `Mock${klass.name}${klass.operation ?? ''}Builder`
  return `class ${className} {
    ${klass.inputs.map((field) => renderField(field)).join('\n')}
    ${klass.outputs.map((field) => renderField(field)).join('\n')}

    ${klass.inputs.map((field) => renderSetter(field, 'for')).join('\n')}
    ${klass.outputs.map((field) => renderSetter(field, 'having')).join('\n')}

    ${renderBuild(klass)}
  }`
}

const render = (parseResult: ParseResult): string => {
  const classes: string[] = []
  parseResult.classes.forEach((klass) => classes.push(renderClass(klass)))
  return classes.join('\n')
}

export default render