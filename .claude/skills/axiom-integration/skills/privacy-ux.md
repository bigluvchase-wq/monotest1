
# Privacy UX Patterns

Comprehensive guide to privacy-first app design. Apple Design Award Social Impact winners handle data ethically, and privacy-first design is a key differentiator.

## Overview

Privacy manifests (`PrivacyInfo.xcprivacy`) are Apple's framework for transparency about data collection and tracking. Combined with App Tracking Transparency and just-in-time permission requests, they help users make informed choices about their data.

This skill covers creating privacy manifests, requesting system permissions with excellent UX, implementing App Tracking Transparency, managing tracking domains, using Required Reason APIs, and preparing accurate Privacy Nutrition Labels.

## When to Use This Skill

- Creating privacy manifests (PrivacyInfo.xcprivacy)
- Requesting system permissions (Camera, Location, etc.)
- Implementing App Tracking Transparency (ATT)
- Preparing Privacy Nutrition Labels for App Store Connect
- Managing tracking domains to avoid accidental tracking
- Using Required Reason APIs (NSFileSystemFreeSize, UserDefaults, etc.)
- Explaining data usage to users transparently
- Debugging privacy-related App Store rejections

## System Requirements

- **iOS 14.5+** for App Tracking Transparency
- **iOS 17+** for automatic tracking domain blocking
- **Xcode 15+** for privacy reports and manifest editing
- **Spring 2024+** for App Review enforcement

---

## Part 1: Privacy Manifests

### Creating a Privacy Manifest

**Xcode Navigator**:
1. File → New → File
2. Choose "App Privacy File"
3. Name: `PrivacyInfo.xcprivacy`
4. Add to app target (or SDK framework)

**File structure** (Property List):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>NSPrivacyTracking</key>
    <false/>
    <key>NSPrivacyCollectedDataTypes</key>
    <array>
        <!-- Data types collected -->
    </array>
    <key>NSPrivacyAccessedAPITypes</key>
    <array>
        <!-- Required Reason APIs used -->
    </array>
</dict>
</plist>
```

### NSPrivacyTracking Declaration

**Does your app track users?**

Tracking means linking user or device data from your app with data from other companies' apps, websites, or offline properties for targeted advertising or advertising measurement, or sharing user or device data with data brokers. Apply the qualifying exceptions in Part 3 before declaring whether your app tracks.

```xml
<key>NSPrivacyTracking</key>
<true/>  <!-- or false -->
```

**If `true`**, you must also declare tracking domains:

```xml
<key>NSPrivacyTrackingDomains</key>
<array>
    <string>tracking.example.com</string>
    <string>analytics.example.com</string>
</array>
```

**iOS 17 behavior**: Network requests to tracking domains **automatically blocked** if user hasn't granted ATT permission.

### NSPrivacyCollectedDataTypes

Declare all data your app collects:

```xml
<key>NSPrivacyCollectedDataTypes</key>
<array>
    <dict>
        <key>NSPrivacyCollectedDataType</key>
        <string>NSPrivacyCollectedDataTypeName</string>

        <key>NSPrivacyCollectedDataTypeLinked</key>
        <true/>  <!-- Linked to user identity? -->

        <key>NSPrivacyCollectedDataTypeTracking</key>
        <false/>  <!-- Used for tracking? -->

        <key>NSPrivacyCollectedDataTypePurposes</key>
        <array>
            <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
            <string>NSPrivacyCollectedDataTypePurposeAnalytics</string>
        </array>
    </dict>
</array>
```

**Common data types**:
- `NSPrivacyCollectedDataTypeName` - User's name
- `NSPrivacyCollectedDataTypeEmailAddress`
- `NSPrivacyCollectedDataTypePhoneNumber`
- `NSPrivacyCollectedDataTypePhysicalAddress`
- `NSPrivacyCollectedDataTypePreciseLocation`
- `NSPrivacyCollectedDataTypeCoarseLocation`
- `NSPrivacyCollectedDataTypePhotosorVideos`
- `NSPrivacyCollectedDataTypeContacts`
- `NSPrivacyCollectedDataTypeUserID`

**Common purposes**:
- `NSPrivacyCollectedDataTypePurposeAppFunctionality`
- `NSPrivacyCollectedDataTypePurposeAnalytics`
- `NSPrivacyCollectedDataTypePurposeProductPersonalization`
- `NSPrivacyCollectedDataTypePurposeDeveloperAdvertising`
- `NSPrivacyCollectedDataTypePurposeThirdPartyAdvertising`

### NSPrivacyAccessedAPITypes

Declare Required Reason APIs (see Part 5):

```xml
<key>NSPrivacyAccessedAPITypes</key>
<array>
    <dict>
        <key>NSPrivacyAccessedAPIType</key>
        <string>NSPrivacyAccessedAPICategoryFileTimestamp</string>

        <key>NSPrivacyAccessedAPITypeReasons</key>
        <array>
            <string>C617.1</string>  <!-- Approved reason code -->
        </array>
    </dict>
