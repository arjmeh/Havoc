"use client";

export const HAVOC_DEVICE_TEST_EVENT = "havoc:device-test-motion";

export type HavocDeviceTestMotion = {
  pitch: number;
  roll: number;
  deltaPitch: number;
  deltaRoll: number;
  source: "desktop";
  timestamp: number;
};

declare global {
  interface WindowEventMap {
    [HAVOC_DEVICE_TEST_EVENT]: CustomEvent<HavocDeviceTestMotion>;
  }
}
