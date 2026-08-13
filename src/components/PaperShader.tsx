"use client";

import { type MotionValue, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import styles from "./paper-shader.module.css";

const vertexShaderSource = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

export const paperFragmentShaderSource = `#version 300 es
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uPointer;
uniform vec2 uFoil;
uniform float uAngle;
uniform float uSpeed;
out vec4 outColor;

float hash21(vec2 point) {
  vec3 p3 = fract(vec3(point.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float valueNoise(vec2 point) {
  vec2 cell = floor(point);
  vec2 local = fract(point);
  local = local * local * (3.0 - 2.0 * local);
  float a = hash21(cell);
  float b = hash21(cell + vec2(1.0, 0.0));
  float c = hash21(cell + vec2(0.0, 1.0));
  float d = hash21(cell + vec2(1.0, 1.0));
  return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
}

float fbm(vec2 point) {
  float value = 0.0;
  float amplitude = 0.52;
  mat2 turn = mat2(0.78, -0.63, 0.63, 0.78);
  for (int octave = 0; octave < 4; octave++) {
    value += amplitude * valueNoise(point);
    point = turn * point * 2.04 + 13.17;
    amplitude *= 0.47;
  }
  return value;
}

float softBlob(vec2 point, vec2 center, vec2 radius) {
  vec2 delta = (point - center) / radius;
  return exp(-dot(delta, delta) * 1.65);
}

vec3 spectrum(float phase) {
  return 0.56 + 0.44 * cos(6.2831853 * (phase + vec3(0.0, 0.34, 0.67)));
}

void main() {
  vec2 uv = gl_FragCoord.xy / max(uResolution, vec2(1.0));
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 point = (uv - 0.5) * vec2(aspect, 1.0);
  float time = uTime * 1.5;

  vec2 flowOffset = vec2(
    fbm(point * 1.42 + vec2(time * 0.19, -time * 0.15)),
    fbm(point * 1.42 + vec2(-time * 0.13, time * 0.21) + 31.4)
  ) - 0.5;
  vec2 warp = vec2(
    fbm(point * 2.35 + flowOffset * 2.8 + vec2(time * 0.11, time * 0.07) + 5.2),
    fbm(point * 2.35 + flowOffset * 2.8 + vec2(-time * 0.09, time * 0.13) + 9.7)
  ) - 0.5;
  vec2 organicPoint = point + flowOffset * 0.27 + warp * 0.16 + uFoil * vec2(0.17, -0.12);

  float angle = time * 0.34 + sin(time * 0.25) * 0.76;
  vec2 direction = vec2(cos(angle), sin(angle));
  vec2 normal = vec2(-direction.y, direction.x);
  float sweepPosition = sin(time * 0.82) * aspect * 0.43;
  float ribbonCurve = 0.17 * sin(dot(organicPoint, normal) * 2.65 + time * 0.62);
  float ribbonDistance = abs(dot(organicPoint, direction) - sweepPosition + ribbonCurve);
  float ribbon = smoothstep(0.5, 0.045, ribbonDistance);

  vec2 centerA = vec2(
    sin(time * 0.86) * aspect * 0.48,
    cos(time * 1.08) * 0.44
  );
  vec2 centerB = vec2(
    cos(time * 0.63 + 1.8) * aspect * 0.54,
    sin(time * 0.93 + 0.7) * 0.51
  );
  vec2 centerC = vec2(
    sin(time * 0.48 + 3.2) * aspect * 0.6,
    cos(time * 0.74 + 2.1) * 0.48
  );

  float glowA = softBlob(organicPoint, centerA, vec2(0.74, 0.48));
  float glowB = softBlob(organicPoint, centerB, vec2(1.0, 0.61));
  float shade = softBlob(organicPoint, centerC, vec2(0.86, 0.56));
  float lightField = clamp(ribbon * 0.64 + glowA * 0.84 + glowB * 0.56, 0.0, 1.0);

  float pulp = fbm(point * 5.6 + warp * 1.6 + vec2(time * 0.075, -time * 0.06));
  float grainFrame = floor(uTime * 30.0);
  float staticGrain = hash21(floor(gl_FragCoord.xy)) - 0.5;
  float movingGrain = hash21(
    floor(gl_FragCoord.xy) + mod(vec2(grainFrame * 37.17, grainFrame * 19.73), 512.0)
  ) - 0.5;
  float fineGrain = mix(staticGrain, movingGrain, 0.62);

  vec3 deepNavy = vec3(0.04, 0.09, 0.165);
  vec3 darkSlate = vec3(0.095, 0.235, 0.355);
  vec3 tealGlow = vec3(0.235, 0.5, 0.64);
  vec3 softTeal = vec3(0.5, 0.74, 0.84);
  vec3 paleTeal = vec3(0.78, 0.92, 0.97);

  vec3 color = mix(deepNavy, darkSlate, 0.55 + pulp * 0.34);
  color = mix(color, tealGlow, lightField * 0.69);
  color = mix(color, softTeal, pow(lightField, 1.58) * 0.58);
  color = mix(color, paleTeal, pow(glowA * ribbon, 1.2) * 0.35);
  color *= 1.0 - shade * 0.19;

  float angleEnergy = abs(sin(radians(uAngle)));
  float inputEnergy = clamp(length(uPointer) * 0.75 + uSpeed * 1.8, 0.0, 1.0);
  float holoAmount = clamp(angleEnergy * 0.8 + inputEnergy * 0.72, 0.0, 1.0);
  float foilPhase = dot(uv, vec2(1.7, -1.25)) + dot(uFoil, vec2(0.7, -0.5)) + time * 0.1;
  vec3 holoColor = spectrum(foilPhase + flowOffset.x * 0.22);
  float foilGate = smoothstep(0.16, 0.88, lightField) * (0.58 + glowA * 0.42);
  color = mix(color, mix(color, holoColor, 0.76), holoAmount * foilGate * 0.34);

  color += fineGrain * (0.17 + lightField * 0.085);
  color += (pulp - 0.5) * 0.1;
  outColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}`;

interface ShaderController {
  start: () => void;
  stop: () => void;
  renderOnce: () => void;
  dispose: () => void;
}

/**
 * Events the share/download capture uses to make the exported PNG
 * deterministic: every shader pauses its animation loop and renders one fixed
 * "beauty frame" (light ribbon over the stub), so the capture never reads a
 * blank buffer or a dark phase of the loop. `detail.timeMs` overrides the
 * frame time (used by tooling to pick the constant).
 */
export const PASS_EXPORT_PREPARE_EVENT = "ao-pass:export-prepare";
export const PASS_EXPORT_RELEASE_EVENT = "ao-pass:export-release";
/** uTime (ms) of the fixed export frame: light ribbon sits over the stub. */
export const PASS_EXPORT_FRAME_TIME = 700;

interface PaperShaderProps {
  active: boolean;
  interactionX?: MotionValue<number>;
  interactionY?: MotionValue<number>;
  rotation?: MotionValue<number>;
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function PaperShader({
  active,
  interactionX,
  interactionY,
  rotation,
}: PaperShaderProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<ShaderController | null>(null);
  const targetRef = useRef({ x: 0, y: 0, angle: 0 });
  const activeRef = useRef(active);
  const reduceMotion = Boolean(useReducedMotion());
  activeRef.current = active;

  useEffect(() => {
    const unsubscribeX = interactionX?.on("change", (value) => {
      targetRef.current.x = value;
    });
    const unsubscribeY = interactionY?.on("change", (value) => {
      targetRef.current.y = value;
    });
    const unsubscribeRotation = rotation?.on("change", (value) => {
      targetRef.current.angle = value;
    });

    return () => {
      unsubscribeX?.();
      unsubscribeY?.();
      unsubscribeRotation?.();
    };
  }, [interactionX, interactionY, rotation]);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;

    let gl: WebGL2RenderingContext | null = null;
    try {
      gl = canvas.getContext("webgl2", {
        alpha: true,
        antialias: false,
        depth: false,
        powerPreference: "high-performance",
        premultipliedAlpha: false,
        // Lets the share capture read the rendered frame back as an image.
        preserveDrawingBuffer: true,
      });
    } catch {
      gl = null;
    }
    if (!gl) return;

    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, paperFragmentShaderSource);
    const program = gl.createProgram();
    if (!vertexShader || !fragmentShader || !program) {
      if (vertexShader) gl.deleteShader(vertexShader);
      if (fragmentShader) gl.deleteShader(fragmentShader);
      if (program) gl.deleteProgram(program);
      return;
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return;
    }

    const buffer = gl.createBuffer();
    const positionLocation = gl.getAttribLocation(program, "aPosition");
    const timeLocation = gl.getUniformLocation(program, "uTime");
    const resolutionLocation = gl.getUniformLocation(program, "uResolution");
    const pointerLocation = gl.getUniformLocation(program, "uPointer");
    const foilLocation = gl.getUniformLocation(program, "uFoil");
    const angleLocation = gl.getUniformLocation(program, "uAngle");
    const speedLocation = gl.getUniformLocation(program, "uSpeed");
    if (
      !buffer ||
      positionLocation < 0 ||
      !timeLocation ||
      !resolutionLocation ||
      !pointerLocation ||
      !foilLocation ||
      !angleLocation ||
      !speedLocation
    ) {
      if (buffer) gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    gl.useProgram(program);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    let frame = 0;
    let running = false;
    let lastDraw = -Infinity;
    let disposed = false;
    const material = { x: 0, y: 0, foilX: 0, foilY: 0, speed: 0 };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
    };

    const draw = (time = performance.now()) => {
      if (disposed) return;
      resize();
      const previousX = material.x;
      const previousY = material.y;
      const follow = reduceMotion ? 1 : 0.18;
      const foilFollow = reduceMotion ? 1 : 0.065;
      material.x += (targetRef.current.x - material.x) * follow;
      material.y += (targetRef.current.y - material.y) * follow;
      material.foilX += (targetRef.current.x - material.foilX) * foilFollow;
      material.foilY += (targetRef.current.y - material.foilY) * foilFollow;
      const velocity = Math.hypot(material.x - previousX, material.y - previousY);
      material.speed += (Math.min(1, velocity * 11) - material.speed) * 0.2;

      gl.useProgram(program);
      gl.uniform1f(timeLocation, time * 0.001);
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      gl.uniform2f(pointerLocation, material.x, material.y);
      gl.uniform2f(foilLocation, material.foilX, material.foilY);
      gl.uniform1f(angleLocation, targetRef.current.angle);
      gl.uniform1f(speedLocation, material.speed);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      root.dataset.ready = "true";
    };

    const tick = (time: number) => {
      if (!running || disposed) return;
      if (time - lastDraw >= 24) {
        draw(time);
        lastDraw = time;
      }
      frame = requestAnimationFrame(tick);
    };

    const stop = () => {
      running = false;
      cancelAnimationFrame(frame);
    };

    const start = () => {
      if (running || disposed || document.hidden) return;
      running = true;
      frame = requestAnimationFrame(tick);
    };

    const dispose = () => {
      if (disposed) return;
      disposed = true;
      stop();
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };

    const controller: ShaderController = { start, stop, renderOnce: draw, dispose };
    controllerRef.current = controller;
    const resizeObserver = new ResizeObserver(() => draw());
    resizeObserver.observe(canvas);

    const handleExportPrepare = (event: Event) => {
      const timeMs =
        event instanceof CustomEvent && typeof event.detail?.timeMs === "number"
          ? event.detail.timeMs
          : PASS_EXPORT_FRAME_TIME;
      stop();
      draw(timeMs);
    };
    const handleExportRelease = () => {
      if (activeRef.current && !reduceMotion) start();
    };
    root.addEventListener(PASS_EXPORT_PREPARE_EVENT, handleExportPrepare);
    root.addEventListener(PASS_EXPORT_RELEASE_EVENT, handleExportRelease);

    const handleVisibility = () => {
      if (document.hidden) stop();
      else if (activeRef.current && !reduceMotion) start();
    };
    const handleContextLoss = (event: Event) => {
      event.preventDefault();
      root.dataset.ready = "false";
      stop();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    canvas.addEventListener("webglcontextlost", handleContextLoss);
    draw();
    if (activeRef.current && !reduceMotion) start();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      canvas.removeEventListener("webglcontextlost", handleContextLoss);
      root.removeEventListener(PASS_EXPORT_PREPARE_EVENT, handleExportPrepare);
      root.removeEventListener(PASS_EXPORT_RELEASE_EVENT, handleExportRelease);
      resizeObserver.disconnect();
      controllerRef.current = null;
      dispose();
    };
  }, [reduceMotion]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    if (reduceMotion) {
      controller.stop();
      controller.renderOnce();
    } else if (active) {
      controller.start();
    } else {
      controller.stop();
    }
  }, [active, reduceMotion]);

  return (
    <div
      ref={rootRef}
      className={styles.root}
      data-active={active}
      data-ready="false"
      data-renderer="webgl2"
      data-testid="paper-shader"
      aria-hidden="true"
    >
      <span className={styles.fallback} data-testid="paper-shader-fallback" />
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}