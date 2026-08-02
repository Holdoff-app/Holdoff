package com.holdoff.app.data.sms

import android.app.Activity
import android.app.role.RoleManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Telephony

/**
 * Becoming the default SMS app.
 *
 * Order matters: Play rejects apps that prompt for SMS permissions before holding the role,
 * so call [requestIntent] first and only ask for permissions once [isDefault] is true.
 */
object DefaultSmsRole {

    fun isDefault(context: Context): Boolean =
        context.packageName == Telephony.Sms.getDefaultSmsPackage(context)

    /** Intent that asks the user to make HoldOff the default. Null if unavailable. */
    fun requestIntent(activity: Activity): Intent? {
        if (isDefault(activity)) return null

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val roleManager = activity.getSystemService(RoleManager::class.java)
            if (roleManager?.isRoleAvailable(RoleManager.ROLE_SMS) == true &&
                !roleManager.isRoleHeld(RoleManager.ROLE_SMS)
            ) {
                return roleManager.createRequestRoleIntent(RoleManager.ROLE_SMS)
            }
            return null
        }

        @Suppress("DEPRECATION")
        return Intent(Telephony.Sms.Intents.ACTION_CHANGE_DEFAULT).apply {
            putExtra(Telephony.Sms.Intents.EXTRA_PACKAGE_NAME, activity.packageName)
        }
    }
}
