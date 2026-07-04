import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { arcMotionTokens, ARC_MOTION_EASE } from './arcMotionTokens';

let initialized = false;

export function ensureGsapSetup(): typeof gsap {
  if (!initialized) {
    gsap.registerPlugin(ScrollTrigger);
    gsap.defaults({
      duration: arcMotionTokens.base,
      ease: ARC_MOTION_EASE
    });
    initialized = true;
  }
  return gsap;
}

export { gsap, ScrollTrigger };
