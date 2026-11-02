// Bridges Google Play Games Services sign-in into Firebase Auth.
//
// There is no JS-level PlayGamesAuthProvider in @react-native-firebase/auth
// (only Android's native Firebase Auth SDK has that class), so the entire
// exchange — Play Games sign-in -> server auth code -> Firebase credential ->
// sign-in/link — happens here in Kotlin against FirebaseAuth.getInstance().
// @react-native-firebase/auth reads from that same native singleton, so its
// JS onAuthStateChanged listener fires as soon as this resolves without any
// extra plumbing back to JS.
//
// Uses Play Games Services v2 (com.google.android.gms.games.PlayGames), not
// the older GoogleSignInClient/GoogleSignInOptions API — that API's public
// sign-in entry points have been removed from current play-services-auth
// releases. v2 is fully Task-based: GamesSignInClient.signIn() drives its own
// UI internally, so there is no startActivityForResult/onActivityResult to
// wire up here.
package com.battlegrid.playgames

import android.app.Activity
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.games.GamesSignInClient
import com.google.android.gms.games.PlayGames
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseAuthUserCollisionException
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.PlayGamesAuthProvider
import com.google.firebase.auth.UserProfileChangeRequest

class PlayGamesAuthModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private var signInInProgress = false

  override fun getName(): String = "PlayGamesAuth"

  /** default_web_client_id is generated into the app's resources by the
   *  google-services Gradle plugin, and only exists once
   *  android/app/google-services.json has been added. Looked up by name so
   *  this module still compiles (and reports NO_WEB_CLIENT_ID at runtime)
   *  in a checkout that does not have that file yet. */
  private fun readWebClientId(): String {
    val id = reactContext.resources.getIdentifier("default_web_client_id", "string", reactContext.packageName)
    check(id != 0) { "default_web_client_id is not defined" }
    return reactContext.getString(id)
  }

  @ReactMethod
  fun signIn(promise: Promise) {
    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "No current activity")
      return
    }
    if (signInInProgress) {
      promise.reject("IN_PROGRESS", "A sign-in is already in progress")
      return
    }

    // The manifest's Play Games APP_ID is still the all-zero placeholder, so
    // Google's sign-in sheet would open and close without saying why.
    val appIdRes = reactContext.resources.getIdentifier("app_id", "string", reactContext.packageName)
    if (appIdRes == 0 || reactContext.getString(appIdRes).all { it == '0' }) {
      promise.reject(
        "NO_PLAY_GAMES_APP_ID",
        "The Play Games Application ID in res/values/strings.xml (app_id) is still the placeholder.",
      )
      return
    }

    val webClientId: String
    try {
      webClientId = readWebClientId()
    } catch (e: Exception) {
      promise.reject(
        "NO_WEB_CLIENT_ID",
        "res/values/strings.xml has no default_web_client_id — this is generated " +
          "by the google-services Gradle plugin from android/app/google-services.json. " +
          "Download the real config file from the Firebase console first.",
        e,
      )
      return
    }

    signInInProgress = true
    val signInClient = PlayGames.getGamesSignInClient(activity)
    signInClient
      .signIn()
      .addOnSuccessListener { result ->
        if (!result.isAuthenticated) {
          signInInProgress = false
          promise.reject("SIGN_IN_ERROR", "Play Games sign-in did not complete")
          return@addOnSuccessListener
        }
        requestServerAuthCode(activity, signInClient, webClientId, promise)
      }
      .addOnFailureListener { err ->
        signInInProgress = false
        rejectSignIn(promise, err, "SIGN_IN_ERROR")
      }
  }

  /** Silent, UI-free counterpart to signIn for app launch: if Play Games
   *  still has the player signed in, make sure Firebase is on their Play
   *  Games account too. Resolves {uid} on success, null when there is
   *  nothing to restore. */
  @ReactMethod
  fun restoreSession(promise: Promise) {
    val activity = reactContext.currentActivity
    if (activity == null || signInInProgress) {
      promise.resolve(null)
      return
    }
    val webClientId = try {
      readWebClientId()
    } catch (e: Exception) {
      promise.resolve(null)
      return
    }

    signInInProgress = true
    val signInClient = PlayGames.getGamesSignInClient(activity)
    signInClient
      .isAuthenticated()
      .addOnSuccessListener { result ->
        if (!result.isAuthenticated) {
          signInInProgress = false
          promise.resolve(null)
          return@addOnSuccessListener
        }
        val current = FirebaseAuth.getInstance().currentUser
        if (current != null && current.providerData.any { it.providerId == PlayGamesAuthProvider.PROVIDER_ID }) {
          signInInProgress = false
          promise.resolve(Arguments.createMap().apply { putString("uid", current.uid) })
          return@addOnSuccessListener
        }
        requestServerAuthCode(activity, signInClient, webClientId, promise)
      }
      .addOnFailureListener {
        signInInProgress = false
        promise.resolve(null)
      }
  }

  private fun requestServerAuthCode(
    activity: Activity,
    signInClient: GamesSignInClient,
    webClientId: String,
    promise: Promise,
  ) {
    signInClient
      // forceRefreshToken=true: false can hand back a cached, already-consumed
      // auth code, which Firebase's token exchange then rejects with
      // invalid_grant on every attempt.
      .requestServerSideAccess(webClientId, true)
      .addOnSuccessListener { authCode ->
        firebaseAuthWithPlayGames(activity, signInClient, webClientId, authCode, promise)
      }
      .addOnFailureListener { err ->
        signInInProgress = false
        rejectSignIn(promise, err, "NO_AUTH_CODE")
      }
  }

  /** Cancelling the account picker/consent sheet surfaces here as an
   *  ApiException with CommonStatusCodes.CANCELED — map it to a distinct
   *  code so JS (src/firebase/auth.ts) can treat it as a silent no-op
   *  instead of an error, matching every other failure path. */
  private fun rejectSignIn(promise: Promise, err: Exception, defaultCode: String) {
    if ((err as? ApiException)?.statusCode == CommonStatusCodes.CANCELED) {
      promise.reject("SIGN_IN_CANCELLED", "Play Games sign-in was cancelled", err)
    } else {
      promise.reject(defaultCode, describeFailure(err), err)
    }
  }

  @ReactMethod
  fun signOut(promise: Promise) {
    // Games Sign-In v2 has no client-side sign-out of its own — it mirrors
    // whichever Google account is active on the device. Firebase's own
    // signOut (called from JS right after this resolves) is what actually
    // ends this app's session.
    promise.resolve(null)
  }

  private fun describeFailure(err: Throwable): String {
    val statusCode = (err as? ApiException)?.statusCode
    return if (statusCode != null) {
      "Play Games sign-in failed: ${CommonStatusCodes.getStatusCodeString(statusCode)} (status $statusCode)"
    } else {
      "Play Games sign-in failed${err.message?.let { ": $it" } ?: ""}"
    }
  }

  private fun firebaseAuthWithPlayGames(
    activity: Activity,
    signInClient: GamesSignInClient,
    webClientId: String,
    authCode: String,
    promise: Promise,
  ) {
    val credential = PlayGamesAuthProvider.getCredential(authCode)
    val auth = FirebaseAuth.getInstance()
    val current = auth.currentUser
    // Deciding whether to link (keep this uid) or sign in fresh (switch uid)
    // must not rest on current.isAnonymous alone: the JS side of this app
    // (src/firebase/auth.ts, profileFromUser) already documents that flag as
    // unreliable on this SDK. Gate on the authoritative signal instead — does
    // this user already carry a Play Games credential? If not (whether it's
    // anonymous or some other pre-linked state), attempt to link it; a
    // genuine collision with an existing account is still caught below.
    val alreadyLinkedToPlayGames =
      current?.providerData?.any { it.providerId == PlayGamesAuthProvider.PROVIDER_ID } == true

    if (current != null && !alreadyLinkedToPlayGames) {
      current
        .linkWithCredential(credential)
        .addOnSuccessListener { result -> finishSignIn(activity, result.user, promise) }
        .addOnFailureListener { err ->
          if (err is FirebaseAuthUserCollisionException) {
            // This Play Games account already owns a different uid (a
            // returning player on a fresh install) — switch to it instead.
            // The link attempt already redeemed authCode, and server auth
            // codes are single-use: reusing it fails with invalid_grant, so
            // fetch a fresh one for the sign-in.
            signInClient
              .requestServerSideAccess(webClientId, true)
              .addOnSuccessListener { freshCode -> signInWithCode(activity, auth, freshCode, promise) }
              .addOnFailureListener { e2 ->
                signInInProgress = false
                rejectSignIn(promise, e2, "NO_AUTH_CODE")
              }
          } else {
            signInInProgress = false
            promise.reject("SIGN_IN_ERROR", err.message, err)
          }
        }
    } else {
      signInWithCode(activity, auth, authCode, promise)
    }
  }

  private fun signInWithCode(activity: Activity, auth: FirebaseAuth, authCode: String, promise: Promise) {
    auth
      .signInWithCredential(PlayGamesAuthProvider.getCredential(authCode))
      .addOnSuccessListener { result -> finishSignIn(activity, result.user, promise) }
      .addOnFailureListener { err ->
        signInInProgress = false
        promise.reject("SIGN_IN_ERROR", err.message, err)
      }
  }

  /** Linking/signing in keeps whatever name+photo the account already had
   *  (none, for a guest), so copy the Play Games player profile onto it
   *  explicitly — mirrors the Google Sign-In flow this replaces. Profile
   *  copy is cosmetic, so a failure here still resolves the sign-in. */
  private fun finishSignIn(activity: Activity, user: FirebaseUser?, promise: Promise) {
    if (user == null) {
      signInInProgress = false
      promise.reject("SIGN_IN_ERROR", "Sign-in succeeded but returned no user")
      return
    }

    val resolve = {
      signInInProgress = false
      val map = Arguments.createMap()
      map.putString("uid", user.uid)
      promise.resolve(map)
    }

    PlayGames.getPlayersClient(activity)
      .getCurrentPlayer()
      .addOnSuccessListener { player ->
        val photoUrl = if (player.hasIconImage()) player.iconImageUri else null
        val needsName = user.displayName != player.displayName
        val needsPhoto = photoUrl != null && user.photoUrl != photoUrl

        if (needsName || needsPhoto) {
          val update = UserProfileChangeRequest.Builder()
          if (needsName) update.setDisplayName(player.displayName)
          if (needsPhoto) update.setPhotoUri(photoUrl)
          user.updateProfile(update.build()).addOnCompleteListener { resolve() }
        } else {
          resolve()
        }
      }
      .addOnFailureListener { resolve() }
  }
}
