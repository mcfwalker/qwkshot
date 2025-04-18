import {
  easeLinear,
  easeQuadIn,
  easeQuadOut,
  easeQuadInOut,
  easeCubicIn,
  easeCubicOut,
  easeCubicInOut,
  easeExpIn,
  easeExpOut,
  easeExpInOut,
  easeCircleIn,
  easeCircleOut,
  easeCircleInOut,
  easeBackIn,
  easeBackOut,
  easeBackInOut,
  easeElasticIn,
  easeElasticOut,
  easeElasticInOut,
  easeBounceIn,
  easeBounceOut,
  easeBounceInOut
} from 'd3-ease';

// Define the map of easing functions for use in the application
export const easingFunctions = {
  // Linear
  linear: easeLinear,
  // Quad
  easeInQuad: easeQuadIn,
  easeOutQuad: easeQuadOut,
  easeInOutQuad: easeQuadInOut,
  // Cubic
  easeInCubic: easeCubicIn,
  easeOutCubic: easeCubicOut,
  easeInOutCubic: easeCubicInOut,
  // Exponential
  easeInExpo: easeExpIn,
  easeOutExpo: easeExpOut,
  easeInOutExpo: easeExpInOut,
  // Circular
  easeInCircle: easeCircleIn,
  easeOutCircle: easeCircleOut,
  easeInOutCircle: easeCircleInOut,
  // Back (overshoot)
  easeInBack: easeBackIn,
  easeOutBack: easeBackOut,
  easeInOutBack: easeBackInOut,
  // Elastic
  easeInElastic: easeElasticIn,
  easeOutElastic: easeElasticOut,
  easeInOutElastic: easeElasticInOut,
  // Bounce
  easeInBounce: easeBounceIn,
  easeOutBounce: easeBounceOut,
  easeInOutBounce: easeBounceInOut,
};

// Define the type for easing function names based on the keys of the map
export type EasingFunctionName = keyof typeof easingFunctions;

// Optional: Default easing function name
export const DEFAULT_EASING: EasingFunctionName = 'easeInOutQuad'; 