// Client-only capture pipeline for the share/download PNG. The card is
// captured from the LIVE, on-screen stage — with the shaders pinned to one
// fixed, good-looking frame — and composited over a hidden, pre-rendered
// backdrop (base color + waves + overlay).

import {
  PASS_EXPORT_PREPARE_EVENT,
  PASS_EXPORT_RELEASE_EVENT,
} from "../components/PaperShader";

export const EXPORT_WIDTH = 1600;
export const EXPORT_HEIGHT = 900;
/** Card width inside the composition; the live stage is scaled up to this. */
const CARD_TARGET_WIDTH = 1161;

// A transparent stand-in keeps one broken image (e.g. a blocked avatar fetch)
// from rejecting the whole capture.
const transparentPixel =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

async function waitForImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    images.map(async (image) => {
      try {
        if (!image.complete) await image.decode();
      } catch {
        // A broken image falls back to the placeholder during capture.
      }
    }),
  );
}

async function snapshot(
  root: HTMLElement,
  options: { pixelRatio: number; pinToOrigin?: boolean },
): Promise<Blob | null> {
  const { toBlob } = await import("html-to-image");
  // The backdrop is parked offscreen with `position: fixed; left: -10000px`,
  // and html-to-image inlines computed styles onto the clone — including that
  // offset, expressed via the `inset-inline` shorthand, which would paint the
  // whole composition outside the frame. `inset` resets the whole family.
  const style = options.pinToOrigin
    ? { position: "relative", inset: "0px", right: "auto", bottom: "auto" }
    : undefined;
  let blob = await toBlob(root, {
    pixelRatio: options.pixelRatio,
    cacheBust: true,
    imagePlaceholder: transparentPixel,
    style,
  }).catch((error) => {
    console.error("[export] capture failed, retrying without images", error);
    return null;
  });
  if (!blob) {
    // Last resort: capture without any raster images.
    blob = await toBlob(root, {
      pixelRatio: options.pixelRatio,
      filter: (node) => (node as HTMLElement).tagName !== "IMG",
      style,
    }).catch(() => null);
  }
  return blob;
}

/**
 * A capture that raced the card's first paint comes back fully transparent
 * (the composed PNG then shows the bare backdrop). Sampling a downscaled copy
 * is enough to catch that: a real card is opaque and full of contrast.
 */
async function blobLooksBlank(blob: Blob): Promise<boolean> {
  try {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 36;
    const context = canvas.getContext("2d");
    if (!context) return false;
    context.drawImage(bitmap, 0, 0, 64, 36);
    bitmap.close();
    const { data } = context.getImageData(0, 0, 64, 36);
    let transparent = 0;
    let min = 255;
    let max = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 10) {
        transparent += 1;
        continue;
      }
      const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      if (lum < min) min = lum;
      if (lum > max) max = lum;
    }
    const total = data.length / 4;
    return transparent / total > 0.9 || max - min < 6;
  } catch {
    return false;
  }
}

/**
 * Captures the live card as it currently appears. The `data-capturing` CSS
 * pins the stage flat on its front face with `!important` transforms while
 * the snapshot runs, so no animation state has to be reset or restored.
 *
 * The paper shaders are paused and redrawn with one fixed, good-looking frame
 * (`PASS_EXPORT_PREPARE_EVENT`) right before the snapshot: the shader loop is
 * time-based, so capturing whatever frame happens to be current made exports
 * a lottery — dark phases hid the perforation line and the ghost year, and an
 * early capture could read a not-yet-painted canvas. Without a pinned frame
 * the exported PNG "fixed itself" only when a later capture happened to land
 * on a bright phase.
 */
export async function captureLiveCard(
  stage: HTMLElement,
): Promise<Blob | null> {
  await document.fonts.ready;
  await waitForImages(stage);
  stage.dataset.capturing = "true";
  const shaderRoots = Array.from(
    stage.querySelectorAll("[data-testid='paper-shader']"),
  );
  const pinShaderFrame = () =>
    shaderRoots.forEach((root) =>
      root.dispatchEvent(new Event(PASS_EXPORT_PREPARE_EVENT)),
    );
  pinShaderFrame();
  try {
    // Let the pinning styles apply before cloning.
    await new Promise((resolve) => requestAnimationFrame(resolve));
    let blob = await snapshot(stage, {
      pixelRatio: CARD_TARGET_WIDTH / Math.max(1, stage.offsetWidth),
    });
    if (blob && (await blobLooksBlank(blob))) {
      // The capture raced the card's first paint; wait for two frames and
      // take one more shot before giving up.
      console.warn("[export] blank capture, retrying");
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      pinShaderFrame();
      const retry = await snapshot(stage, {
        pixelRatio: CARD_TARGET_WIDTH / Math.max(1, stage.offsetWidth),
      });
      if (retry) blob = retry;
    }
    return blob;
  } finally {
    shaderRoots.forEach((root) =>
      root.dispatchEvent(new Event(PASS_EXPORT_RELEASE_EVENT)),
    );
    delete stage.dataset.capturing;
  }
}

let backdropPromise: Promise<Blob | null> | null = null;

/** The backdrop is static, so it is captured at most once per page load. */
export function captureBackdrop(root: HTMLElement): Promise<Blob | null> {
  if (!backdropPromise) {
    backdropPromise = (async () => {
      await document.fonts.ready;
      await waitForImages(root);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      return snapshot(root, { pixelRatio: 1, pinToOrigin: true });
    })();
  }
  return backdropPromise;
}

/** Draws backdrop + centered live-card capture onto the export canvas. */
export async function composePassPng(
  backdrop: Blob | null,
  card: Blob,
): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = EXPORT_WIDTH;
  canvas.height = EXPORT_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) return null;

  if (backdrop) {
    context.drawImage(
      await createImageBitmap(backdrop),
      0,
      0,
      EXPORT_WIDTH,
      EXPORT_HEIGHT,
    );
  } else {
    context.fillStyle = "#0d0d0d";
    context.fillRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
  }

  const cardImage = await createImageBitmap(card);
  context.drawImage(
    cardImage,
    Math.round((EXPORT_WIDTH - cardImage.width) / 2),
    Math.round((EXPORT_HEIGHT - cardImage.height) / 2),
  );

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

export function downloadBlob(blob: Blob, username: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `orchestra-pass-${username.replace(/^@/, "")}.png`;
  link.click();
  URL.revokeObjectURL(url);
}
