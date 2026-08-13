"use client";

import { type RefObject, useEffect, useState } from "react";
import { EXPORT_HEIGHT, EXPORT_WIDTH } from "../lib/pass-export";
import { renderWavesBackgroundDataUrl } from "../lib/waves-background";
import styles from "./pass-export.module.css";

/**
 * Hidden, fixed-size (1600×900) backdrop for the share/download PNG: the
 * page's base color, a static frame of the dot-grid waves shader, and the
 * darkening overlay. The card itself is NOT rendered here — the export
 * captures the live, on-screen card and composites it over this backdrop, so
 * the PNG shows exactly what the user sees.
 */
export function ExportBackdrop({
  rootRef,
}: {
  rootRef: RefObject<HTMLDivElement | null>;
}) {
  const [waves, setWaves] = useState<string | null>(null);

  useEffect(() => {
    setWaves(renderWavesBackgroundDataUrl(EXPORT_WIDTH, EXPORT_HEIGHT));
  }, []);

  return (
    <div ref={rootRef} className={styles.root} aria-hidden="true">
      {waves ? (
        // A pre-rendered static frame of the page's dot-grid background.
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.waves} src={waves} alt="" />
      ) : null}
      <span className={styles.overlay} aria-hidden="true" />
    </div>
  );
}