</array>
```

---

## Part 2: Permission Request UX

### Just-in-Time vs Up-Front

**❌ Don't**: Request all permissions at launch
```swift
// BAD - overwhelming and confusing
func application(_ application: UIApplication,
                didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    requestCameraPermission()
    requestLocationPermission()
    requestNotificationPermission()
    requestPhotoLibraryPermission()
    return true
}
```

**✅ Do**: Request just-in-time when user triggers feature
```swift
// GOOD - clear causality
@objc func takePhotoButtonTapped() {
    // Optional explanation when the feature context needs more detail
    showCameraEducation {
        // Then request permission
        AVCaptureDevice.requestAccess(for: .video) { granted in
            // The completion runs on a system queue — hop back to the main actor
            Task { @MainActor in
                if granted {
                    self.openCamera()
                } else {
                    self.showPermissionDeniedAlert()
                }
            }
        }
    }
}
```

### Pre-Permission Education Screens

Use the feature context and a specific purpose string to explain the request. Add a pre-alert only when essential details need more explanation. These excerpts belong to a main-actor-isolated view controller; camera and permission-handling helpers are app-owned.

A pre-alert has one "Continue" or "Next" action that opens the system permission alert. The user grants or denies permission in that system alert. Do not add a cancel or close action. If an additional action is needed to obtain legal consent, Apple permits that exception; keep legal consent distinct from system authorization.

```swift
func showCameraEducation(completion: @escaping () -> Void) {
    let alert = UIAlertController(
        title: "Take Photos",
        message: "FoodSnap needs camera access to let you photograph your meals and get nutrition information.",
        preferredStyle: .alert
    )

    alert.addAction(UIAlertAction(title: "Continue", style: .default) { _ in
        completion()  // Now request actual permission
    })

    present(alert, animated: true)
}
```

Explain the specific data use so people can make an informed choice. A camera feature needs camera authorization; offer alternatives when permission is denied. Do not promise an opt-in increase.

### Permission Denied Handling

**Never dead-end the user**:

```swift
func handleCameraPermission() {
    switch AVCaptureDevice.authorizationStatus(for: .video) {
    case .authorized:
        openCamera()

    case .notDetermined:
        showCameraEducation {
            AVCaptureDevice.requestAccess(for: .video) { granted in
                // The completion runs on a system queue — hop back to the main actor
                Task { @MainActor in
                    if granted {
                        self.openCamera()
                    } else {
                        self.showSettingsPrompt()
                    }
                }
            }
        }

    case .denied, .restricted:
        showSettingsPrompt()  // Offer to open Settings

    @unknown default:
        break
    }
}

func showSettingsPrompt() {
    let alert = UIAlertController(
        title: "Camera Access Required",
        message: "Please enable camera access in Settings to use this feature.",
        preferredStyle: .alert
    )

    alert.addAction(UIAlertAction(title: "Open Settings", style: .default) { _ in
        if let url = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(url)
        }
    })

    alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))

    present(alert, animated: true)
}
```

### Settings Deep Links

Open specific settings screens:

```swift
// General app settings
UIApplication.shared.open(URL(string: UIApplication.openSettingsURLString)!)

