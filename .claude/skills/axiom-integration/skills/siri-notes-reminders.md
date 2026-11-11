
# Siri for Notes, Lists, and Reminders Apps

Moving a note-taking, to-do, or list app's Siri support into the 27 cycle. The 27 SDK deprecates SiriKit's Lists and Notes intents with one instruction — "Please adopt the Notes or Reminders AppSchema domain instead" — and that replacement does not cover every platform or every intent the old domain had.

| Path | Reached by | Platforms |
|---|---|---|
| `.notes.*` / `.reminders.*` App Intents schemas | Siri AI (Apple Intelligence) | `OS27`, not watchOS/tvOS |
| SiriKit Lists and Notes (`INAddTasksIntent`, `INCreateNoteIntent`, …), deprecated | Classic Siri | iOS, watchOS; not macOS/tvOS |
| App Shortcuts (`AppShortcutsProvider`), not deprecated | The fixed phrases you define, in any Siri | iOS 16+, macOS 13+, watchOS 9+, tvOS 16+ |

Every required parameter, property, case, and return type for both domains: `skills/app-schemas-ref.md`. Phrases and the separate App Shortcuts Siri opt-in: `skills/app-shortcuts-ref.md`. The Siri AI vs classic Siri split, worked through for audio: `skills/siri-audio.md`.

## When to Use This Skill

- An app handles `INAddTasksIntent`, `INSetTaskAttributeIntent`, `INSnoozeTasksIntent`, `INCreateNoteIntent`, `INSearchForNotebookItemsIntent`, `INAppendToNoteIntent`, `INCreateTaskListIntent`, or `INDeleteTasksIntent`, and the 27 SDK now warns
- Adding "create a reminder", "mark this as done", or "add to my note" Siri support to a notes, list, or task app
- Adopting any `@AppIntent(schema: .reminders.…)` or `.notes.…` schema
- Deciding what to do about watchOS, or about users on iOS 26

NOT for EventKit access to the system Reminders store (`skills/eventkit.md`), or App Intents mechanics in general (`skills/app-intents-ref.md`).

## What the SDK Says

In the iOS 27.1 SDK headers:

| SiriKit class | State | Message |
|---|---|---|
| `INAddTasksIntent`, `INSetTaskAttributeIntent`, `INSnoozeTasksIntent`, `INCreateNoteIntent`, `INSearchForNotebookItemsIntent` (and their handling, response, and value types such as `INTaskPriority`) | Deprecated in iOS 27 and watchOS 27 | "Please adopt the Notes or Reminders AppSchema domain instead." |
| `INAppendToNoteIntent`, `INCreateTaskListIntent`, `INDeleteTasksIntent` | Deprecated since iOS 15 and watchOS 8, still present | "There is no replacement." |
| All of them | `API_UNAVAILABLE(macos, tvos)` | — |

Deprecated means compile warnings, not removal. The SDK does not say whether classic Siri still dispatches these intents on 27, or still dispatches the three deprecated since 15. Confirm it on a device before you rely on it either way.

## Red Flags

| Thought | Reality |
|---|---|
| "Deprecated, so delete the Intents extension" | It still serves watchOS (no Notes or Reminders schema exists there), users on iOS 26 and earlier, and classic Siri wherever SiriKit dispatch still works. App Shortcuts can cover some of the same requests in every Siri, but only by your fixed phrases. Delete a handler only after something else covers each of those groups: run each of its requests on Siri AI, on classic Siri, and on Apple Watch, and write down the result. An App Shortcut covers a request only when the same request, parameters included, works through it. |
| "Port each SiriKit intent to the schema of the same name" | The domains differ. Reminders has no snooze schema, notes have no search schema, `createReminder` takes one `title`, not a list of titles, `createList` takes no tasks, no schema deletes a list, and `updateNote` has no `content`, so no schema replaces a note's text (`appendText` only adds). Map by capability (table below). |
| "I'll declare only the parameters my app supports" | The schema fixes the set. `createReminder` requires `images`, `tags`, `urls`, `section`, `recurrence`, and more. A missing one fails the build with `Missing required parameter`. Declare every one, then in `perform()` use each value or say it was not applied: throw, or name it in the dialog. Never drop one silently; the user hears success and their tag or image is gone. |
| "`images: [IntentFile]` is enough" | It also needs `@Parameter(supportedContentTypes: [.image])`, or the build fails. `createNote`/`updateNote` `attachments` need a type conforming to `public.item`. |
| "macOS has no Siri path for this" | It does: the schemas include macOS 27, and App Shortcuts run there. Only SiriKit Lists/Notes is unavailable on macOS. |
| "My list entity is just a name" | `.reminders.list` and `createList` require `type: .reminders.listType`, an enum that must contain at least `standard`. |
| "A plain `EntityQuery` is enough for my section and folder entities" | Every entity an intent takes as a parameter must be resolvable: `IndexedEntity`, a default `EntityStringQuery`, an `IntentValueQuery`, `UniqueAppEntity`, or `TransientAppEntity`. Otherwise the build fails: `AppSchemaIntent 'CreateReminderIntent' requires 'TaskSectionEntity' to conform to 'IndexedEntity', 'UniqueAppEntity', 'TransientAppEntity', provide a default 'EntityStringQuery', or provide an 'IntentValueQuery'`. Measured for `.notes.folder`, `.reminders.section`, and `.reminders.locationTrigger`. An entity used only as a property, such as `.notes.account`, builds with a plain `EntityQuery`. |
| "Green build means Siri can act on 'this reminder'" | The build checks that each parameter entity can be resolved, not that your query finds the reminder or note a request names. Try real requests on a device. |

## Mapping SiriKit to Schemas

