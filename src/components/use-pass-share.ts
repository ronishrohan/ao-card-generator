"use client";

import {
  type MouseEvent as ReactMouseEvent,
  type RefObject,
  useRef,
  useState,
} from "react";
import {
  captureBackdrop,
  captureLiveCard,
  composePassPng,
  downloadBlob,
} from "../lib/pass-export";

export type ShareState = "idle" | "working" | "copied" | "saved" | "error";
export type ActiveAction = "none" | "share" | "download";
export type ShareToastTone = "success" | "warning" | "error";

export interface ShareToast {
  id: number;
  message: string;
  tone: ShareToastTone;
}

export const shareLabels: Record<ShareState, string> = {
  idle: "SHARE ON X",
  working: "CAPTURING…",
  copied: "COPIED — PASTE ON X",
  saved: "PNG DOWNLOADED",
  error: "COULDN'T CAPTURE",
};

const TWITTER_OPEN_DELAY = 1100;

interface UsePassShareOptions {
  stageRef: RefObject<HTMLDivElement | null>;
  backdropRef: RefObject<HTMLDivElement | null>;
  username: string;
}

/**
 * Share/download state machine for the pass. Every share/download click takes
 * a FRESH capture of the live stage (pinned to the export frame) and
 * composites it over the hidden backdrop — no cross-click caching: a capture
 * that raced the card's first paint used to be cached and then reused by
 * every later share/download, which is why a broken PNG kept coming back
 * until the component remounted.
 */
export function usePassShare({
  stageRef,
  backdropRef,
  username,
}: UsePassShareOptions) {
  const [shareState, setShareState] = useState<ShareState>("idle");
  const [activeAction, setActiveAction] = useState<ActiveAction>("none");
  const [toast, setToast] = useState<ShareToast | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  const showToast = (message: string, tone: ShareToastTone = "success") => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    setToast({ id: Date.now(), message, tone });
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 2800);
  };

  const openTwitterIntent = (message: string) => {
    window.setTimeout(() => {
      window.open(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`,
        "_blank",
        "noopener",
      );
    }, TWITTER_OPEN_DELAY);
  };

  const getBlob = async (): Promise<Blob | null> => {
    const stage = stageRef.current;
    const backdrop = backdropRef.current;
    if (!stage) return null;
    const [backdropBlob, cardBlob] = await Promise.all([
      backdrop ? captureBackdrop(backdrop) : Promise.resolve(null),
      captureLiveCard(stage),
    ]);
    if (!cardBlob) return null;
    return composePassPng(backdropBlob, cardBlob);
  };

  const getPngBlob = async (blob: Blob | null) => {
    if (!blob) throw new Error("capture returned no image");
    return blob.type === "image/png"
      ? blob
      : new Blob([await blob.arrayBuffer()], { type: "image/png" });
  };

  const copyPassToClipboard = (blobPromise: Promise<Blob | null>) => {
    if (
      typeof ClipboardItem === "undefined" ||
      !navigator.clipboard ||
      typeof navigator.clipboard.write !== "function"
    ) {
      return Promise.resolve(false);
    }

    try {
      return navigator.clipboard.write([
        new ClipboardItem({
          "image/png": blobPromise.then(getPngBlob),
        }),
      ]).then(
        () => true,
        (error) => {
          console.error("[share] image clipboard write failed", error);
          return false;
        },
      );
    } catch (error) {
      console.error("[share] image clipboard write failed", error);
      return Promise.resolve(false);
    }
  };

  const shareCard = async (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (activeAction !== "none") return;
    setActiveAction("share");
    setShareState("working");
    try {
      const blobPromise = getBlob();
      const clipboardPromise = copyPassToClipboard(blobPromise);
      const blob = await blobPromise;
      if (!blob) throw new Error("capture returned no image");

      const message = `Just got my pass for The Orchestra, AO's online hackathon. Your idea, an army of agents. Aug 12-13, online. aoagents.dev`;

      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const file = new File([blob], `orchestra-pass-${username.slice(1)}.png`, {
        type: "image/png",
      });
      const copiedToClipboard = await clipboardPromise;
      if (copiedToClipboard) {
        showToast("Image copied to clipboard");
        setShareState("copied");
      } else {
        showToast("Clipboard image copy is blocked on this device", "warning");
      }

      if (isMobile && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text: message, title: "The Orchestra" });
        } catch {
          // User dismissed share sheet
        }
        return;
      }

      if (!copiedToClipboard) {
        downloadBlob(blob, username);
        setShareState("saved");
      }

      openTwitterIntent(message);
    } catch {
      showToast("Couldn't capture the image", "error");
      setShareState("error");
    } finally {
      setActiveAction("none");
      window.setTimeout(() => setShareState("idle"), 2400);
    }
  };

  const downloadCard = async (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (activeAction !== "none") return;
    setActiveAction("download");
    setShareState("working");
    try {
      const blobPromise = getBlob();
      const clipboardPromise = copyPassToClipboard(blobPromise);
      const blob = await blobPromise;
      if (!blob) throw new Error("capture returned no image");
      downloadBlob(blob, username);
      const copiedToClipboard = await clipboardPromise;
      if (copiedToClipboard) {
        showToast("PNG Downloaded — Image copied to clipboard");
      } else {
        showToast("PNG Downloaded");
      }
      setShareState("saved");
    } catch {
      showToast("Couldn't capture the image", "error");
      setShareState("error");
    } finally {
      setActiveAction("none");
      window.setTimeout(() => setShareState("idle"), 2400);
    }
  };

  /** Copies the pass image without a user gesture; callers handle failure. */
  const autoCopy = (): Promise<boolean> => copyPassToClipboard(getBlob());

  return { shareState, activeAction, toast, shareCard, downloadCard, autoCopy };
}
