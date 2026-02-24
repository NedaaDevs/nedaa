import SwiftUI

struct NedaaColors {

    // MARK: - Light Theme Colors

    struct Light {
        /// Primary color - Deep blue (#1C5D85)
        static let primary = Color(red: 0x1C / 255.0, green: 0x5D / 255.0, blue: 0x85 / 255.0)

        /// Secondary color - Similar deep blue (#1C5D7D)
        static let secondary = Color(red: 0x1C / 255.0, green: 0x5D / 255.0, blue: 0x7D / 255.0)

        /// Tertiary color - Darker blue-gray (#2A4D6D)
        static let tertiary = Color(red: 0x2A / 255.0, green: 0x4D / 255.0, blue: 0x6D / 255.0)

        /// Background color - Light gray-blue (#F5F7FA)
        static let background = Color(red: 0xF5 / 255.0, green: 0xF7 / 255.0, blue: 0xFA / 255.0)

        /// Surface color - White (#FFFFFF)
        static let surface = Color.white

        /// Text color - Dark (default)
        static let text = Color.primary

        /// Secondary text color
        static let textSecondary = Color.secondary
    }

    // MARK: - Dark Theme Colors

    struct Dark {
        /// Primary color - Golden/amber (#E6C469)
        static let primary = Color(red: 0xE6 / 255.0, green: 0xC4 / 255.0, blue: 0x69 / 255.0)

        /// Secondary color - Muted gold (#D4BA76)
        static let secondary = Color(red: 0xD4 / 255.0, green: 0xBA / 255.0, blue: 0x76 / 255.0)

        /// Tertiary color - Dark blue-gray (#393E46)
        static let tertiary = Color(red: 0x39 / 255.0, green: 0x3E / 255.0, blue: 0x46 / 255.0)

        /// Background color - Very dark blue-gray (#222831)
        static let background = Color(red: 0x22 / 255.0, green: 0x28 / 255.0, blue: 0x31 / 255.0)

        /// Surface color - Dark blue-gray (#393E46)
        static let surface = Color(red: 0x39 / 255.0, green: 0x3E / 255.0, blue: 0x46 / 255.0)

        /// Text color - Light
        static let text = Color.white

        /// Secondary text color
        static let textSecondary = Color.gray
    }

    // MARK: - Adaptive Colors (automatically switches based on color scheme)

    /// Primary color that adapts to light/dark mode
    static func primary(for colorScheme: ColorScheme) -> Color {
        colorScheme == .dark ? Dark.primary : Light.primary
    }

    /// Secondary color that adapts to light/dark mode
    static func secondary(for colorScheme: ColorScheme) -> Color {
        colorScheme == .dark ? Dark.secondary : Light.secondary
    }

    /// Tertiary color that adapts to light/dark mode
    static func tertiary(for colorScheme: ColorScheme) -> Color {
        colorScheme == .dark ? Dark.tertiary : Light.tertiary
    }

    /// Background color that adapts to light/dark mode
    static func background(for colorScheme: ColorScheme) -> Color {
        colorScheme == .dark ? Dark.background : Light.background
    }

    /// Surface color that adapts to light/dark mode
    static func surface(for colorScheme: ColorScheme) -> Color {
        colorScheme == .dark ? Dark.surface : Light.surface
    }

    /// Text color that adapts to light/dark mode
    static func text(for colorScheme: ColorScheme) -> Color {
        colorScheme == .dark ? Dark.text : Light.text
    }

    /// Secondary text color that adapts to light/dark mode
    static func textSecondary(for colorScheme: ColorScheme) -> Color {
        colorScheme == .dark ? Dark.textSecondary : Light.textSecondary
    }

    /// Completed prayer color — muted teal (replaces raw Color.green)
    static func completed(for colorScheme: ColorScheme) -> Color {
        colorScheme == .dark
            ? Color(hex: "#6BBF9F")
            : Color(hex: "#5BA89D")
    }

    /// Ramadan accent — warm gold
    static func ramadanAccent(for colorScheme: ColorScheme) -> Color {
        colorScheme == .dark
            ? Color(hex: "#E8C468")
            : Color(hex: "#D4A853")
    }

    // MARK: - Status Colors (same in both themes)

    /// Success/completed color
    static let success = Color.green

    /// Warning color
    static let warning = Color.orange

    /// Error color
    static let error = Color.red

    /// Info color
    static let info = Color.blue
}

// MARK: - View Extension for Easy Access

extension View {
    /// Apply Nedaa primary color
    func nedaaPrimary(_ colorScheme: ColorScheme) -> some View {
        self.foregroundStyle(NedaaColors.primary(for: colorScheme))
    }

    /// Apply Nedaa secondary color
    func nedaaSecondary(_ colorScheme: ColorScheme) -> some View {
        self.foregroundStyle(NedaaColors.secondary(for: colorScheme))
    }

    /// Apply Nedaa text color
    func nedaaText(_ colorScheme: ColorScheme) -> some View {
        self.foregroundStyle(NedaaColors.text(for: colorScheme))
    }

    /// Apply Nedaa background
    func nedaaBackground(_ colorScheme: ColorScheme) -> some View {
        self.background(NedaaColors.background(for: colorScheme))
    }

    /// Apply Nedaa surface background
    func nedaaSurface(_ colorScheme: ColorScheme) -> some View {
        self.background(NedaaColors.surface(for: colorScheme))
    }
}

// MARK: - Color Extension for Hex Support

extension Color {
    /// Initialize color from hex string
    /// - Parameter hex: Hex string (e.g., "#1C5D85" or "1C5D85")
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a: UInt64
        let r: UInt64
        let g: UInt64
        let b: UInt64
        switch hex.count {
        case 3:  // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6:  // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:  // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }

        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// MARK: - Preview Helper

#if DEBUG
    struct ColorTheme_Previews: PreviewProvider {
        static var previews: some View {
            VStack(spacing: 20) {
                // Light theme
                VStack(spacing: 10) {
                    Text("Light Theme")
                        .font(.headline)

                    HStack {
                        ColorPreviewBox(color: NedaaColors.Light.primary, name: "Primary")
                        ColorPreviewBox(color: NedaaColors.Light.secondary, name: "Secondary")
                        ColorPreviewBox(color: NedaaColors.Light.tertiary, name: "Tertiary")
                    }

                    HStack {
                        ColorPreviewBox(color: NedaaColors.Light.background, name: "Background")
                        ColorPreviewBox(color: NedaaColors.Light.surface, name: "Surface")
                    }
                }
                .padding()
                .background(NedaaColors.Light.background)

                Divider()

                // Dark theme
                VStack(spacing: 10) {
                    Text("Dark Theme")
                        .font(.headline)
                        .foregroundStyle(.white)

                    HStack {
                        ColorPreviewBox(color: NedaaColors.Dark.primary, name: "Primary")
                        ColorPreviewBox(color: NedaaColors.Dark.secondary, name: "Secondary")
                        ColorPreviewBox(color: NedaaColors.Dark.tertiary, name: "Tertiary")
                    }

                    HStack {
                        ColorPreviewBox(color: NedaaColors.Dark.background, name: "Background")
                        ColorPreviewBox(color: NedaaColors.Dark.surface, name: "Surface")
                    }
                }
                .padding()
                .background(NedaaColors.Dark.background)
            }
        }

        struct ColorPreviewBox: View {
            let color: Color
            let name: String

            var body: some View {
                VStack {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(color)
                        .frame(width: 60, height: 60)
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                        )

                    Text(name)
                        .font(.caption2)
                }
            }
        }
    }
#endif
