package com.holdoff.app.data.repository

import android.content.Context
import android.provider.ContactsContract
import com.holdoff.app.data.model.Contact
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** Reads device contacts. Requires READ_CONTACTS permission. */
class ContactsRepository(private val context: Context) {

    suspend fun getAllContacts(): List<Contact> = withContext(Dispatchers.IO) {
        val out = mutableMapOf<String, Contact>()
        val proj = arrayOf(
            ContactsContract.CommonDataKinds.Phone.CONTACT_ID,
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
            ContactsContract.CommonDataKinds.Phone.NUMBER,
            ContactsContract.CommonDataKinds.Phone.PHOTO_URI
        )
        context.contentResolver.query(
            ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
            proj, null, null,
            "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} ASC"
        )?.use { c ->
            while (c.moveToNext()) {
                val id    = c.getString(c.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.CONTACT_ID))
                val name  = c.getString(c.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME)) ?: ""
                val phone = c.getString(c.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.NUMBER)) ?: ""
                val photo = c.getString(c.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.PHOTO_URI))
                val existing = out[id]
                if (existing != null) {
                    out[id] = existing.copy(phoneNumbers = existing.phoneNumbers + phone)
                } else {
                    out[id] = Contact(id, name, listOf(phone), photo)
                }
            }
        }
        out.values.toList()
    }
}