// Notification settings (iOS 15.4+)
UIApplication.shared.open(URL(string: UIApplication.openNotificationSettingsURLString)!)
```

---

## Part 3: App Tracking Transparency

### When ATT Is Required

Obtain ATT authorization **before**:
- Linking user or device data from your app with data from other companies' apps, websites, or offline properties for targeted advertising or advertising measurement
- Sharing user or device data with data brokers, subject to the exceptions below
- Allowing third-party SDKs or libraries to perform that tracking

You are responsible for SDK and server-side behavior. Tracking still requires permission if your server shares the data, your app does not use the SDK's tracking features directly, or you receive only aggregate reports after cross-company data linkage. Check the SDK's actual data practices and consent configuration rather than inferring them from its name.

ATT is not required for first-party analytics or ads based solely on your own company's data when no tracking as defined above occurs. Apple's additional exceptions are:
- Data linkage occurs solely on the user's device, and the linked data is not sent off-device in a way that can identify the user or device.
- A data broker uses the shared data solely for fraud detection, fraud prevention, or security purposes.
- The broker is a consumer reporting agency and receives data to report creditworthiness or obtain creditworthiness information specifically to make a credit determination.

A fraud/security feature does not exempt other tracking by your app or its SDKs. Privacy manifest and App Store privacy disclosures remain separate obligations; ATT authorization does not permit fingerprinting.

### ATTrackingManager.requestTrackingAuthorization

This excerpt belongs to your main-actor-isolated view controller; the SDK initialization methods are app-owned.

```swift
import UIKit
import AppTrackingTransparency
import AdSupport

@MainActor
func requestTrackingPermission() {
    // ATT only prompts while the app is active and no other permission alert is
    // pending. If either precondition fails, no prompt appears and the status stays
    // .notDetermined — so call this from an active, user-initiated point (a tap, or
    // scenePhase/applicationDidBecomeActive), never from a fixed delay.
    guard UIApplication.shared.applicationState == .active else { return }

    ATTrackingManager.requestTrackingAuthorization { status in
        // Hop to MainActor before updating UI or consent-dependent SDK state.
        Task { @MainActor in
            switch status {
            case .authorized:
                // User granted permission
                // You can now access IDFA and track
                let idfa = ASIdentifierManager.shared().advertisingIdentifier
                self.initializeTrackingSDKs(idfa: idfa)

            case .denied:
                // User denied permission
                // Do NOT track
                self.initializeNonTrackingSDKs()

            case .notDetermined:
                // No decision recorded. Keep tracking disabled; retry only at a
                // later appropriate user-initiated point, not in this completion.
                self.initializeNonTrackingSDKs()

            case .restricted:
                // Device doesn't allow tracking (parental controls)
                self.initializeNonTrackingSDKs()

            @unknown default:
                self.initializeNonTrackingSDKs()
            }
        }
    }
}
```

### Expanded ATT Prompt from iOS 27.2

Build with the iOS 27.2 SDK to use `requestTrackingAuthorization(preferExpandedInterface:additionalInformationAction:completionHandler:)`. Gate the call at runtime with `#available(iOS 27.2, *)`; the classic method remains the fallback on earlier iOS versions. If building with an older SDK, use the classic example above: an availability check does not make a missing SDK declaration compile. The new method is explicitly unavailable on macOS, tvOS, watchOS, and visionOS.

- In the EU, `preferExpandedInterface: true` requests the alternative prompt where permitted. France, Germany, Italy, Poland, and Romania use the expanded interface regardless of this preference. Outside the EU, the new method behaves like the classic call. Let the system select the regional behavior; do not infer eligibility from the app's language.
- Pass an action to offer the optional "Additional Information" button, or `nil` to omit it. Tapping the button dismisses the prompt without a decision, invokes that action, and completes with `.notDetermined`. Show your privacy information and continue without tracking; a later request belongs at an appropriate user-initiated moment, not in a completion-handler retry loop.
- Hop to MainActor before updating UI or consent-dependent SDK state. The callbacks below carry no assumption about the queue on which ATT invokes them.

The callbacks are app-owned: `showPrivacyInformation` presents your privacy details, and `applyTrackingAuthorization` enables IDFA access and tracking **only** for `.authorized`, disabling tracking for every other status. Call from an active, user-initiated point with no other permission alert pending; serialize requests rather than firing concurrent prompts.

```swift
import UIKit
import AppTrackingTransparency

@MainActor
func requestTrackingPermission(
    showPrivacyInformation: @escaping @MainActor @Sendable () -> Void,
    applyTrackingAuthorization: @escaping @MainActor @Sendable (ATTrackingManager.AuthorizationStatus) -> Void
) {
    guard UIApplication.shared.applicationState == .active else { return }

    let completion: @Sendable (ATTrackingManager.AuthorizationStatus) -> Void = { status in
        Task { @MainActor in
            applyTrackingAuthorization(status)
        }
    }

    if #available(iOS 27.2, *) {
        ATTrackingManager.requestTrackingAuthorization(
            preferExpandedInterface: true,
            additionalInformationAction: {
                Task { @MainActor in
                    showPrivacyInformation()
                }
            },
            completionHandler: completion
        )
    } else {
        ATTrackingManager.requestTrackingAuthorization(completionHandler: completion)
    }
}
```

