package com.battlegrid

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.battlegrid.playgames.PlayGamesAuthPackage
import com.google.android.gms.games.PlayGamesSdk
import com.facebook.ads.AdSettings

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(PlayGamesAuthPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    // Required by Play Games v2; also lets it silently re-sign-in a returning
    // player on launch, which PlayGamesAuth.restoreSession relies on. Play
    // Games is optional (guests play without it), so a missing or invalid
    // app id must never take the app down.
    try {
      PlayGamesSdk.initialize(this)
    } catch (e: Exception) {
      android.util.Log.w("BattleGrid", "Play Games SDK not initialised", e)
    }
    // Debug builds get Meta Audience Network test ads (LevelPlay's Meta
    // adapter serves whatever Meta returns); release builds get live ads.
    if (BuildConfig.DEBUG) AdSettings.setTestMode(true)
    loadReactNative(this)
  }
}
