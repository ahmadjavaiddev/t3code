package expo.modules.t3backgroundconnection

internal object T3BackgroundConnectionRecoveryPolicy {
  fun isServiceRequired(
    enabled: Boolean,
    applicationForeground: Boolean,
  ): Boolean = enabled && !applicationForeground

  fun shouldHoldHighPerformanceWifiLock(
    enabled: Boolean,
    serviceRunning: Boolean,
    applicationForeground: Boolean,
    deviceInteractive: Boolean,
  ): Boolean =
    serviceRunning &&
      !deviceInteractive &&
      isServiceRequired(enabled, applicationForeground)

  fun shouldScheduleRestartAfterStartFailure(
    batteryOptimizationIgnored: Boolean
  ): Boolean = batteryOptimizationIgnored

  fun shouldEnsureStartedOnActivityBackground(
    enabled: Boolean,
    applicationForeground: Boolean,
    serviceRunning: Boolean,
    runtimeReady: Boolean
  ): Boolean =
    isServiceRequired(enabled, applicationForeground) && (!serviceRunning || !runtimeReady)

  fun isRuntimeHealthy(
    serviceRunning: Boolean,
    runtimeReady: Boolean,
    lastHeartbeatAtMs: Long,
    nowMs: Long,
    staleAfterMs: Long,
  ): Boolean =
    serviceRunning &&
      runtimeReady &&
      lastHeartbeatAtMs > 0L &&
      nowMs >= lastHeartbeatAtMs &&
      nowMs - lastHeartbeatAtMs <= staleAfterMs
}
