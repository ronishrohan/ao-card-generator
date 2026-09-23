"use client";

import { type MotionValue } from "motion/react";
import { useState } from "react";
import styles from "./interactive-ao-pass.module.css";
import { PaperShader } from "./PaperShader";

interface ShaderLayerProps {
  active: boolean;
  interactionX: MotionValue<number>;
  interactionY: MotionValue<number>;
  rotation: MotionValue<number>;
}

function ShaderLayer({
  active,
  interactionX,
  interactionY,
  rotation,
}: ShaderLayerProps) {
  return (
    <PaperShader
      active={active}
      interactionX={interactionX}
      interactionY={interactionY}
      rotation={rotation}
    />
  );
}

function PassStub() {
  return (
    <aside className={styles.stub}>
      <span className={styles.stubYear} aria-hidden="true">
        2026
      </span>
      <span className={styles.stubText} aria-hidden="true">
        ADMIT ONE
      </span>
    </aside>
  );
}

interface PassFrontFaceProps {
  visible: boolean;
  shader: ShaderLayerProps;
  eventName: string;
  identity: string;
  username: string;
  photo?: string;
  teamName?: string;
  passType: string;
  date: string;
  format: string;
}

export function PassFrontFace({
  visible,
  shader,
  eventName,
  identity,
  username,
  photo,
  teamName,
  passType,
  date,
  format,
}: PassFrontFaceProps) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const showPhoto = Boolean(photo) && !photoFailed;

  return (
    <section
      className={`${styles.face} ${styles.front}`}
      aria-hidden={!visible}
      data-active={visible}
      aria-label="Pass card front side"
    >
      <ShaderLayer {...shader} />
      <span className={styles.logoField} aria-hidden="true" />
      <div className={styles.frontCopy} data-with-photo={showPhoto ? "true" : "false"}>
        <div className={styles.eyebrowGroup}>
          <p className={styles.eyebrow}>AGENT ORCHESTRATOR PRESENTS</p>
          <p className={styles.eyebrow}>{eventName.toUpperCase()} · 2026</p>
        </div>
        <div
          className={styles.identityRow}
          data-name-length={identity.length > 14 ? "long" : "short"}
        >
          {showPhoto ? (
            <span className={styles.photoFrame}>
              {/* A plain image keeps the component compatible with attendee image URLs. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className={styles.photoImg}
                src={photo}
                alt={`${identity}'s profile`}
                onError={() => setPhotoFailed(true)}
              />
              <span className={styles.photoShader} aria-hidden="true">
                <ShaderLayer {...shader} />
              </span>
              <span className={styles.photoGrain} aria-hidden="true" />
            </span>
          ) : null}
          <div className={styles.identityBlock}>
            <h2 className={styles.identity}>{identity}</h2>
            <p className={styles.fromLine}>{username}</p>
          </div>
        </div>
        {teamName?.trim() ? (
          <p className={styles.teamLine}>TEAM {teamName.trim().toUpperCase()}</p>
        ) : null}
        <div className={styles.frontTag}>
          <p className={styles.tagline}>BUILD · BREAK · SHIP · REPEAT</p>
        </div>
        <div className={styles.frontFooter}>
          <p className={styles.passType}>{passType.toUpperCase()}</p>
          <p className={styles.dateLine}>
            {date.toUpperCase()} · {format.toUpperCase()}
          </p>
        </div>
      </div>
      <PassStub />
    </section>
  );
}

interface PassBackFaceProps {
  visible: boolean;
  shader: ShaderLayerProps;
  teamName?: string;
  ticketId: string;
}

export function PassBackFace({
  visible,
  shader,
  teamName,
  ticketId,
}: PassBackFaceProps) {
  return (
    <section
      className={`${styles.face} ${styles.back}`}
      aria-hidden={!visible}
      data-active={visible}
      aria-label="Pass card back side"
    >
      <ShaderLayer {...shader} />
      <span className={styles.logoField} aria-hidden="true" />
      <div className={styles.backCopy}>
        <h2 className={styles.mission}>
          <span className={styles.missionLine}>YOUR IDEA.</span>
          <span className={styles.missionLine}>AN ARMY OF AGENTS.</span>
        </h2>
        <div className={styles.backDetails}>
          {teamName?.trim() ? (
            <div className={styles.detailCell}>
              <span className={styles.detailLabel}>TEAM</span>
              <span className={styles.detailValue}>{teamName.trim()}</span>
            </div>
          ) : null}
          <div className={styles.detailCell}>
            <span className={styles.detailLabel}>TICKET ID</span>
            <span className={styles.detailValue}>{ticketId}</span>
          </div>
          <p className={styles.backMeta}>TEAMS UP TO 4</p>
          <p className={styles.backMeta}>AOAGENTS.DEV</p>
        </div>
      </div>
      <PassStub />
    </section>
  );
}