Apple publishes no mapping, and says "There is no replacement" for the three intents deprecated in iOS 15. These pairs are Axiom's match of each intent's capability and fields to the closest schema. How Siri AI routes a given spoken request to a schema is untested.

| SiriKit | Schema | Fields |
|---|---|---|
| `INAddTasksIntent` | `.reminders.createReminder` | `taskTitles` → `title`, which holds one title; how Siri AI handles a request naming several is untested; `targetTaskList` → `list`; triggers and `priority` as below |
| `INSetTaskAttributeIntent` | `.reminders.updateReminder` | `targetTask` → `target`; `status` → `isCompleted` (`.unknown` → `nil`); `taskTitle` → `title`; triggers and `priority` as below |
| `INSnoozeTasksIntent` | `.reminders.updateReminder` with a new `dueDate` | `tasks` → `target`, which holds one reminder; how Siri AI handles "snooze all of these" is untested. No snooze schema exists |
| `INCreateTaskListIntent` | `.reminders.createList` | `title` → `name`; `type` is new and required. `taskTitles` has no counterpart, so create reminders separately. `groupName` corresponds to the `.reminders.group` entity, which has no create intent |
| `INDeleteTasksIntent` | `.reminders.deleteReminders` (a `DeleteIntent`) | `tasks` → `entities`. `all` and `taskList` ("delete everything in this list") have no counterpart, and no schema deletes the list itself; pass the reminders explicitly |
| `INCreateNoteIntent` | `.notes.createNote` | `title` → `name` (`AttributedString`); `INTextNoteContent.text` → `content`; `INImageNoteContent.image` → `attachments`; `groupName` (a name) → `folder` (your `.notes.folder` entity; look it up by name) |
| `INAppendToNoteIntent` | `.notes.appendText` | `targetNote` → `target`; text content → `content` |
| `INSearchForNotebookItemsIntent` | No search schema in either domain | `.system.searchInApp` (`ShowInAppSearchResultsIntent`) opens your app's own search results; it returns nothing for Siri to read back, as the SiriKit response did |

Field conversions shared by the reminder rows:

| SiriKit | Schema |
|---|---|
| `temporalEventTrigger.dateComponentsRange.startDateComponents` | `dueDate: DateComponents?` |
| `temporalEventTrigger.dateComponentsRange.recurrenceRule` (`INRecurrenceRule`) | `recurrence: Calendar.RecurrenceRule?` |
| `spatialEventTrigger.placemark` (`CLPlacemark`) | `.reminders.locationTrigger` `place: GeoToolbox.PlaceDescriptor` |
| `spatialEventTrigger.event` (`INSpatialEvent` `.arrive`/`.depart`) | `.reminders.locationTriggerEvent` (`arrive`, `depart`) |
| `priority` (`INTaskPriority` `.flagged`/`.notFlagged`/`.unknown`) | `isFlagged: Bool?` — `true`/`false`/`nil` |

Sections (`.reminders.section`, `createSection`) and accounts (`.notes.account`) have no SiriKit counterpart.

## Build Order

1. **Entities first.** Adopt `.reminders.reminder`, `.reminders.list`, `.notes.note`, `.notes.folder`, and every other schema type your intents take or return, with each one's required properties at their exact optionality.
2. **One intent at a time.** Start with the highest-traffic action, usually `createReminder` or `createNote`. Each intent needs every schema type it names already adopted.
3. **Gate for older targets.** Below a 27 deployment target, put `@available(anyAppleOS 27, *) @available(watchOS, unavailable) @available(tvOS, unavailable)` on every schema type and query, or wrap them in `#if !os(watchOS) && !os(tvOS)` with `@available(iOS 27.0, macOS 27.0, visionOS 27.0, *)`. Without the exclusions, any target that also builds for watchOS or tvOS fails with `'reminders' is unavailable in watchOS`, and `@available(iOS 27.0, *)` alone also fails on macOS. Keep the SiriKit handlers for iOS 26 users.
4. **Keep the Intents extension** for classic Siri, and the one your watch app embeds for Apple Watch (whether watchOS 27 Siri still dispatches to it is unverified). Their deprecation warnings are expected and are not a reason to delete the handlers. Add App Shortcuts if you want fixed-phrase requests to work in every Siri.
5. **Test each Siri.** Use Siri AI on an Apple Intelligence device, and classic Siri on a device with Apple Intelligence off (and on Apple Watch if you ship a watch app). Write down what each request did; that record is what decides when a handler can go. For automated checks of the schema side, use AppIntentsTesting.

## Common Mistakes

| Mistake | Fix |
|---|---|
| `createReminder` returning nothing | `perform()` must return `some IntentResult & ReturnsValue<YourReminderEntity>`; the same holds for `createList`, `createSection`, `updateReminder`, and all three Notes intents |
| Declaring `isPinned` on `createNote` as `Bool?` | Required non-optional on `createNote`, optional on `updateNote`. Check each intent's row |
| Mapping `INTaskPriority.unknown` to `false` | `isFlagged` is optional; unknown is `nil` |
| Deleting reminders by list | `deleteReminders` takes the reminders themselves; resolve the list's reminders first |
| Calling a schema entity's memberwise init | Its parameters are `EntityProperty` wrappers (`'nil' is not compatible with expected argument type 'EntityProperty<Date?>'`). Write an explicit `init` |

## Resources

**WWDC**: 2026-240, 2026-343, 2026-344, 2026-295

**Docs**: /appintents/app-schema-domain-notes, /appintents/app-schema-domain-reminders, /appintents/app-schema-domains

**Skills**: app-schemas-ref, app-shortcuts-ref, siri-audio, siri-audio-ref, app-intents-ref, eventkit