### Re-Prompting from iOS 27.2

Eligible EU users may be prompted again one year after their previous decision, whether they accepted or denied. The system enforces eligibility; if no new prompt is permitted, completion returns the existing decision. Disabling the device's setting that allows apps to request tracking prevents re-prompting. Do not treat a local "asked once" flag or a permanent `.notDetermined`-only request guard as the eligibility authority, and do not reset consent on your own annual timer. Request at an appropriate active, user-initiated point and apply the returned status. Until the status is `.authorized`, keep IDFA access and cross-company tracking disabled.

### Custom ATT Prompt Message

**Info.plist**:
```xml
<key>NSUserTrackingUsageDescription</key>
<string>We link activity across companies to personalize ads and measure advertising performance.</string>
<key>NSUserTrackingMarkdownUsageDescription</key>
<string>We link activity across companies to **personalize ads**.

- See relevant offers
- Measure advertising performance</string>
```

`NSUserTrackingUsageDescription` remains required. From iOS 27.2, the expanded prompt can display `NSUserTrackingMarkdownUsageDescription` with bold, italic, bullet points, and paragraph breaks; if the Markdown key is absent, it uses the plain usage description. Keep both descriptions accurate and localized. Markdown text and the additional-information action do not grant tracking permission.

**Best practices**:
- Be honest and specific
- Describe the specific data use and resulting feature; a generic benefit or funding message is insufficient
- Keep it concise (1-2 sentences)

**❌ Bad examples**:
- "We value your privacy" (vague)
- "This is required for the app to work" (dishonest)
- "Personalized ads help keep this app free" (does not explain the data use)

**✅ Good examples**:
- "We link your activity across companies to deliver personalized advertising."
- "We link your activity across companies to measure advertising performance."

### Pre-Tracking Prompt Design

A clear purpose string and feature context may be sufficient. If essential details need a pre-alert, explain the data use neutrally with one "Continue" action that opens ATT. Do not offer incentives, imply tracking is needed to keep features available, imitate the system alert, or steer the user toward allowing. Separate legal consent does not grant ATT authorization.

This excerpt belongs to your main-actor-isolated view controller; `requestTrackingPermission()` is the app-owned entry point shown above. Present it when active and no other permission alert is pending.

```swift
func showPreTrackingPrompt() {
    let alert = UIAlertController(
        title: "About Personalized Ads",
        message: "We link your activity across companies to personalize ads. You can allow or decline in the next system alert. All features remain available either way.",
        preferredStyle: .alert
    )

    alert.addAction(UIAlertAction(title: "Continue", style: .default) { _ in
        self.requestTrackingPermission()
    })

    present(alert, animated: true)
}
```

The explanation supports an informed decision; keep every app feature available when tracking is declined.

### Graceful Degradation

**Always provide value without tracking**:

```swift
func initializeAnalytics() {
    let status = ATTrackingManager.trackingAuthorizationStatus

    if status == .authorized {
        // Full featured analytics — IDFA-based attribution is allowed
        enableTrackingAnalytics()
    } else {
        // Limited, privacy-preserving analytics — no IDFA, no cross-app linking
        enableNonTrackingAnalytics()
    }
}
```

The two helpers are your own. Each vendor SDK exposes its own consent switch, so keep the ATT status as
the single source of truth and let these functions fan out to whichever SDKs are enabled.

---

## Part 4: Tracking Domain Management

### Declaring Tracking Domains

In `PrivacyInfo.xcprivacy`:

```xml
<key>NSPrivacyTracking</key>
<true/>

<key>NSPrivacyTrackingDomains</key>
<array>
    <string>tracking.example.com</string>
    <string>ads.example.com</string>
</array>
```

**iOS 17 behavior**: If user denies ATT, network requests to these domains are **automatically blocked**.

### Domain Separation Strategy

**Problem**: Single domain used for both tracking and non-tracking

