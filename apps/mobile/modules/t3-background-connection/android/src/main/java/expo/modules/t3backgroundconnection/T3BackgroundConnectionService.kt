package expo.modules.t3backgroundconnection

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.os.Build
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

class T3BackgroundConnectionService : HeadlessJsTaskService() {
  private val screenStateReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
      if (intent?.action == Intent.ACTION_SCREEN_ON || intent?.action == Intent.ACTION_SCREEN_OFF) {
        T3BackgroundConnectionState.refreshDeviceInteractive(context)
      }
    }
  }
  private var screenStateReceiverRegistered = false

  override fun onCreate() {
    super.onCreate()
    T3BackgroundConnectionState.initialize(this)
    registerScreenStateReceiver()
    T3BackgroundConnectionState.refreshDeviceInteractive(this)
    startInForeground()
    T3BackgroundConnectionState.markServiceRunning(true)
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (!T3BackgroundConnectionState.isServiceRequired(this)) {
      stopSelf(startId)
      return Service.START_NOT_STICKY
    }

    if (T3BackgroundConnectionState.claimTask()) {
      super.onStartCommand(intent, flags, startId)
    }
    return Service.START_STICKY
  }

  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig =
    HeadlessJsTaskConfig(
      T3BackgroundConnectionState.TASK_NAME,
      Arguments.createMap(),
      0,
      true,
    )

  override fun onHeadlessJsTaskFinish(taskId: Int) {
    val shouldRestart = T3BackgroundConnectionState.isServiceRequired(this)
    T3BackgroundConnectionState.releaseTask()
    super.onHeadlessJsTaskFinish(taskId)
    if (shouldRestart) {
      T3BackgroundConnectionState.scheduleRestartAfterUnexpectedTaskFinish(this)
    }
  }

  override fun onDestroy() {
    unregisterScreenStateReceiver()
    T3BackgroundConnectionState.markServiceRunning(false)
    super.onDestroy()
  }

  private fun startInForeground() {
    createNotificationChannel()
    val notification = createNotification()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(
        NOTIFICATION_ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_REMOTE_MESSAGING,
      )
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val channel = NotificationChannel(
      NOTIFICATION_CHANNEL_ID,
      "Background connection",
      NotificationManager.IMPORTANCE_LOW,
    ).apply {
      description = "Keeps T3 Code connected while the app is in the background"
      setSound(null, null)
      enableLights(false)
      enableVibration(false)
      setShowBadge(false)
      lockscreenVisibility = Notification.VISIBILITY_PRIVATE
    }
    getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
  }

  private fun createNotification(): Notification {
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
    val contentIntent = launchIntent?.let {
      PendingIntent.getActivity(
        this,
        0,
        it,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }
    val smallIcon = resources.getIdentifier("notification_icon", "drawable", packageName)
      .takeIf { it != 0 }
      ?: android.R.drawable.stat_notify_sync_noanim

    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, NOTIFICATION_CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }.apply {
      setContentTitle("T3 Code")
      setContentText("Background connection enabled")
      setSmallIcon(smallIcon)
      setOngoing(true)
      setOnlyAlertOnce(true)
      setShowWhen(false)
      setCategory(Notification.CATEGORY_SERVICE)
      setVisibility(Notification.VISIBILITY_PRIVATE)
      contentIntent?.let(::setContentIntent)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE)
      }
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
        @Suppress("DEPRECATION")
        setPriority(Notification.PRIORITY_LOW)
        @Suppress("DEPRECATION")
        setSound(null)
      }
    }.build()
  }

  @Suppress("DEPRECATION", "TooGenericExceptionCaught")
  private fun registerScreenStateReceiver() {
    try {
      val filter = IntentFilter(Intent.ACTION_SCREEN_ON).apply {
        addAction(Intent.ACTION_SCREEN_OFF)
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        registerReceiver(screenStateReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
      } else {
        registerReceiver(screenStateReceiver, filter)
      }
      screenStateReceiverRegistered = true
    } catch (_: RuntimeException) {
      // Screen-state tuning is best-effort; service lifecycle still releases
      // the Wi-Fi lock when T3 Code returns to the foreground.
      screenStateReceiverRegistered = false
    }
  }

  @Suppress("TooGenericExceptionCaught")
  private fun unregisterScreenStateReceiver() {
    if (!screenStateReceiverRegistered) return
    try {
      unregisterReceiver(screenStateReceiver)
    } catch (_: RuntimeException) {
      // Android may already have removed the receiver during process teardown.
    } finally {
      screenStateReceiverRegistered = false
    }
  }

  private companion object {
    const val NOTIFICATION_CHANNEL_ID = "t3code_background_connection"
    const val NOTIFICATION_ID = 0x7433
  }
}
