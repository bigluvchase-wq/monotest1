import SwiftUI
import WidgetKit

private struct ShortcutEntry: TimelineEntry {
    let date: Date
}

private struct ShortcutProvider: TimelineProvider {
    func placeholder(in context: Context) -> ShortcutEntry { ShortcutEntry(date: Date()) }
    func getSnapshot(in context: Context, completion: @escaping (ShortcutEntry) -> Void) {
        completion(placeholder(in: context))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<ShortcutEntry>) -> Void) {
        completion(Timeline(entries: [placeholder(in: context)], policy: .never))
    }
}

private enum Shortcut: String {
    case voice, text

    var title: String { self == .voice ? "Голосовая запись" : "Быстрая запись" }
    var symbol: String { self == .voice ? "mic.fill" : "keyboard" }
    var url: URL? { URL(string: "monomoney://record/" + rawValue) }
}

private struct ShortcutView: View {
    @Environment(\.widgetFamily) private var family
    let shortcut: Shortcut

    var body: some View {
        Group {
            if family == .accessoryCircular {
                ZStack {
                    AccessoryWidgetBackground()
                    Image(systemName: shortcut.symbol).font(.title3.weight(.semibold))
                }
            } else if family == .accessoryRectangular {
                Label(shortcut.title, systemImage: shortcut.symbol)
                    .font(.subheadline.weight(.semibold))
            } else {
                VStack(alignment: .leading, spacing: 10) {
                    Image(systemName: shortcut.symbol).font(.title2.weight(.semibold))
                        .foregroundStyle(Color(red: 0.40, green: 0.34, blue: 0.81))
                    Text(shortcut.title).font(.headline)
                    Text("Моно").font(.caption).foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            }
        }
        .accessibilityLabel(shortcut.title)
        .containerBackground(for: .widget) {
            if family == .systemSmall { Color(red: 0.93, green: 0.91, blue: 0.98) }
        }
        .widgetURL(shortcut.url)
    }
}

private struct MonoShortcutWidget: Widget {
    let shortcut: Shortcut

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MonoShortcut." + shortcut.rawValue, provider: ShortcutProvider()) { _ in
            ShortcutView(shortcut: shortcut)
        }
        .configurationDisplayName(Text(shortcut.title))
        .description("Открывает запись операции в Моно.")
        .supportedFamilies([.systemSmall, .accessoryCircular, .accessoryRectangular])
    }
}

@main
struct MonoWidgetBundle: WidgetBundle {
    var body: some Widget {
        MonoShortcutWidget(shortcut: .voice)
        MonoShortcutWidget(shortcut: .text)
    }
}