**Solution**: Separate functionality into different hosts

```
Before:
- api.example.com (mixed tracking + app functionality)

After:
- api.example.com (app functionality only)
- tracking.example.com (tracking only)
```

**Update manifest**:
```xml
<key>NSPrivacyTrackingDomains</key>
<array>
    <string>tracking.example.com</string>  <!-- Declared, will be blocked -->
</array>
```

Result: App functionality continues working; tracking blocked if denied.

### Points of Interest Instrument (Xcode 15+)

**Detecting unexpected tracking connections**:

1. Xcode → Product → Profile
2. Pick a standard template that carries the lane — Points of Interest is an instrument inside the standard templates (e.g. Network), not an entry in the template chooser
3. Run app
4. Look for the Points of Interest track showing network connections
5. Review flagged domains

**What it shows**: Connections to domains that may be tracking users across apps/websites.

**Action**: Declare these domains in `NSPrivacyTrackingDomains` or stop connecting to them.

---

## Part 5: Required Reason APIs

### What Are Required Reason APIs?

APIs that **could** be misused for fingerprinting (identifying devices without permission).

**Fingerprinting is never allowed**, even with ATT permission.

**Required Reason APIs have approved use cases**. You must declare which approved reason applies to your usage.

### Common Required Reason APIs

| API Category | Examples | Approved Reason Codes |
|--------------|----------|----------------------|
| **File timestamp** | `creationDate`, `modificationDate` | `C617.1`, `DDA9.1`, `3B52.1`, `0A2A.1` |
| **System boot time** | `systemUptime`, `processInfo.systemUptime` | `35F9.1`, `8FFB.1`, `3D61.1` |
| **Disk space** | `NSFileSystemFreeSize`, `volumeAvailableCapacity` | `E174.1`, `85F4.1`, `7D9E.1`, `B728.1` |
| **Active keyboards** | `activeInputModes` | `54BD.1`, `3EC4.1` |
| **User defaults** | `UserDefaults` | `CA92.1`, `1C8F.1`, `C56D.1`, `AC6B.1` |

### Example: Disk Space API

**API**: `NSFileSystemFreeSize` / `URLResourceKey.volumeAvailableCapacityKey`

**Approved reasons**:
- **85F4.1**: Display disk space information to the person using the device
- **E174.1**: Write or delete a file on-device (check available space before writing)
- **7D9E.1**: Include disk space information in an optional bug report the person chooses to submit
- **B728.1**: Health research app — detect and inform research participants about low disk space

**Declaration in manifest**:
```xml
<key>NSPrivacyAccessedAPITypes</key>
<array>
    <dict>
        <key>NSPrivacyAccessedAPIType</key>
        <string>NSPrivacyAccessedAPICategoryDiskSpace</string>

        <key>NSPrivacyAccessedAPITypeReasons</key>
        <array>
            <string>E174.1</string>  <!-- Check space before writing -->
        </array>
    </dict>
</array>
```

**Code**:
```swift
func checkDiskSpace() -> Bool {
    do {
        let values = try FileManager.default.attributesOfFileSystem(forPath: NSHomeDirectory())

        if let freeSpace = values[.systemFreeSize] as? NSNumber {
            let requiredSpace: Int64 = 100 * 1024 * 1024  // 100 MB
            return freeSpace.int64Value > requiredSpace
        }
    } catch {
        print("Error checking disk space: \(error)")
    }

    return false
}

// Usage
if checkDiskSpace() {
    saveFile()  // Approved reason E174.1: Check before writing
} else {
    showInsufficientSpaceAlert()
}
```

### Example: UserDefaults API

**Approved reasons**:
- **CA92.1**: Access info stored by app (settings, preferences)
- **1C8F.1**: Access info stored by App Group
- **C56D.1**: Your third-party SDK provides a wrapper around the user defaults APIs for apps to use (SDKs only)
- **AC6B.1**: Read the `com.apple.configuration.managed` key for the managed app configuration set by MDM

**Declaration**:
```xml
<dict>
    <key>NSPrivacyAccessedAPIType</key>
    <string>NSPrivacyAccessedAPICategoryUserDefaults</string>

    <key>NSPrivacyAccessedAPITypeReasons</key>
    <array>
        <string>CA92.1</string>
    </array>
</dict>
```

### Feedback for Missing Reasons

