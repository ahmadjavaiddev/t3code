import type { BackgroundConnectionStatus } from "../../native/backgroundConnection";

export type BackgroundConnectionStatusLabel =
  | "Running"
  | "Starting"
  | "Stopped"
  | "Connection stalled"
  | "Battery optimization enabled";

export function backgroundConnectionStatusLabel(
  status: BackgroundConnectionStatus,
): BackgroundConnectionStatusLabel {
  if (!status.supported || !status.enabled) {
    return "Stopped";
  }
  if (!status.batteryOptimizationIgnored) {
    return "Battery optimization enabled";
  }
  if (!status.serviceRunning || !status.runtimeReady) {
    return "Starting";
  }
  return status.runtimeHealthy ? "Running" : "Connection stalled";
}

export function shouldRequestBackgroundConnectionBatteryExemption(
  status: BackgroundConnectionStatus,
): boolean {
  return status.supported && status.enabled && !status.batteryOptimizationIgnored;
}
