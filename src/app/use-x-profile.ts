"use client";

import { useEffect, useState } from "react";

export interface XProfile {
  name?: string;
  photo?: string;
}

function isAbortError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

/**
 * Best-effort X profile lookup for the submitted handle. The photo is served
 * through the same-origin avatar proxy so it also survives the share capture.
 * Loading and failure are exposed so the pass can show a quiet status line
 * without waiting on the request.
 */
export function useXProfile(submittedHandle: string | null) {
  const [profile, setProfile] = useState<XProfile>({});
  const [trackedHandle, setTrackedHandle] = useState(submittedHandle);
  const [loading, setLoading] = useState(() => Boolean(submittedHandle));
  const [failed, setFailed] = useState(false);

  if (submittedHandle !== trackedHandle) {
    setTrackedHandle(submittedHandle);
    setProfile({});
    setFailed(false);
    setLoading(Boolean(submittedHandle));
  }

  useEffect(() => {
    if (!submittedHandle) return;

    const controller = new AbortController();
    let active = true;

    fetch(`/api/x-profile?u=${submittedHandle}`, { signal: controller.signal })
      .then(async (response) => {
        if (!active) return;
        if (!response.ok) {
          setLoading(false);
          setFailed(true);
          return;
        }

        const data = (await response.json()) as {
          name?: string | null;
          photo?: string | null;
        };
        if (!active) return;

        const name = data.name ?? undefined;
        const photo = data.photo
          ? `/api/x-avatar?u=${encodeURIComponent(submittedHandle)}`
          : undefined;

        if (name || photo) {
          setProfile({ name, photo });
        }
        setLoading(false);
        setFailed(false);
      })
      .catch((error: unknown) => {
        if (!active || isAbortError(error)) return;
        setLoading(false);
        setFailed(true);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [submittedHandle]);

  return {
    profile,
    loading,
    failed,
    resetProfile: () => setProfile({}),
  };
}