If your use case isn't covered, request a new approved reason (Apple ID sign-in required):
https://developer.apple.com/contact/request/privacy-manifest-reason/

---

## Part 6: Privacy Nutrition Labels

### Data Types and Categories

**Identifiers**:
- User ID
- Device ID

**Contact Info**:
- Name
- Email address
- Phone number
- Physical address

**Location**:
- Precise location
- Coarse location

**User Content**:
- Photos or videos
- Audio data
- Gameplay content
- Customer support messages

**Browsing History**
**Search History**
**Financial Info**
**Health & Fitness**
**Contacts**
**Sensitive Info** (racial/ethnic data, political opinions, religious beliefs)

### Data Use Purposes

- **App functionality** - Necessary for core features
- **Analytics** - Understanding app usage
- **Product personalization** - Customizing experience
- **Developer advertising** - Ads for your own products
- **Third-party advertising** - Ads from other companies

### Linked vs Not Linked

**Linked to user**:
- Data connected to user identity (name, email, user ID)
- Example: User profile information

**Not linked to user**:
- Data not connected to identity (anonymous analytics)
- Example: Aggregate crash reports

### Tracking Disclosure

Apply the tracking definition and qualifying exceptions in Part 3. Disclose cross-company linkage for targeted advertising or advertising measurement, and data-broker sharing that meets that definition. A Privacy Nutrition Label describes data practices; it does not obtain ATT permission.

**Example declaration**:
```
Data Type: Email Address
Purpose: App Functionality
Linked to User: Yes
Used for Tracking: No
```

---

## Part 7: Xcode Privacy Report

### Generating Report

1. Archive app: Product → Archive
2. Xcode Organizer → Select archive
3. Right-click → "Generate Privacy Report"
4. PDF created showing aggregated privacy data

**What's included**:
- All privacy manifests (app + third-party SDKs)
- Collected data types
- Tracking declaration
- Required Reason APIs

### Reviewing Report

**Check for**:
- Unexpected data collection (SDK collecting data you didn't know about)
- Missing Required Reason declarations
- Tracking domain discrepancies
- Third-party SDKs without privacy manifests

**Use for**: Completing Privacy Nutrition Labels in App Store Connect

---

## Part 8: Permission Types

### Camera

```swift
import AVFoundation

AVCaptureDevice.requestAccess(for: .video) { granted in
    // Handle response
}
```

**Info.plist**:
```xml
<key>NSCameraUsageDescription</key>
<string>Take photos of your meals to track nutrition</string>
```

### Microphone

```swift
import AVFAudio

AVAudioApplication.requestRecordPermission { granted in
    // Handle response
}
```

**Availability**: `AVAudioApplication` is iOS 17+ (macOS 14+, tvOS 17+, watchOS 10+). On iOS 14.5–16 the equivalent is `AVAudioSession.sharedInstance().requestRecordPermission(_:)`, deprecated in iOS 17 and unavailable on macOS/tvOS.

**Info.plist**:
```xml
<key>NSMicrophoneUsageDescription</key>
<string>Record voice memos</string>
```

### Location

```swift
import CoreLocation

class LocationManager: NSObject, CLLocationManagerDelegate {
    let manager = CLLocationManager()

    func requestPermission() {
        manager.delegate = self

        // Choose one:
        manager.requestWhenInUseAuthorization()  // Only when app is open
        // OR
        manager.requestAlwaysAuthorization()     // Background location
    }
}
```

**Info.plist (iOS 14+)**:
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Show nearby restaurants</string>

<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Track your runs even when the app is in the background</string>
```

### Photos

```swift
import Photos

PHPhotoLibrary.requestAuthorization(for: .readWrite) { status in
    switch status {
    case .authorized, .limited:  // .limited = selected photos only
        // Access granted
        break
    case .denied, .restricted:
        // Access denied
        break
    case .notDetermined:
        // No decision recorded — not authorized
        break
    @unknown default:
        break
    }
}
```

**Info.plist**:
```xml
<key>NSPhotoLibraryUsageDescription</key>
<string>Save and share your workout photos</string>
```

### Contacts

```swift
import Contacts

CNContactStore().requestAccess(for: .contacts) { granted, error in
    // Handle response
}
```

**Info.plist**:
```xml
<key>NSContactsUsageDescription</key>
<string>Invite friends to join you</string>
```

### Notifications

```swift
import UserNotifications

UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
    // Handle response
}

