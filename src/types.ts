export type Config = {
  // Allow for user defined classes to be injected into the generated code instead of generating
  // all classes from the schema. This assumes the user defined classes are a superset of the
  // generated ones. When no export name is provided, it is assumed to be a default export.
  userDefinedClasses?: Record<string, { path: string; exportName?: string }>;
  // Disable optimiser-driven inlining entirely and always emit builder classes for generated types.
  enableOptimiser?: boolean;
  // Inline generated input object types whose field count is at or below this threshold.
  // Output object types are always inlined unless they are user-defined or operations.
  inlineFieldCountThreshold?: number;
};

export type UserDefinedClassConfig = Config['userDefinedClasses'];
