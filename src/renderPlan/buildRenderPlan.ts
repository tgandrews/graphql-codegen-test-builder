import { ClassObject, ParseResult } from '../parser';
import { ClassRenderPlan, RenderPlan } from './types';

const DEFAULT_INLINE_FIELD_COUNT_THRESHOLD = 3;

function shouldInlineGeneratedClass(klass: ClassObject, threshold: number): boolean {
  if (!klass.isInput) {
    return true;
  }

  return klass.inputs.length <= threshold;
}

export function buildRenderPlan(parseResult: ParseResult): RenderPlan {
  const config = parseResult.getConfig();
  const threshold = config.inlineFieldCountThreshold ?? DEFAULT_INLINE_FIELD_COUNT_THRESHOLD;
  const classPlans = new Map<string, ClassRenderPlan>();

  for (const klass of parseResult.classes.values()) {
    const userDefined = config.userDefinedClasses?.[klass.name];
    const shouldInline =
      config.enableOptimiser !== false &&
      !klass.operation &&
      !klass.isSelectionBuilder &&
      !userDefined &&
      shouldInlineGeneratedClass(klass, threshold);

    classPlans.set(klass.id, {
      shouldInline,
      userDefined,
    });
  }

  const getClassPlan = (klass: ClassObject): ClassRenderPlan => {
    const existingPlan = classPlans.get(klass.id);
    if (existingPlan) {
      return existingPlan;
    }

    return { shouldInline: false, userDefined: config.userDefinedClasses?.[klass.name] };
  };

  return {
    getClassPlan,
    shouldInline(klass: ClassObject): boolean {
      return getClassPlan(klass).shouldInline;
    },
    getUserDefinedClass(klass: ClassObject): ClassRenderPlan['userDefined'] {
      return getClassPlan(klass).userDefined;
    },
  };
}
