Pod::Spec.new do |s|
  s.name           = 'ExpoWidget'
  s.version        = '1.0.0'
  s.summary        = 'Expo module for app-triggered WidgetKit timeline reloads'
  s.description    = 'Reloads widget timelines from the app after data changes'
  s.author         = 'Nedaa'
  s.homepage       = 'https://github.com/NedaaDevs/nedaa'
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => 'https://github.com/NedaaDevs/nedaa.git' }
  s.static_framework = true
  s.license        = 'MIT'

  s.dependency 'ExpoModulesCore'

  s.source_files = '*.swift'
end
