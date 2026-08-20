package com.holdoff.app.data.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log

/**
 * Listens for incoming SMS in real time. Triggers analysis + notification.
 */
class SMSReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        for (sms in messages) {
            val from = sms.originatingAddress ?: "Unknown"
            val body = sms.messageBody ?: ""
            Log.d("HoldOff", "SMS from $from: ${body.take(30)}")
            // TODO: post local notification + run HoldOff verdict
        }
    }
}
