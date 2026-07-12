Pod::Spec.new do |s|
  s.name           = 'ExpoDiagnostics'
  s.version        = '1.0.0'
  s.summary        = 'OS diagnostics inbox (MetricKit)'
  s.description    = 'Buffers MetricKit crash/hang diagnostics for JS drain'
  s.author         = 'Nedaa'
  s.homepage       = 'https://github.com/NedaaDevs/nedaa'
  s.platforms      = { :ios => '16.4' }
  s.source         = { :git => 'https://github.com/NedaaDevs/nedaa.git' }
  s.static_framework = true
  s.license        = 'MIT'

  s.dependency 'ExpoModulesCore'

  s.source_files = '*.swift'
  s.frameworks = 'MetricKit'
end