// No Info.plist entry required
```

---

## Part 9: Privacy-First Design Patterns

### Data Minimization

**Principle**: Only collect data you actually need

```swift
// ❌ Bad - collecting unnecessary data
struct VerboseUserProfile {
    let name: String
    let email: String
    let phone: String           // Do you really need this?
    let dateOfBirth: Date       // Or this?
    let socialSecurityNumber: String  // Definitely not
}

// ✅ Good - minimal data collection
struct UserProfile {
    let name: String
    let email: String
    // That's it
}
```

### On-Device Processing

**Principle**: Process data locally when possible

```swift
// ✅ Good - on-device ML
import Vision

func analyzePhoto(_ image: UIImage) {
    let request = VNClassifyImageRequest { request, error in
        // Results stay on device
        let classifications = request.results as? [VNClassificationObservation]
        self.displayResults(classifications)
    }

    let handler = VNImageRequestHandler(cgImage: image.cgImage!)
    try? handler.perform([request])
    // No network request, no data leaving device
}
```

### Explaining Value Exchange

**Principle**: Be transparent about why you need data

```swift
// ✅ Good - clear value proposition
"We use your location to show nearby restaurants and save your favorite places. Your location is never shared with third parties."
```

### Transparent Data Practices

**Principle**: Make privacy information easily accessible

```swift
// Add Privacy Policy link in Settings screen
struct SettingsView: View {
    var body: some View {
        List {
            Section("About") {
                Link("Privacy Policy", destination: URL(string: "https://example.com/privacy")!)
                Link("Data We Collect", destination: URL(string: "https://example.com/data")!)
            }
        }
    }
}
```

---

## Common Mistakes

### Requesting permissions at launch

```swift
// ❌ Wrong
func application(_ application: UIApplication,
                didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    requestAllPermissions()  // User has no context
    return true
}

// ✅ Correct
@objc func cameraButtonTapped() {
    requestCameraPermission()  // Just-in-time
}
```

### Unclear permission requests

Use a specific, localized purpose string explaining what your app does with the data. Request access in the feature context. A direct system request is appropriate when that context is clear; add a pre-alert only when essential details need explanation, following the single-action pattern in Part 2.

### Not handling denial gracefully

```swift
// ❌ Wrong - dead end
if !granted {
    return  // User stuck
}

// ✅ Correct - offer alternative
if !granted {
    showSettingsPrompt()  // Path forward
}
```

### Missing tracking domains

```xml
<!-- ❌ Wrong - privacy manifest declares tracking but no domains -->
<key>NSPrivacyTracking</key>
<true/>
<!-- Missing NSPrivacyTrackingDomains -->

<!-- ✅ Correct -->
<key>NSPrivacyTrackingDomains</key>
<array>
    <string>tracking.example.com</string>
</array>
```

### Incomplete Required Reason declarations

```swift
// ❌ Wrong - using UserDefaults without declaring it
UserDefaults.standard.set(value, forKey: "setting")
// Privacy manifest has no NSPrivacyAccessedAPITypes entry

// ✅ Correct - declared in manifest with approved reason
```

---

## Timeline

| Date | Milestone |
|------|-----------|
| **WWDC 2023** | Privacy manifests announced |
| **Fall 2023** | Informational emails begin |
| **Spring 2024** | App Review enforcement begins |
| **May 1, 2024** | Privacy manifests required for apps with privacy-impacting SDKs |

---

## Resources

**WWDC**: 2022-10166, 2023-10060, 2023-10053

**Docs**: /design/human-interface-guidelines/privacy, /help/app-review/guideline-reference/5-1-1-purpose-strings, /technotes/tn3181-debugging-invalid-privacy-manifest, /technotes/tn3182-adding-privacy-tracking-keys-to-your-privacy-manifest, /bundleresources/privacy_manifest_files, /bundleresources/describing-use-of-required-reason-api, /app-store/app-privacy-details, /app-store/user-privacy-and-data-use, /apptrackingtransparency/attrackingmanager, /bundleresources/information-property-list/nsusertrackingmarkdownusagedescription

**Skills**: skills/contacts.md (contact permission handling), skills/eventkit.md (calendar permission handling), axiom-shipping (skills/app-store-ref.md), Launch `security-privacy-scanner` agent (ATT and manifest detection)
