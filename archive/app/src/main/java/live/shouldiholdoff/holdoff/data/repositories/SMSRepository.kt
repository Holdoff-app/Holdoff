package live.shouldiholdoff.holdoff.data.repositories

import android.content.ContentResolver
import android.content.Context
import android.provider.ContactsContract
import android.provider.Telephony
import live.shouldiholdoff.holdoff.domain.models.SMSThread
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class SMSRepository(private val context: Context) {

    suspend fun readThreads(): List<SMSThread> = withContext(Dispatchers.IO) {
        val threads = mutableListOf<SMSThread>()
        val cr: ContentResolver = context.contentResolver

        try {
            val cursor = cr.query(
                Telephony.Sms.CONTENT_URI,
                arrayOf(
                    Telephony.Sms.THREAD_ID,
                    Telephony.Sms.ADDRESS,
                    Telephony.Sms.BODY,
                    Telephony.Sms.DATE,
                    Telephony.Sms.READ
                ),
                null, null,
                "${Telephony.Sms.DATE} DESC"
            )

            val seen = mutableSetOf<Long>()
            cursor?.use { c ->
                val threadIdCol = c.getColumnIndex(Telephony.Sms.THREAD_ID)
                val addressCol  = c.getColumnIndex(Telephony.Sms.ADDRESS)
                val bodyCol     = c.getColumnIndex(Telephony.Sms.BODY)
                val dateCol     = c.getColumnIndex(Telephony.Sms.DATE)
                val readCol     = c.getColumnIndex(Telephony.Sms.READ)

                while (c.moveToNext() && threads.size < 50) {
                    val threadId = c.getLong(threadIdCol)
                    if (seen.contains(threadId)) continue
                    seen.add(threadId)

                    val address = c.getString(addressCol) ?: continue
                    val body    = c.getString(bodyCol) ?: ""
                    val date    = c.getLong(dateCol)
                    val read    = c.getInt(readCol)

                    val contactName = resolveContactName(cr, address)
                    threads.add(
                        SMSThread(
                            threadId        = threadId.toString(),
                            contactName     = contactName,
                            phoneNumber     = address,
                            lastMessage     = body.take(200),
                            lastMessageTime = date,
                            unreadCount     = if (read == 0) 1 else 0
                        )
                    )
                }
            }
        } catch (e: Exception) {
            // Permission not granted yet — return empty list
        }
        threads
    }

    private fun resolveContactName(cr: ContentResolver, phoneNumber: String): String {
        return try {
            val uri = android.net.Uri.withAppendedPath(
                ContactsContract.PhoneLookup.CONTENT_FILTER_URI,
                android.net.Uri.encode(phoneNumber)
            )
            val cursor = cr.query(
                uri,
                arrayOf(ContactsContract.PhoneLookup.DISPLAY_NAME),
                null, null, null
            )
            cursor?.use { c ->
                if (c.moveToFirst()) {
                    c.getString(0) ?: phoneNumber
                } else phoneNumber
            } ?: phoneNumber
        } catch (e: Exception) {
            phoneNumber
        }
    }
}
