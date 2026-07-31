"use client";

export type SensorPermission = "granted" | "denied" | "unsupported";

export type SensorPermissionReport = {
  motion: SensorPermission;
  orientation: SensorPermission;
};

export type SensorRuntimeStatus =
  | "idle"
  | "listening"
  | "healthy"
  | "denied"
  | "unavailable";

export type MotionSample = {
  acceleration?: Partial<Record<"x" | "y" | "z", number | null>>;
  accelerationIncludingGravity?: Partial<
    Record<"x" | "y" | "z", number | null>
  >;
  timestamp: number;
};

export type OrientationSample = {
  beta: number | null;
  gamma: number | null;
  timestamp: number;
};

export type CalibrationGestureCallbacks = {
  onInversion: () => void;
  onShake: (direction: number, strength: number) => void;
  onStatus?: (status: SensorRuntimeStatus) => void;
};

type PermissionRequestConstructor = {
  requestPermission?: () => Promise<"granted" | "denied">;
};

type Vector3 = {
  x: number;
  y: number;
  z: number;
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

const finite = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const magnitude = ({ x, y, z }: Vector3) => Math.hypot(x, y, z);

const normalize = (vector: Vector3): Vector3 | null => {
  const length = magnitude(vector);
  if (length < 0.001) return null;
  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length,
  };
};

const dot = (left: Vector3, right: Vector3) =>
  left.x * right.x + left.y * right.y + left.z * right.z;

const angularDistance = (left: number, right: number) => {
  const normalized = ((left - right + 540) % 360) - 180;
  return Math.abs(normalized);
};

const requestOnePermission = (
  constructor: PermissionRequestConstructor | undefined,
): Promise<SensorPermission> => {
  if (!constructor?.requestPermission) {
    return Promise.resolve("unsupported");
  }

  try {
    // This method is invoked before this function returns. Callers must invoke
    // requestCalibrationSensorPermissions directly from their click/tap handler.
    const request = constructor.requestPermission();
    return request
      .then((result) => (result === "granted" ? "granted" : "denied"))
      .catch(() => "denied");
  } catch {
    return Promise.resolve("denied");
  }
};

export function requestCalibrationSensorPermissions(): Promise<SensorPermissionReport> {
  if (typeof window === "undefined") {
    return Promise.resolve({
      motion: "unsupported",
      orientation: "unsupported",
    });
  }

  const motionRequest = requestOnePermission(
    window.DeviceMotionEvent as typeof DeviceMotionEvent &
      PermissionRequestConstructor,
  );
  const orientationRequest = requestOnePermission(
    window.DeviceOrientationEvent as typeof DeviceOrientationEvent &
      PermissionRequestConstructor,
  );

  return Promise.all([motionRequest, orientationRequest]).then(
    ([motion, orientation]) => ({ motion, orientation }),
  );
}

/**
 * Pure gesture detector shared by real browser events and deterministic
 * synthetic checks. It deliberately has no DOM dependencies.
 */
export class CalibrationGestureDetector {
  private readonly callbacks: CalibrationGestureCallbacks;
  private gravityEstimate: Vector3 | null = null;
  private gravityBaseline: Vector3 | null = null;
  private orientationBaseline: { beta: number; gamma: number } | null = null;
  private inversionSince: number | null = null;
  private inverted = false;
  private shakeEnergy = 0;
  private lastShakeAt = Number.NEGATIVE_INFINITY;
  private lastDirection = 1;

  public constructor(callbacks: CalibrationGestureCallbacks) {
    this.callbacks = callbacks;
  }

  public ingestMotion(sample: MotionSample): void {
    const rawGravity: Vector3 = {
      x: finite(sample.accelerationIncludingGravity?.x),
      y: finite(sample.accelerationIncludingGravity?.y),
      z: finite(sample.accelerationIncludingGravity?.z),
    };
    const gravityLength = magnitude(rawGravity);

    if (gravityLength > 4) {
      const normalizedGravity = normalize(rawGravity);
      if (normalizedGravity) {
        if (!this.gravityBaseline) {
          this.gravityBaseline = normalizedGravity;
        }
        this.updateInversion(
          dot(this.gravityBaseline, normalizedGravity) <= -0.74,
          sample.timestamp,
        );
      }
    }

    let linear: Vector3;
    const providedAcceleration = sample.acceleration;
    const hasLinearAcceleration =
      providedAcceleration &&
      [providedAcceleration.x, providedAcceleration.y, providedAcceleration.z].some(
        (value) => typeof value === "number" && Number.isFinite(value),
      );

    if (hasLinearAcceleration) {
      linear = {
        x: finite(providedAcceleration?.x),
        y: finite(providedAcceleration?.y),
        z: finite(providedAcceleration?.z),
      };
    } else {
      if (!this.gravityEstimate) {
        this.gravityEstimate = rawGravity;
      } else {
        this.gravityEstimate = {
          x: this.gravityEstimate.x * 0.82 + rawGravity.x * 0.18,
          y: this.gravityEstimate.y * 0.82 + rawGravity.y * 0.18,
          z: this.gravityEstimate.z * 0.82 + rawGravity.z * 0.18,
        };
      }
      linear = {
        x: rawGravity.x - this.gravityEstimate.x,
        y: rawGravity.y - this.gravityEstimate.y,
        z: rawGravity.z - this.gravityEstimate.z,
      };
    }

    const currentMagnitude = magnitude(linear);
    this.shakeEnergy = this.shakeEnergy * 0.58 + currentMagnitude * 0.42;
    if (
      this.shakeEnergy < 4.6 ||
      sample.timestamp - this.lastShakeAt < 135
    ) {
      return;
    }

    const dominant =
      Math.abs(linear.y) >= Math.abs(linear.x) ? linear.y : linear.x;
    let direction = Math.sign(dominant);
    if (!direction || direction === this.lastDirection) {
      direction = this.lastDirection * -1;
    }
    this.lastDirection = direction;
    this.lastShakeAt = sample.timestamp;
    this.callbacks.onShake(direction, clamp(this.shakeEnergy / 13, 0.25, 1));
    this.shakeEnergy *= 0.32;
  }

