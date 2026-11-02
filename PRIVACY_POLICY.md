# BattleGrid Privacy Policy

**Effective date:** 7 Oct 2026

## Overview

BattleGrid ("the App", "we", "us") is a mobile game published by the developer identified at the end of this policy. This Privacy Policy explains what information the App collects, how it is used, who it is shared with, and the choices available to you. It applies to the BattleGrid app on Android and iOS.

BattleGrid is intended for players **13 years of age and older**. By using BattleGrid, you agree to the collection and use of information as described here. If you do not agree, please do not use the App.

## Information We Collect

### Account and identity information

On first launch, the App automatically creates an anonymous account for you (via Firebase Authentication) and assigns it a randomly generated pseudonym (e.g. "NeonFalcon"), so you can play and appear on leaderboards without providing any personal details.

If you choose to sign in with **Google Play Games** (Android only, optional), we receive your Play Games display name and profile photo. Play Games sign-in does not normally grant us access to your email address; on the rare occasion it is provided, it is never shown on the leaderboard.

### Gameplay data

Coins, stars, unlocked levels, win/loss record and streaks, daily bonus claims, owned and equipped cosmetics (skins, troop shapes, boards, titles), battle items and upgrades, and game settings (sound, music, vibration) — all linked to your account identifier (uid).

### Location information

With your explicit permission, we use your device's coarse (approximate) location to determine your country and city, so we can show you Country and City leaderboards. This is never requested automatically — only when you open those leaderboard tabs.

### Device-local information

Some information (your saved profile and a local guest identifier) is stored only on your device using local app storage, so the App keeps working offline.

### Automatically collected usage data

We use Google Analytics for Firebase to log basic gameplay events (such as signing in with Play Games, or finishing a level) together with standard device/app identifiers that Firebase Analytics collects automatically.

## How We Use Your Information

We use the information described above to:

- Operate the Worldwide, Country, and City leaderboards, ranked by lifetime coins earned.
- Save your progress, coins, stars, cosmetics, and settings, and restore them across sessions, reinstalls, and devices when you're signed in.
- Display your chosen name and avatar (Play Games photo, or your generated pseudonym) next to your scores.
- Understand feature usage and app performance through aggregated analytics, so we can improve the App.

We do not use your information to serve you personalized advertising, and BattleGrid contains no ad network SDKs.

## Location Data

BattleGrid requests only coarse (approximate) location, and only to power the Country and City leaderboard tabs — never automatically at launch, and never to track your movements.

When you open the Country or City leaderboard for the first time, your device prompts you for location permission. If granted, we take one approximate location fix and send its coordinates to BigDataCloud's reverse-geocoding API to resolve a country, city, and country code. We store the resulting country/city (not raw GPS coordinates) against your account so the leaderboard can be filtered to your area, and cache it in memory for the rest of your app session to avoid repeated location requests.

If you deny or later revoke location permission, the Country and City leaderboards simply stay unavailable — every other part of the App, including the Worldwide leaderboard, continues to work normally.

## Third-Party Services

BattleGrid relies on the following third-party services to operate. Each processes data on our behalf under its own privacy terms:

| Service | Purpose | Data involved |
| --- | --- | --- |
| Google Firebase Authentication | Creates and manages your anonymous or Play Games–linked account | Account identifier (uid), display name, photo |
| Google Cloud Firestore | Stores leaderboard entries and player progress | uid, name, avatar, score, progress, settings, country/city |
| Google Analytics for Firebase | App usage analytics | Gameplay events, device/app identifiers |
| Google Play Games Services | Optional sign-in on Android | Play Games display name, photo, rarely email |
| BigDataCloud reverse geocoding API | Converts GPS coordinates into a country/city name | Approximate latitude/longitude (sent only when you use a Country/City leaderboard) |

We do not sell your personal information, and we do not use any advertising SDKs.

## Data Storage, Retention & Security

Account, leaderboard, and progress data are stored on Google Firebase/Google Cloud infrastructure. Your profile and a local guest identifier are also stored locally on your device and are removed if you uninstall the App.

We retain your account and gameplay data for as long as your account is active, so your progress and leaderboard history are preserved across sessions and reinstalls. You may request deletion of your data at any time (see "Your Rights and Choices" below).

We rely on the security safeguards built into Firebase Authentication and Firestore, including transport encryption and access rules that restrict who can read or write your data. No method of transmission or storage is 100% secure, and we cannot guarantee absolute security.

## Children's Privacy

BattleGrid is intended for players 13 years of age and older. It is not directed at children under 13, and we do not knowingly collect personal information from children under 13 (or the minimum age required by your local law). If you believe a child has provided us with personal information, please contact us using the details below and we will delete it.

## Your Rights and Choices

- **Play as a guest.** You can play, save progress, and appear on leaderboards using only the anonymous account the App creates automatically — no personal information is required.
- **Control location access.** You can deny or revoke the location permission at any time from your device's settings; only the Country/City leaderboards are affected.
- **Sign out.** Signing out of Google Play Games ends that session; the App then continues with a fresh guest account.
- **Access, correct, or delete your data.** You may request a copy of, correction to, or deletion of the data associated with your account by contacting us at the email below. We will respond within a reasonable timeframe.

Depending on where you live, you may have additional rights under laws such as the GDPR or CCPA, including the right to object to or restrict certain processing. Contact us to exercise any of these rights.

## Changes to This Policy

We may update this Privacy Policy from time to time to reflect changes in the App or applicable law. We will update the effective date at the top of this page when we do, and, for material changes, we will provide additional notice (such as an in-app message) where appropriate. We encourage you to review this page periodically.

## Contact Us

Hello World Technologies LLC
Email: hello@helloworldtech.com
Contact: +1 (347) 845-3003
