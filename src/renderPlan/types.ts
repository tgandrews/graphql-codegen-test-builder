import { ClassObject } from '../parser';
import { UserDefinedClassConfig } from '../types';

export type ClassRenderPlan = {
  shouldInline: boolean;
  userDefined?: NonNullable<UserDefinedClassConfig>[string];
};

export type RenderPlan = {
  getClassPlan(klass: ClassObject): ClassRenderPlan;
  shouldInline(klass: ClassObject): boolean;
  getUserDefinedClass(klass: ClassObject): ClassRenderPlan['userDefined'];
};
