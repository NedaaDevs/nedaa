Pod::Spec.new do |s|
  s.name           = 'ExpoMediaControls'
  s.version        = '1.0.0'
  s.summary        = 'Expo module for lock screen next/previous track controls'
  s.description    = 'Registers MPRemoteCommandCenter next/previous track commands'
  s.author         = 'Nedaa'
  s.homepage       = 'https://github.com/NedaaDevs/nedaa'
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => 'https://github.com/NedaaDevs/nedaa.git' }
  s.static_framework = true
  s.license        = 'MIT'

  s.dependency 'ExpoModulesCore'

  s.source_files = '*.swift'
  s.frameworks = 'MediaPlayer'
end
