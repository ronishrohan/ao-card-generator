"use client";

import { useEffect, useState } from "react";

export interface XProfile {
  name?: string;
  photo?: string;
}

/**
 * Best-effort X profile lookup for the submitted handle. The photo is served
 * through the same-origin avatar proxy so it also survives the share capture.
 */
export function useXProfile(submittedHandle: string | null) {
  const [profile, setProfile] = useState<XProfile>({});

  useEffect(() => {
    if (!submittedHandle) {
      setProfile((current) =>
        current.name === undefined && current.photo === undefined ? current : {},
      );
      return;
    }

    const controller = new AbortController();
    let active = true;
    fetch(`/api/x-profile?u=${submittedHandle}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { name?: string | null; photo?: string | null } | null) => {
        if (!active || !data) return;
        setProfile({
          name: data.name ?? undefined,
          photo: data.photo
            ? `/api/x-avatar?u=${encodeURIComponent(submittedHandle)}`
            : undefined,
        });
      })
      .catch(() => {
        // Profile lookup is best-effort; the pass falls back to the handle.
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [submittedHandle]);

  return { profile, resetProfile: () => setProfile({}) };
}
