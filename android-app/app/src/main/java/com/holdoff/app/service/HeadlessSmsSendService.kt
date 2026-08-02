package com.holdoff.app.service

import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.telephony.TelephonyManager
import com.holdoff.app.data.sms.SmsSender
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * Handles RESPOND_VIA_MESSAGE — the "reply with a text" option on an incoming call.
 * Required for default-SMS-handler eligibility.
 *
 * These are canned replies chosen from the call screen, so no pause is applied. The
 * intervention belongs on messages the user composes.
 */
class HeadlessSmsSendService : Service() {

    private val scope = CoroutineScope(Dispatchers.IO)

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val recipient = intent?.data?.schemeSpecificPart?.substringBefore('?')
        val body = intent?.getStringExtra(Intent.EXTRA_TEXT)

        if (intent?.action == TelephonyManager.ACTION_RESPOND_VIA_MESSAGE &&
            !recipient.isNullOrBlank() && !body.isNullOrBlank()
        ) {
            scope.launch {
                SmsSender.send(applicationContext, recipient, body)
                stopSelf(startId)
            }
        } else {
            stopSelf(startId)
        }
        return START_NOT_STICKY
    }
}
