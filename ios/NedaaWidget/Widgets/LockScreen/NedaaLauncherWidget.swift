import WidgetKit
import SwiftUI

// MARK: - Timeline Entry

struct NedaaLauncherEntry: TimelineEntry {
    let date: Date
}

// MARK: - Timeline Provider

@available(iOS 16.0, *)
struct NedaaLauncherProvider: TimelineProvider {
    func placeholder(in context: Context) -> NedaaLauncherEntry {
        NedaaLauncherEntry(date: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (NedaaLauncherEntry) -> Void) {
        completion(NedaaLauncherEntry(date: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NedaaLauncherEntry>) -> Void) {
        let entry = NedaaLauncherEntry(date: Date())
        completion(Timeline(entries: [entry], policy: .never))
    }
}

// MARK: - View

@available(iOSApplicationExtension 16.0, *)
struct NedaaLauncherView: View {
    var entry: NedaaLauncherEntry

    var body: some View {
        ZStack {
            AccessoryWidgetBackground()
            Image("LauncherMark")
                .resizable()
                .scaledToFit()
                .padding(10)
        }
        .widgetAccentable()
        .widgetBackground(Color.clear)
    }
}

// MARK: - Widget

@available(iOSApplicationExtension 16.0, *)
struct NedaaLauncherWidget: Widget {
    let kind: String = "NedaaLauncherWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NedaaLauncherProvider()) { entry in
            NedaaLauncherView(entry: entry)
        }
        .configurationDisplayName(NSLocalizedString("nedaaLauncherWidgetTitle", comment: "Lock screen widget title"))
        .description(NSLocalizedString("nedaaLauncherWidgetDesc", comment: "Lock screen widget description"))
        .supportedFamilies([.accessoryCircular])
        .contentMarginsDisabledIfAvailable()
    }
}

@available(iOSApplicationExtension 16.0, *)
struct NedaaLauncherWidget_Previews: PreviewProvider {
    static var previews: some View {
        NedaaLauncherView(entry: NedaaLauncherEntry(date: Date()))
            .previewContext(WidgetPreviewContext(family: .accessoryCircular))
    }
}
