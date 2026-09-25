import SwiftUI

/// A timeline entry that can stand in, greyed out, for data it could not read.
protocol RedactableEntry {
    var isUnavailable: Bool { get set }
}

extension RedactableEntry {
    /// This entry greyed out, so its sample values never read as real.
    var markedUnavailable: Self {
        var entry = self
        entry.isUnavailable = true
        return entry
    }
}

extension View {
    /// Greys out an entry with no real data and hides it from VoiceOver.
    func unavailable(_ isUnavailable: Bool) -> some View {
        redacted(reason: isUnavailable ? .placeholder : [])
            .accessibilityHidden(isUnavailable)
    }
}
