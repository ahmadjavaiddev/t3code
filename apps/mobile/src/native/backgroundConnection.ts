import { NativeModule, requireOptionalNativeModule } from "expo";

export interface BackgroundConnectionStatus {
  readonly supported: boolean;
  readonly enabled: boolean;
  readonly serviceRequired: boolean;
  readonly serviceRunning: boolean;
  readonly runtimeReady: boolean;
  readonly runtimeHealthy: boolean;
  readonly batteryOptimizationIgnored: boolean;
}

type BackgroundConnectionNativeEvents = {
  readonly onStatusChange: (status: BackgroundConnectionStatus) => void;
  readonly onStopRequested: () => void;
};

declare class BackgroundConnectionNativeModule extends NativeModule<BackgroundConnectionNativeEvents> {
  readonly getStatus?: () => BackgroundConnectionStatus;
  readonly setEnabled?: (enabled: boolean) => Promise<BackgroundConnectionStatus>;
  readonly ensureStarted?: () => BackgroundConnectionStatus;
  readonly requestBatteryOptimizationExemption?: () => Promise<BackgroundConnectionStatus>;
  readonly setRuntimeReady?: (ready: boolean) => BackgroundConnectionStatus;
  readonly recordRuntimeHeartbeat?: () => void;
  readonly acknowledgeStop?: () => BackgroundConnectionStatus;
}

export interface BackgroundConnectionSubscription {
  readonly remove: () => void;
}

const UNSUPPORTED_STATUS: BackgroundConnectionStatus = {
  supported: false,
  enabled: false,
  serviceRequired: false,
  serviceRunning: false,
  runtimeReady: false,
  runtimeHealthy: false,
  batteryOptimizationIgnored: false,
};

let cachedNativeModule: BackgroundConnectionNativeModule | null | undefined;

function getNativeModule(): BackgroundConnectionNativeModule | null {
  if (cachedNativeModule !== undefined) return cachedNativeModule;
  try {
    cachedNativeModule =
      requireOptionalNativeModule<BackgroundConnectionNativeModule>("T3BackgroundConnection");
  } catch {
    cachedNativeModule = null;
  }
  return cachedNativeModule;
}

function normalizeStatus(status: BackgroundConnectionStatus | null | undefined) {
  if (status?.supported !== true) return UNSUPPORTED_STATUS;
  const serviceRunning = status.serviceRunning === true;
  const runtimeReady = status.runtimeReady === true;
  const enabled = status.enabled === true;
  return {
    supported: true,
    enabled,
    // Native builds from before foreground suspension do not expose this
    // field and expect an enabled service to remain active continuously.
    serviceRequired:
      status.serviceRequired === undefined ? enabled : status.serviceRequired === true,
    serviceRunning,
    runtimeReady,
    // Preview binaries published before runtime heartbeats do not include this
    // field. Preserve their previous ready-state behavior until the next native
    // build installs heartbeat-aware recovery.
    runtimeHealthy:
      status.runtimeHealthy === undefined
        ? serviceRunning && runtimeReady
        : status.runtimeHealthy === true,
    batteryOptimizationIgnored: status.batteryOptimizationIgnored === true,
  } satisfies BackgroundConnectionStatus;
}

export function getBackgroundConnectionStatus(): BackgroundConnectionStatus {
  try {
    return normalizeStatus(getNativeModule()?.getStatus?.());
  } catch {
    return UNSUPPORTED_STATUS;
  }
}

export async function setBackgroundConnectionEnabled(
  enabled: boolean,
): Promise<BackgroundConnectionStatus> {
  try {
    const nativeModule = getNativeModule();
    if (!nativeModule?.setEnabled) return UNSUPPORTED_STATUS;
    return normalizeStatus(await nativeModule.setEnabled(enabled));
  } catch {
    return getBackgroundConnectionStatus();
  }
}

export function ensureBackgroundConnectionStarted(): BackgroundConnectionStatus {
  try {
    return normalizeStatus(getNativeModule()?.ensureStarted?.());
  } catch {
    return getBackgroundConnectionStatus();
  }
}

export async function requestBackgroundConnectionBatteryOptimizationExemption(): Promise<BackgroundConnectionStatus> {
  try {
    const nativeModule = getNativeModule();
    if (!nativeModule?.requestBatteryOptimizationExemption) return UNSUPPORTED_STATUS;
    return normalizeStatus(await nativeModule.requestBatteryOptimizationExemption());
  } catch {
    return getBackgroundConnectionStatus();
  }
}

export function setBackgroundConnectionRuntimeReady(ready: boolean): BackgroundConnectionStatus {
  try {
    return normalizeStatus(getNativeModule()?.setRuntimeReady?.(ready));
  } catch {
    return getBackgroundConnectionStatus();
  }
}

export function recordBackgroundConnectionRuntimeHeartbeat(): void {
  try {
    getNativeModule()?.recordRuntimeHeartbeat?.();
  } catch {
    // Heartbeats are advisory; connection recovery remains authoritative.
  }
}

export function acknowledgeBackgroundConnectionStop(): BackgroundConnectionStatus {
  try {
    return normalizeStatus(getNativeModule()?.acknowledgeStop?.());
  } catch {
    return getBackgroundConnectionStatus();
  }
}

export function addBackgroundConnectionStatusListener(
  listener: (status: BackgroundConnectionStatus) => void,
): BackgroundConnectionSubscription {
  try {
    const nativeModule = getNativeModule();
    if (!nativeModule) return NOOP_SUBSCRIPTION;
    return nativeModule.addListener("onStatusChange", (status) => {
      listener(normalizeStatus(status));
    });
  } catch {
    return NOOP_SUBSCRIPTION;
  }
}

export function addBackgroundConnectionStopRequestListener(
  listener: () => void,
): BackgroundConnectionSubscription {
  try {
    return getNativeModule()?.addListener("onStopRequested", listener) ?? NOOP_SUBSCRIPTION;
  } catch {
    return NOOP_SUBSCRIPTION;
  }
}

const NOOP_SUBSCRIPTION: BackgroundConnectionSubscription = {
  remove() {},
};
