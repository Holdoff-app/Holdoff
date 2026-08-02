plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Redirect build output to app/build/ so the CI workflow can find artifacts
// at the expected path: app/build/outputs/...
layout.buildDirectory.set(rootProject.layout.projectDirectory.dir("app/build"))

android {
    namespace = "com.holdoff.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.holdoff.app"
        minSdk = 26
        targetSdk = 34
        versionCode = 3
        versionName = "1.2.0"
        vectorDrawables { useSupportLibrary = true }

        // Injected at build time from the CI secrets store, never committed. An empty key is a
        // valid build: HoldOffApi.isAuthConfigured goes false and the app hides the account
        // screens instead of offering a sign-up that cannot work. The pause needs no account.
        //
        // The anon key is not a secret in the usual sense — it ships inside every APK and is
        // meant to be public. Everything it can reach is bounded by the row-level security
        // policies in supabase/migrations. It is kept out of the repo so that rotating the
        // project does not mean rewriting git history.
        buildConfigField(
            "String", "SUPABASE_URL",
            "\"${System.getenv("SUPABASE_URL") ?: ""}\""
        )
        buildConfigField(
            "String", "SUPABASE_ANON_KEY",
            "\"${System.getenv("SUPABASE_ANON_KEY") ?: ""}\""
        )
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
        freeCompilerArgs += listOf(
            "-opt-in=androidx.compose.material3.ExperimentalMaterial3Api",
            "-opt-in=androidx.compose.foundation.ExperimentalFoundationApi",
            "-opt-in=androidx.compose.animation.ExperimentalAnimationApi"
        )
    }

    // buildConfig is off by default in AGP 8; the buildConfigField entries above need it on.
    buildFeatures { compose = true; buildConfig = true }
    composeOptions { kotlinCompilerExtensionVersion = "1.5.3" }

    packaging {
        resources { excludes += "/META-INF/{AL2.0,LGPL2.1}" }
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.02.00")
    implementation(composeBom)

    // Core
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")
    implementation("androidx.activity:activity-compose:1.8.2")

    // Compose
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.navigation:navigation-compose:2.7.6")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.7.0")

    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")

    // Networking — OkHttp (used by HoldOffApi for auth + companion chat)
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")

    // Google Sign-In + Play Billing
    implementation("com.google.android.gms:play-services-auth:21.0.0")
    implementation("com.android.billingclient:billing-ktx:6.1.0")

    // Images, preferences, local DB
    implementation("io.coil-kt:coil-compose:2.5.0")
    implementation("androidx.datastore:datastore-preferences:1.0.0")
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")

    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}
