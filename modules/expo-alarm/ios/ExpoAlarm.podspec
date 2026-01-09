Pod::Spec.new do |s|
  s.name           = 'ExpoAlarm'
  s.version        = '1.0.0'
  s.summary        = 'Expo module for native alarms using AlarmKit'
  s.description    = 'Native alarm scheduling using AlarmKit for iOS 26+'
  s.author         = 'Nedaa'
  s.homepage       = 'https://github.com/NedaaDevs/nedaa'
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => 'https://github.com/NedaaDevs/nedaa.git' }
  s.static_framework = true
  s.license        = 'MIT'

  s.dependency 'ExpoModulesCore'

  s.source_files = '*.swift'
  s.frameworks = 'UIKit'

  # AlarmKit is iOS 26+ only, handled with #if canImport
  s.weak_frameworks = 'AlarmKit', 'ActivityKit'
end
