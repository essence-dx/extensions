plugins {
    id("org.jetbrains.intellij.platform") version "2.2.1"
    kotlin("jvm") version "2.0.21"
}

group = "dev.dx"
version = "0.1.0"

kotlin {
    jvmToolchain(17)
}

dependencies {
    intellijPlatform {
        intellijIdeaCommunity("2024.3")
        bundledPlugin("com.intellij")
    }
}

intellijPlatform {
    pluginConfiguration {
        id = "dev.dx.intellij-platform.command-center"
        name = "DX IntelliJ Platform Command Center"
        version = project.version.toString()
    }
}
