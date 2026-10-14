plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
android {
    namespace = "local.xcloud.enhancer"
    compileSdk = 34
    defaultConfig {
        applicationId = "local.xcloud.enhancer"
        minSdk = 24
        targetSdk = 34
        versionCode = 3
        versionName = "1.0.0"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}
dependencies {
    implementation("androidx.webkit:webkit:1.11.0")
}
