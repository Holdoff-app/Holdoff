package com.holdoff.app.data.model

/** A device contact, possibly linked to a thread. */
data class Contact(
    val id: String,
    val name: String,
    val phoneNumbers: List<String>,
    val photoUri: String? = null,
    val email: String? = null,
    val notes: String? = null,
    val attachmentStyle: String? = null
)
