import Foundation

/// Text shown while an alarm rings, in the app's language. JS saves it at launch and on
/// every language change; the English fallback covers the time before the first save.
enum AlarmCopy {
    private static let storageKey = "alarm_copy"

    static func save(_ copy: [String: String]) {
        UserDefaults.standard.set(copy, forKey: storageKey)
    }

    static func text(_ field: String, fallback: String) -> String {
        let copy = UserDefaults.standard.dictionary(forKey: storageKey) as? [String: String]
        guard let value = copy?[field], !value.isEmpty else { return fallback }
        return value
    }
}
