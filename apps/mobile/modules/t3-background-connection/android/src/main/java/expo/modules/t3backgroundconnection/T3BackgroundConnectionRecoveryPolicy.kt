package expo.modules.t3backgroundconnection

internal object T3BackgroundConnectionRecoveryPolicy {
  fun shouldScheduleRestartAfterStartFailure(
    batteryOptimizationIgnored: Boolean
  ): Boolean = batteryOptimizationIgnored

  fun shouldEnsureStartedOnActivityForeground(
    enabled: Boolean,
    serviceRunning: Boolean,
    runtimeReady: Boolean
  ): Boolean = enabled && (!serviceRunning || !runtimeReady)

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
