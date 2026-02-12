import AppIntents
import WidgetKit

@available(iOS 17.0, *)
struct IncrementQadaIntent: AppIntent {
    static var title: LocalizedStringResource = "Increment Qada"
    static var description = IntentDescription("Records one completed qada fast")

    func perform() async throws -> some IntentResult {
        let service = QadaDataService()
        _ = service.recordCompletion(count: 1)

        // Reload widget timelines
        WidgetCenter.shared.reloadTimelines(ofKind: "QadaHomeScreen")

        return .result()
    }
}
