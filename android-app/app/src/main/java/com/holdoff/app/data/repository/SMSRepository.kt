package com.holdoff.app.data.repository

import android.content.Context
import android.net.Uri
import android.provider.Telephony
import com.holdoff.app.data.model.Message
import com.holdoff.app.data.model.SMSThread
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Reads real SMS threads + messages from the device via ContentResolver.
 * All work runs on IO dispatcher. Requires READ_SMS permission.
 */
class SMSRepository(private val context: Context) {

    /** All threads, most-recent-first. */
    suspend fun getAllThreads(): List<SMSThread> = withContext(Dispatchers.IO) {
        val out = mutableListOf<SMSThread>()
        val uri = Uri.parse("content://mms-sms/conversations?simple=true")
        val projection = arrayOf(
            Telephony.Threads._ID,
            Telephony.Threads.SNIPPET,
            Telephony.Threads.DATE,
            Telephony.Threads.MESSAGE_COUNT
        )
        context.contentResolver.query(uri, projection, null, null,
            "${Telephony.Threads.DATE} DESC")?.use { c ->
            while (c.moveToNext()) {
                val threadId = c.getString(c.getColumnIndexOrThrow(Telephony.Threads._ID))
                val snippet  = c.getString(c.getColumnIndexOrThrow(Telephony.Threads.SNIPPET)) ?: ""
                val date     = c.getLong(c.getColumnIndexOrThrow(Telephony.Threads.DATE))
                val count    = c.getInt(c.getColumnIndexOrThrow(Telephony.Threads.MESSAGE_COUNT))
                val phone    = getPhoneForThread(threadId)
                val name     = resolveContactName(phone)
                out += SMSThread(
                    threadId = threadId,
                    contactName = name,
                    phoneNumber = phone,
                    lastMessage = snippet,
                    lastMessageTime = date,
                    messageCount = count,
                    unreadCount = 0
                )
            }
        }
        out
    }

    /** All messages in a thread, oldest-first. */
    suspend fun getMessagesForThread(threadId: String): List<Message> = withContext(Dispatchers.IO) {
        val out = mutableListOf<Message>()
        val uri = Uri.parse("content://sms")
        val projection = arrayOf("_id", "thread_id", "body", "date", "type", "address")
        context.contentResolver.query(
            uri, projection,
            "thread_id = ?", arrayOf(threadId),
            "date ASC"
        )?.use { c ->
            while (c.moveToNext()) {
                val id      = c.getString(c.getColumnIndexOrThrow("_id"))
                val body    = c.getString(c.getColumnIndexOrThrow("body")) ?: ""
                val date    = c.getLong(c.getColumnIndexOrThrow("date"))
                val type    = c.getInt(c.getColumnIndexOrThrow("type"))
                val address = c.getString(c.getColumnIndexOrThrow("address")) ?: ""
                val outgoing = type == Telephony.Sms.MESSAGE_TYPE_SENT
                out += Message(
                    id = id,
                    threadId = threadId,
                    body = body,
                    timestamp = date,
                    isOutgoing = outgoing,
                    senderName = if (outgoing) "You" else resolveContactName(address)
                )
            }
        }
        out
    }

    private fun getPhoneForThread(threadId: String): String {
        val smsUri = Uri.parse("content://sms")
        context.contentResolver.query(
            smsUri, arrayOf("address"),
            "thread_id = ?", arrayOf(threadId),
            "date DESC LIMIT 1"
        )?.use { c -> if (c.moveToFirst()) return c.getString(0) ?: "" }
        return ""
    }

    private fun resolveContactName(phone: String): String {
        if (phone.isBlank()) return "Unknown"
        val uri = Uri.withAppendedPath(
            android.provider.ContactsContract.PhoneLookup.CONTENT_FILTER_URI,
            Uri.encode(phone)
        )
        context.contentResolver.query(
            uri, arrayOf(android.provider.ContactsContract.PhoneLookup.DISPLAY_NAME),
            null, null, null
        )?.use { c -> if (c.moveToFirst()) return c.getString(0) ?: phone }
        return phone
    }
}