  public ingestOrientation(sample: OrientationSample): void {
    if (sample.beta === null || sample.gamma === null) return;
    if (!this.orientationBaseline) {
      this.orientationBaseline = {
        beta: sample.beta,
        gamma: sample.gamma,
      };
      return;
    }

    const betaDistance = angularDistance(
      sample.beta,
      this.orientationBaseline.beta,
    );
    const gammaDistance = angularDistance(
      sample.gamma,
      this.orientationBaseline.gamma,
    );
    this.updateInversion(
      betaDistance >= 145 || betaDistance + gammaDistance >= 172,
      sample.timestamp,
    );
  }

  public reset(): void {
    this.gravityEstimate = null;
    this.gravityBaseline = null;
    this.orientationBaseline = null;
    this.inversionSince = null;
    this.inverted = false;
    this.shakeEnergy = 0;
    this.lastShakeAt = Number.NEGATIVE_INFINITY;
    this.lastDirection = 1;
  }

  private updateInversion(candidate: boolean, timestamp: number): void {
    if (!candidate) {
      this.inversionSince = null;
      if (this.inverted) this.inverted = false;
      return;
    }
    if (this.inverted) return;
    if (this.inversionSince === null) {
      this.inversionSince = timestamp;
      return;
    }
    if (timestamp - this.inversionSince < 450) return;
    this.inverted = true;
    this.callbacks.onInversion();
  }
}

export class SyntheticSensorAdapter {
  private readonly detector: CalibrationGestureDetector;
  private time = 0;

  public constructor(detector: CalibrationGestureDetector) {
    this.detector = detector;
  }

  public shake(count = 1): void {
    for (let index = 0; index < count; index += 1) {
      this.time += 150;
      const direction = index % 2 === 0 ? 1 : -1;
      this.detector.ingestMotion({
        acceleration: { x: direction * 11.5, y: direction * 7.2, z: 1.5 },
        accelerationIncludingGravity: { x: 0, y: 9.81, z: 0 },
        timestamp: this.time,
      });
    }
  }

  public invert(): void {
    this.detector.ingestMotion({
      acceleration: { x: 0, y: 0, z: 0 },
      accelerationIncludingGravity: { x: 0, y: 9.81, z: 0 },
      timestamp: this.time,
    });
    this.time += 100;
    this.detector.ingestMotion({
      acceleration: { x: 0, y: 0, z: 0 },
      accelerationIncludingGravity: { x: 0, y: -9.81, z: 0 },
      timestamp: this.time,
    });
    this.time += 500;
    this.detector.ingestMotion({
      acceleration: { x: 0, y: 0, z: 0 },
      accelerationIncludingGravity: { x: 0, y: -9.81, z: 0 },
      timestamp: this.time,
    });
  }
}

export class DeviceSensorRuntime {
  private readonly callbacks: CalibrationGestureCallbacks;
  private readonly detector: CalibrationGestureDetector;
  private eventCount = 0;
  private healthTimer: number | null = null;
  private running = false;

  public readonly synthetic: SyntheticSensorAdapter;

  public constructor(callbacks: CalibrationGestureCallbacks) {
    this.callbacks = callbacks;
    this.detector = new CalibrationGestureDetector(callbacks);
    this.synthetic = new SyntheticSensorAdapter(this.detector);
  }

  public start(permission: SensorPermissionReport): void {
    if (typeof window === "undefined" || this.running) return;
    if (permission.motion === "denied" && permission.orientation === "denied") {
      this.callbacks.onStatus?.("denied");
      return;
    }

    this.running = true;
    this.eventCount = 0;
    this.detector.reset();
    window.addEventListener("devicemotion", this.onMotion, { passive: true });
    window.addEventListener("deviceorientation", this.onOrientation, {
      passive: true,
    });
    this.callbacks.onStatus?.("listening");
    this.healthTimer = window.setTimeout(() => {
      if (this.eventCount < 3) this.callbacks.onStatus?.("unavailable");
    }, 1500);
  }

  public dispose(): void {
    if (typeof window !== "undefined") {
      window.removeEventListener("devicemotion", this.onMotion);
      window.removeEventListener("deviceorientation", this.onOrientation);
      if (this.healthTimer !== null) window.clearTimeout(this.healthTimer);
    }
    this.healthTimer = null;
    this.running = false;
    this.eventCount = 0;
    this.detector.reset();
    this.callbacks.onStatus?.("idle");
  }

  private markEvent = () => {
    this.eventCount += 1;
    if (this.eventCount !== 3) return;
    if (this.healthTimer !== null) window.clearTimeout(this.healthTimer);
    this.healthTimer = null;
    this.callbacks.onStatus?.("healthy");
  };

  private onMotion = (event: DeviceMotionEvent) => {
    this.markEvent();
    this.detector.ingestMotion({
      acceleration: {
        x: event.acceleration?.x,
        y: event.acceleration?.y,
        z: event.acceleration?.z,
      },
      accelerationIncludingGravity: {
        x: event.accelerationIncludingGravity?.x,
        y: event.accelerationIncludingGravity?.y,
        z: event.accelerationIncludingGravity?.z,
      },
      timestamp: performance.now(),
    });
  };

  private onOrientation = (event: DeviceOrientationEvent) => {
    this.markEvent();
    this.detector.ingestOrientation({
      beta: event.beta,
      gamma: event.gamma,
      timestamp: performance.now(),
    });
  };
}
