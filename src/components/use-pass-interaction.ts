"use client";

import {
  animate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import {
  type CSSProperties,
  type Dispatch,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";

type MaterialStyle = CSSProperties & Record<`--${string}`, string>;

export const restingMaterial: MaterialStyle = {
  "--light-x": "50%",
  "--light-y": "44%",
  "--grain-x": "0px",
  "--grain-y": "0px",
  "--shadow-x": "0px",
  "--shadow-y": "18px",
};

function setMaterialProperty(
  element: HTMLDivElement,
  property: `--${string}`,
  value: string,
) {
  element.style.setProperty(property, value);
}

interface UsePassInteractionOptions {
  flipped: boolean;
  setFlipped: Dispatch<SetStateAction<boolean>>;
}

/**
 * Owns the tactile side of the pass: hover light/grain/shadow tracking, drag
 * orbit, click/keyboard flip, and the lagged hologram reveal. Returns the
 * stage ref plus every motion value and handler the JSX needs.
 */
export function usePassInteraction({
  flipped,
  setFlipped,
}: UsePassInteractionOptions) {
  const [hovering, setHovering] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [dragging, setDragging] = useState(false);
  const suppressClickRef = useRef(false);
  const dragRef = useRef({
    pointerId: -1,
    startX: 0,
    startY: 0,
    baseTiltX: 0,
    baseTiltY: 0,
    moved: false,
  });
  const reduceMotion = Boolean(useReducedMotion());

  const interactionX = useMotionValue(0);
  const interactionY = useMotionValue(0);
  const tiltXSource = useMotionValue(0);
  const tiltYSource = useMotionValue(0);
  const tiltX = useSpring(tiltXSource, { stiffness: 210, damping: 28, mass: 0.55 });
  const tiltY = useSpring(tiltYSource, { stiffness: 210, damping: 28, mass: 0.55 });
  const flipProgress = useMotionValue(flipped ? 180 : 0);
  const lift = useTransform(flipProgress, [0, 90, 180], [0, -7, 0]);
  const scale = useTransform(flipProgress, [0, 90, 180], [1, 1.012, 1]);

  // The hologram reveal follows a heavier spring than the card itself, so the
  // foil catches up to the tilt a few frames late — like a laminate surface.
  const stageRef = useRef<HTMLDivElement>(null);
  const revealSource = useMotionValue(0);
  const revealLagged = useSpring(revealSource, { stiffness: 90, damping: 22, mass: 0.8 });

  useEffect(() => {
    return revealLagged.on("change", (value) => {
      const element = stageRef.current;
      if (!element) return;
      // Threshold, then smoothstep: face-on shows nothing, and past ~1/3 tilt
      // the logos ease in instead of switching on.
      const t = Math.min(1, Math.max(0, (value - 0.34) / 0.66));
      element.style.setProperty("--logo-reveal", (t * t * (3 - 2 * t)).toFixed(3));
    });
  }, [revealLagged]);

  useEffect(() => {
    if (reduceMotion) {
      flipProgress.set(0);
      setAnimating(false);
      return;
    }

    const target = flipped ? 180 : 0;
    if (Math.abs(flipProgress.get() - target) < 0.01) {
      setAnimating(false);
      return;
    }

    setAnimating(true);
    const controls = animate(flipProgress, target, {
      duration: 0.9,
      ease: [0.32, 0.05, 0.18, 1],
      onComplete: () => setAnimating(false),
    });

    return () => controls.stop();
  }, [flipProgress, flipped, reduceMotion]);

  const resetPointerMaterial = (element: HTMLDivElement) => {
    interactionX.set(0);
    interactionY.set(0);
    tiltXSource.set(0);
    tiltYSource.set(0);
    revealSource.set(0);
    setMaterialProperty(element, "--light-x", "50%");
    setMaterialProperty(element, "--light-y", "44%");
    setMaterialProperty(element, "--grain-x", "0px");
    setMaterialProperty(element, "--grain-y", "0px");
    setMaterialProperty(element, "--shadow-x", "0px");
    setMaterialProperty(element, "--shadow-y", "18px");
    setMaterialProperty(element, "--emboss-x", "0px");
    setMaterialProperty(element, "--emboss-y", "0px");
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (reduceMotion || event.button !== 0) return;
    dragRef.current = {
      pointerId: Number.isFinite(event.pointerId) ? event.pointerId : 1,
      startX: event.clientX,
      startY: event.clientY,
      baseTiltX: tiltXSource.get(),
      baseTiltY: tiltYSource.get(),
      moved: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragging(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (reduceMotion) return;

    if (dragRef.current.pointerId !== -1) {
      const deltaX = event.clientX - dragRef.current.startX;
      const deltaY = event.clientY - dragRef.current.startY;
      dragRef.current.moved = true;
      tiltXSource.set(
        Math.min(20, Math.max(-20, dragRef.current.baseTiltX - deltaY * 0.16)),
      );
      tiltYSource.set(
        Math.min(28, Math.max(-28, dragRef.current.baseTiltY + deltaX * 0.19)),
      );
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;

    const x = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    const y = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height));
    const normalX = x * 2 - 1;
    const normalY = y * 2 - 1;
    interactionX.set(normalX);
    interactionY.set(normalY);
    setHovering(true);

    if (dragRef.current.pointerId === -1 && event.pointerType !== "touch") {
      const intensity = animating ? 0.22 : 1;
      tiltXSource.set(normalY * -7.5 * intensity);
      tiltYSource.set(normalX * 7.5 * intensity);
    }

    setMaterialProperty(event.currentTarget, "--light-x", `${Math.round(x * 1000) / 10}%`);
    setMaterialProperty(event.currentTarget, "--light-y", `${Math.round(y * 1000) / 10}%`);
    setMaterialProperty(event.currentTarget, "--grain-x", `${normalX * 3}px`);
    setMaterialProperty(event.currentTarget, "--grain-y", `${normalY * 3}px`);
    setMaterialProperty(event.currentTarget, "--shadow-x", `${normalX * -30}px`);
    setMaterialProperty(event.currentTarget, "--shadow-y", `${18 + normalY * -14}px`);
    // Emboss: the type's highlight and shadow trade sides with the tilt, so
    // the letters read as pressed into the stock.
    setMaterialProperty(event.currentTarget, "--emboss-x", `${(-normalX * 0.9).toFixed(2)}px`);
    setMaterialProperty(event.currentTarget, "--emboss-y", `${(-normalY * 0.9).toFixed(2)}px`);
    revealSource.set(Math.min(1, Math.hypot(normalX, normalY)));
    // The reveal band points along the tilt, so the logos surface on the side
    // being turned toward the viewer and stay hidden on the far side.
    setMaterialProperty(
      event.currentTarget,
      "--reveal-angle",
      `${(Math.atan2(normalY, normalX) * (180 / Math.PI) - 90).toFixed(0)}deg`,
    );
  };

  const endOrbit = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current.pointerId === -1) return;
    suppressClickRef.current = dragRef.current.moved;
    if (Number.isFinite(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    dragRef.current.pointerId = -1;
    setDragging(false);
  };

  const handlePointerLeave = (event: ReactPointerEvent<HTMLDivElement>) => {
    setHovering(false);
    if (dragging) return;
    resetPointerMaterial(event.currentTarget);
  };

  const flipPass = () => {
    interactionX.set(0);
    interactionY.set(0);
    tiltXSource.set(0);
    tiltYSource.set(0);
    setFlipped((current) => !current);
  };

  const handleToggle = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    flipPass();
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    if (event.repeat) return;
    flipPass();
  };

  return {
    stageRef,
    reduceMotion,
    hovering,
    animating,
    dragging,
    interactionX,
    interactionY,
    tiltX,
    tiltY,
    tiltXSource,
    tiltYSource,
    flipProgress,
    lift,
    scale,
    revealSource,
    handlePointerDown,
    handlePointerMove,
    endOrbit,
    handlePointerLeave,
    handleToggle,
    handleKeyDown,
  };
}
