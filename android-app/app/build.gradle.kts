import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Redirect build output to app/build/ so the CI workflow can find artifacts
// at the expected path: app/build/outputs/...
layout.buildDirectory.set(rootProject.layout.projectDirectory.dir("app/build"))

// Shared secret for api.smsholdoff.com. Never committed: put
// holdoffApiKey=... in local.properties, or set HOLDOFF_API_KEY in CI.
// Both candidate roots are checked because this module builds from the repo
// root (settings.gradle.kts) and from android-app/ (Android Studio).
val holdoffApiKey: String = run {
    val candidates = listOf(
        rootProject.file("local.properties"),
        project.file("../local.properties"),
        project.file("../../local.properties")
    )
    val fromLocal = candidates.filter { it.exists() }.firstNotNullOfOrNull { file ->
        Properties().apply { file.inputStream().use { load(it) } }
            .getProperty("holdoffApiKey")
    }
    fromLocal ?: System.getenv("HOLDOFF_API_KEY") ?: ""
}

android {
    namespace = "com.holdoff.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.holdoff.app"
        minSdk = 26
        targetSdk = 34
        versionCode = 4
        versionName = "2.0.0"
        vectorDrawables { useSupportLibrary = true }

        buildConfigField("String", "HOLDOFF_API_KEY", "\"$holdoffApiKey\"")
    }

    // Play rejects a debug-signed upload, so release signing is configured only
    // when CI supplies the upload keystore. Local release builds stay unsigned.
    val keystoreFile = System.getenv("HOLDOFF_KEYSTORE_PATH")?.let(::file)?.takeIf { it.exists() }

    signingConfigs {
        if (keystoreFile != null) {
            create("upload") {
                storeFile = keystoreFile
                storePassword = System.getenv("HOLDOFF_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("HOLDOFF_KEY_ALIAS")
                keyPassword = System.getenv("HOLDOFF_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            if (keystoreFile != null) signingConfig = signingConfigs.getByName("upload")
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

    buildFeatures {
        compose = true
        buildConfig = true
    }
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

    // Networking — OkHttp (HoldOffApi: draft analysis + companion chat)
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    // Purchases
    implementation("com.android.billingclient:billing-ktx:6.1.0")

    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}
