export type Config = {
  // Allow for user defined classes to be injected into the generated code instead of generating
  // all classes from the schema. This assumes the user defined classes are a superset of the
  // generated ones. When no export name is provided, it is assumed to be a default export.
  userDefinedClasses?: Record<string, { path: string; exportName?: string }>;
};

export type UserDefinedClassConfig = Config['userDefinedClasses'];
