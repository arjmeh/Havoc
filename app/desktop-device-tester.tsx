"use client";

import {
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  HAVOC_DEVICE_TEST_EVENT,
  type HavocDeviceTestMotion,
} from "./device-test-events";
import styles from "./desktop-device-tester.module.css";

type DevicePose = {
  pitch: number;
  roll: number;
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

const wrapAngle = (value: number) => {
  const wrapped = ((value + 180) % 360 + 360) % 360 - 180;
  return Math.abs(wrapped + 180) < 0.001 ? 180 : wrapped;
};

const normalizeWheel = (event: WheelEvent, viewport: HTMLElement) => {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return 16;
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return Math.max(viewport.clientHeight, 1);
  }
  return 1;
};

export function DesktopDeviceTester({
  screenId,
  viewportRef,
}: {
  screenId: string;
  viewportRef: RefObject<HTMLDivElement | null>;
}) {
  const controlRef = useRef<HTMLButtonElement | null>(null);
  const poseRef = useRef<DevicePose>({ pitch: 0, roll: 0 });
  const [pose, setPose] = useState<DevicePose>(poseRef.current);
  const [engaged, setEngaged] = useState(false);

  const publish = useCallback(
    (next: DevicePose, previous: DevicePose) => {
      poseRef.current = next;
      setPose(next);
      const viewport = viewportRef.current;
      if (viewport) {
        viewport.style.setProperty("--device-test-pitch", `${next.pitch}deg`);
        viewport.style.setProperty("--device-test-roll", `${next.roll}deg`);
        viewport.dataset.deviceTilted =
          Math.abs(next.pitch) > 0.5 || Math.abs(next.roll) > 0.5
            ? "true"
            : "false";
      }

      const detail: HavocDeviceTestMotion = {
        pitch: next.pitch,
        roll: next.roll,
        deltaPitch: wrapAngle(next.pitch - previous.pitch),
        deltaRoll: next.roll - previous.roll,
        source: "desktop",
        timestamp: performance.now(),
      };
      window.dispatchEvent(
        new CustomEvent<HavocDeviceTestMotion>(HAVOC_DEVICE_TEST_EVENT, {
          detail,
        }),
      );
    },
    [viewportRef],
  );

  const nudge = useCallback(
    (deltaPitch: number, deltaRoll: number) => {
      const previous = poseRef.current;
      publish(
        {
          pitch: wrapAngle(previous.pitch + deltaPitch),
          roll: clamp(previous.roll + deltaRoll, -58, 58),
        },
        previous,
      );
    },
    [publish],
  );

  const reset = useCallback(() => {
    const previous = poseRef.current;
    publish({ pitch: 0, roll: 0 }, previous);
  }, [publish]);

  useEffect(() => {
    reset();
  }, [reset, screenId]);

  useEffect(() => {
    const control = controlRef.current;
    const viewport = viewportRef.current;
    if (!control || !viewport) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const multiplier = normalizeWheel(event, viewport);
      const vertical = clamp(event.deltaY * multiplier, -72, 72);
      const horizontal = clamp(event.deltaX * multiplier, -52, 52);
      if (Math.abs(vertical) < 0.8 && Math.abs(horizontal) < 0.8) return;
      nudge(vertical * 0.72, horizontal * 0.34);
    };

    control.addEventListener("wheel", onWheel, { passive: false });
    return () => control.removeEventListener("wheel", onWheel);
  }, [nudge, viewportRef]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const movement =
      event.shiftKey ? 30 : event.altKey ? 4 : 14;
    if (event.key === "Home" || event.key === "Escape") {
      event.preventDefault();
      reset();
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      nudge(-movement, 0);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      nudge(movement, 0);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      nudge(0, -movement);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      nudge(0, movement);
    }
  };

  return (
    <div
      className={styles.tester}
      data-engaged={engaged ? "true" : "false"}
      aria-label="Desktop device motion tester"
    >
      <span className={styles.tooltip} aria-hidden="true">
        <strong>Rotate the phone</strong>
        <small>Hover + use your trackpad · click to reset</small>
      </span>
      <button
        ref={controlRef}
        type="button"
        className={styles.control}
        onClick={reset}
        onFocus={() => setEngaged(true)}
        onBlur={() => setEngaged(false)}
        onPointerEnter={() => setEngaged(true)}
        onPointerLeave={() => setEngaged(false)}
        onKeyDown={onKeyDown}
        aria-label={`Rotate the preview with the trackpad. Current angle ${Math.round(
          pose.pitch,
        )} degrees. Click to reset.`}
      >
        <span
          className={styles.orbit}
          style={{ transform: `rotate(${pose.pitch}deg)` }}
          aria-hidden="true"
        >
          <i />
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          width="24"
          height="24"
        >
          <path
            d="M19 8.4A7.5 7.5 0 1 0 19.1 15M19 8.4V4.8m0 3.6h-3.6"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
      </button>
    </div>
  );
}
