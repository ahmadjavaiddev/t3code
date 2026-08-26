package expo.modules.t3backgroundconnection

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class T3BackgroundConnectionRecoveryPolicyTest {
  @Test
  fun `service is required only for an enabled background application`() {
    assertTrue(
      T3BackgroundConnectionRecoveryPolicy.isServiceRequired(
        enabled = true,
        applicationForeground = false,
      ),
    )
    assertFalse(
      T3BackgroundConnectionRecoveryPolicy.isServiceRequired(
        enabled = true,
        applicationForeground = true,
      ),
    )
    assertFalse(
      T3BackgroundConnectionRecoveryPolicy.isServiceRequired(
        enabled = false,
        applicationForeground = false,
      ),
    )
  }

  @Test
  fun `high performance wifi is held only while protecting a screen-off background app`() {
    assertTrue(
      T3BackgroundConnectionRecoveryPolicy.shouldHoldHighPerformanceWifiLock(
        enabled = true,
        serviceRunning = true,
        applicationForeground = false,
        deviceInteractive = false,
      ),
    )
    assertFalse(
      T3BackgroundConnectionRecoveryPolicy.shouldHoldHighPerformanceWifiLock(
        enabled = true,
        serviceRunning = true,
        applicationForeground = true,
        deviceInteractive = false,
      ),
    )
    assertFalse(
      T3BackgroundConnectionRecoveryPolicy.shouldHoldHighPerformanceWifiLock(
        enabled = false,
        serviceRunning = true,
        applicationForeground = false,
        deviceInteractive = false,
      ),
    )
    assertFalse(
      T3BackgroundConnectionRecoveryPolicy.shouldHoldHighPerformanceWifiLock(
        enabled = true,
        serviceRunning = true,
        applicationForeground = false,
        deviceInteractive = true,
      ),
    )
  }

  @Test
  fun `start failure retries only while battery optimization is ignored`() {
    assertTrue(
      T3BackgroundConnectionRecoveryPolicy.shouldScheduleRestartAfterStartFailure(
        batteryOptimizationIgnored = true,
      ),
    )
    assertFalse(
      T3BackgroundConnectionRecoveryPolicy.shouldScheduleRestartAfterStartFailure(
        batteryOptimizationIgnored = false,
      ),
    )
  }

  @Test
  fun `background starts an enabled service that is stopped or not ready`() {
    assertTrue(
      T3BackgroundConnectionRecoveryPolicy.shouldEnsureStartedOnActivityBackground(
        enabled = true,
        applicationForeground = false,
        serviceRunning = false,
        runtimeReady = false,
      ),
    )
    assertTrue(
      T3BackgroundConnectionRecoveryPolicy.shouldEnsureStartedOnActivityBackground(
        enabled = true,
        applicationForeground = false,
        serviceRunning = true,
        runtimeReady = false,
      ),
    )
  }

  @Test
  fun `background leaves a healthy service alone and foreground leaves every service dormant`() {
    assertFalse(
      T3BackgroundConnectionRecoveryPolicy.shouldEnsureStartedOnActivityBackground(
        enabled = true,
        applicationForeground = false,
        serviceRunning = true,
        runtimeReady = true,
      ),
    )
    assertFalse(
      T3BackgroundConnectionRecoveryPolicy.shouldEnsureStartedOnActivityBackground(
        enabled = true,
        applicationForeground = true,
        serviceRunning = false,
        runtimeReady = false,
      ),
    )
    assertFalse(
      T3BackgroundConnectionRecoveryPolicy.shouldEnsureStartedOnActivityBackground(
        enabled = false,
        applicationForeground = false,
        serviceRunning = false,
        runtimeReady = false,
      ),
    )
  }

  @Test
  fun `runtime health requires a recent heartbeat from a ready service`() {
    assertTrue(
      T3BackgroundConnectionRecoveryPolicy.isRuntimeHealthy(
        serviceRunning = true,
        runtimeReady = true,
        lastHeartbeatAtMs = 10_000L,
        nowMs = 99_999L,
        staleAfterMs = 90_000L,
      ),
    )
    assertFalse(
      T3BackgroundConnectionRecoveryPolicy.isRuntimeHealthy(
        serviceRunning = true,
        runtimeReady = true,
        lastHeartbeatAtMs = 10_000L,
        nowMs = 100_001L,
        staleAfterMs = 90_000L,
      ),
    )
    assertFalse(
      T3BackgroundConnectionRecoveryPolicy.isRuntimeHealthy(
        serviceRunning = true,
        runtimeReady = false,
        lastHeartbeatAtMs = 10_000L,
        nowMs = 20_000L,
        staleAfterMs = 90_000L,
      ),
    )
  }
}
