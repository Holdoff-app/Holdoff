package com.holdoff.app.data.sms

import android.annotation.SuppressLint
import android.content.ContentValues
import android.content.Context
import android.os.Build
import android.provider.Telephony
import android.telephony.SmsManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Actually puts a message on the wire.
 *
 * Only usable while HoldOff is the default SMS app — that is what makes the pause real
 * rather than advisory, because the send passes through here instead of another app.
 */
object SmsSender {

    data class SendResult(val ok: Boolean, val error: String? = null)

    @SuppressLint("MissingPermission")
    suspend fun send(context: Context, address: String, body: String): SendResult =
        withContext(Dispatchers.IO) {
            if (address.isBlank()) return@withContext SendResult(false, "No recipient")
            if (body.isBlank()) return@withContext SendResult(false, "Nothing to send")

            try {
                val manager = smsManager(context)
                // Anything over one segment must be split or the carrier rejects it.
                val segments = manager.divideMessage(body)
                if (segments.size > 1) {
                    manager.sendMultipartTextMessage(address, null, segments, null, null)
                } else {
                    manager.sendTextMessage(address, null, body, null, null)
                }
                persistToSentBox(context, address, body)
                SendResult(true)
            } catch (e: Exception) {
                SendResult(false, e.message ?: "Could not send message")
            }
        }

    @Suppress("DEPRECATION")
    private fun smsManager(context: Context): SmsManager =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            context.getSystemService(SmsManager::class.java)
        } else {
            SmsManager.getDefault()
        }

    /** The default app owns storage, so a sent message only appears in threads if we write it. */
    private fun persistToSentBox(context: Context, address: String, body: String) {
        runCatching {
            context.contentResolver.insert(
                Telephony.Sms.Sent.CONTENT_URI,
                ContentValues().apply {
                    put(Telephony.Sms.ADDRESS, address)
                    put(Telephony.Sms.BODY, body)
                    put(Telephony.Sms.DATE, System.currentTimeMillis())
                    put(Telephony.Sms.READ, 1)
                    put(Telephony.Sms.SEEN, 1)
                }
            )
        }
    }
}
