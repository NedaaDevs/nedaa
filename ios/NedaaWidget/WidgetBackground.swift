import SwiftUI
import WidgetKit

extension View {
    func widgetBackground(_ backgroundView: some View) -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            return containerBackground(for: .widget) {
                backgroundView
            }
        } else {
            return background(backgroundView)
        }
    }
}


extension WidgetConfiguration {
    func contentMarginsDisabledIfAvailable() -> some WidgetConfiguration {
        if #available(iOSApplicationExtension 17.0, *) {
            return self.contentMarginsDisabled()
        } else {
            return self
        }
    }
}

// MARK: - StandBy Mode Support

private struct ShowsWidgetBackgroundKey: EnvironmentKey {
    static let defaultValue: Bool = true
}

extension EnvironmentValues {
    var showsBackground: Bool {
        get { self[ShowsWidgetBackgroundKey.self] }
        set { self[ShowsWidgetBackgroundKey.self] = newValue }
    }
}

@available(iOSApplicationExtension 17.0, *)
struct StandByAwareModifier: ViewModifier {
    @Environment(\.showsWidgetContainerBackground) private var showsWidgetContainerBackground

    func body(content: Content) -> some View {
        content.environment(\.showsBackground, showsWidgetContainerBackground)
    }
}

extension View {
    func standByAware() -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            return self.modifier(StandByAwareModifier())
        } else {
            return self.environment(\.showsBackground, true)
        }
    }
}

// MARK: - iOS 17+ API Compatibility Helpers

extension View {
    @ViewBuilder
    func numericContentTransition() -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            self.contentTransition(.numericText())
        } else {
            self
        }
    }

    @ViewBuilder
    func accentableWidget(_ condition: Bool = true) -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            self.widgetAccentable(condition)
        } else {
            self
        }
    }
}
