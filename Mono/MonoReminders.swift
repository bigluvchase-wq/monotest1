import Foundation
import UserNotifications

final class MonoReminders {
    private let center = UNUserNotificationCenter.current()
    private var revision = 0

    func requestAuthorization(_ completion: @escaping (Bool) -> Void) {
        center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
            DispatchQueue.main.async { completion(granted) }
        }
    }

    func isAuthorized(_ completion: @escaping (Bool) -> Void) {
        center.getNotificationSettings { settings in
            let granted = settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional
            DispatchQueue.main.async { completion(granted) }
        }
    }

    func replace(_ items: [[String: String]]) {
        revision += 1
        let requestRevision = revision
        Task { @MainActor in
            let settings = await center.notificationSettings()
            guard revision == requestRevision,
                  settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional else { return }
            let pending = await center.pendingNotificationRequests()
            guard revision == requestRevision else { return }
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.dateFormat = "yyyy-MM-dd HH:mm"
            formatter.isLenient = false
            let now = Date()
            let requests = items.prefix(60).compactMap { item -> UNNotificationRequest? in
                guard let id = item["id"], let raw = item["date"], let time = item["time"],
                      let date = formatter.date(from: raw + " " + time), date > now else { return nil }
                let content = UNMutableNotificationContent()
                content.title = "Моно"
                content.body = item["text"] ?? "Проверьте платёж"
                content.sound = .default
                let components = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: date)
                return UNNotificationRequest(identifier: "mono.bill." + id, content: content,
                                             trigger: UNCalendarNotificationTrigger(dateMatching: components, repeats: false))
            }
            let ids = Set(requests.map(\.identifier))
            center.removePendingNotificationRequests(withIdentifiers: pending.map(\.identifier).filter {
                $0.hasPrefix("mono.bill.") && !ids.contains($0)
            })
            for request in requests {
                guard revision == requestRevision else { return }
                try? await center.add(request)
            }
        }
    }
}
