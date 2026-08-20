package com.holdoff.app

import android.app.Application

/**
 * App-wide singleton. Provides access to the application context
 * anywhere via HoldOffApplication.instance.
 */
class HoldOffApplication : Application() {

    companion object {
        lateinit var instance: HoldOffApplication
            private set
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
    }
}
