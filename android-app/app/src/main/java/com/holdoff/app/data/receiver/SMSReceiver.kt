package com.holdoff.app.data.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.database.Cursor
import android.net.Uri
import android.provider.ContactsContract
import android.provider.Telephony
import android.util.Log
import com.holdoff.app.data.network.HoldOffApi
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * Listens for incoming SMS in real time.
 * For each message:
 *  1. Resolves the sender's display name from contacts.
 *  2. Reads the last 20 messages in the thread for full context.
 *  3. Posts a local notification so the user knows Sadie has a read.
 *  4. Kicks off a background call to /api/interpreter with the full thread history.
 */
class SMSReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return

        for (sms in messages) {
            val from = sms.originatingAddress ?: continue
            val body = sms.messageBody ?: continue
            if (body.isBlank()) continue

            Log.d("HoldOff", "Incoming SMS from $from: ${body.take(40)}")

            val contactName = resolveContactName(context, from)

            // Show immediate notification so user knows Sadie is on it
            NotificationHelper.showIncomingAlert(context, contactName, from)

            // Background: call /api/interpreter with full thread context
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    val threadHistory = readThreadHistory(context, from, 20)
                    HoldOffApi.interpretMessage(context, body, from, threadHistory)
                } catch (e: Exception) {
                    Log.e("HoldOff", "SMSReceiver interpret failed: ${e.message}")
                }
            }
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /**
     * Resolves a phone number to a contact display name.
     * Returns the phone number itself if no contact is found.
     */
    private fun resolveContactName(context: Context, phone: String): String {
        val uri = Uri.withAppendedPath(
            ContactsContract.PhoneLookup.CONTENT_FILTER_URI, Uri.encode(phone))
        context.contentResolver.query(
            uri,
            arrayOf(ContactsContract.PhoneLookup.DISPLAY_NAME),
            null, null, null
        )?.use { c ->
            if (c.moveToFirst()) return c.getString(0) ?: phone
        }
        return phone
    }

    /**
     * Reads the last [limit] SMS messages for [phone] from the device ContentProvider.
     * Each entry is a Map with keys: direction ("sent"|"received"), body, timestamp.
     */
    private fun readThreadHistory(
        context: Context,
        phone: String,
        limit: Int
    ): List<Map<String, Any>> {
        val history = mutableListOf<Map<String, Any>>()
        context.contentResolver.query(
            Uri.parse("content://sms"),
            arrayOf("body", "date", "type"),
            "address = ?",
            arrayOf(phone),
            "date ASC LIMIT $limit"
        )?.use { c ->
            while (c.moveToNext()) {
                val type = c.getInt(c.getColumnIndexOrThrow("type"))
                history.add(mapOf(
                    "direction" to if (type == 2) "sent" else "received",
                    "body"      to (c.getString(c.getColumnIndexOrThrow("body")) ?: ""),
                    "timestamp" to c.getLong(c.getColumnIndexOrThrow("date"))
                ))
            }
        }
        return history
    }
}
