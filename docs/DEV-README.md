# Nedaa

## Prerequisites

Before running the project, make sure you have the following installed:

- [Bun](https://bun.sh/) (version 1.1.45)
- [Node.js](https://nodejs.org/)
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- [Xcode](https://developer.apple.com/xcode/) (for iOS development)
- [Android Studio](https://developer.android.com/studio) (for Android development)

## Code Quality Tools

This project uses several tools to maintain code quality:

- **Husky**: Manages git hooks to run checks before commits(.husky/pre-commit)
- **lint-staged**: Runs linters on staged git files
- **ESLint**: Checks code for potential errors and enforces coding standards
- **Prettier**: Automatically formats code for consistency

The pre-commit hook will automatically:

1. Run ESLint to check code quality
2. Run Prettier to format staged files
3. Prevent commits if there are any linting errors

## Installation

1. Clone the repository:

```bash
git clone https://github.com/NedaaDevs/nedaa-v2
cd nedaa-v2
```

2. Install dependencies using Bun:

```bash
bun install


# Alternative: Install using Bun with Yarn compatibility
bun install --yarn
```

## Running the App

### For iOS (Mac is required)

1. Make sure you have Xcode installed and set up properly
2. Install iOS Simulator (through Xcode)
3. Run the following command:

```bash
bun run ios
```

Alternatively, you can use:

```bash
npx expo run:ios
```

### For Android

1. Make sure you have Android Studio installed
2. Set up an Android Virtual Device (AVD) through Android Studio
3. Run the following command:

```bash
bun run android
```

Alternatively, you can use:

```bash
npx expo run:android
```

### Development Mode

To start the metro server:

```bash
bun start
```

This will start the Expo development server, and you can choose to run on either iOS or Android from the Expo Developer Tools.

## Troubleshooting

### Common Issues

1. **Pod installation fails (iOS)**

   ```bash
   cd ios
   pod install
   ```

2. **Android build fails**

   - Clean the Android build:

   ```bash
   cd android
   ./gradlew clean
   ```

3. **Metro bundler issues**
   - Clear Metro bundler cache:
   ```bash
   bun start --clear
   ```

## Scripts

Available scripts in package.json:

- `bun start`: Start the Expo development server
- `bun run android`: Run on Android
- `bun run ios`: Run on iOS

Note: You can add `--no-build-cache` flag to any run command to execute without using the build cache, e.g.:

```bash
bun run ios --no-build-cache
```

## Additional Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/docs/getting-started)
- [Bun Documentation](https://bun.sh/docs)
- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [react-i18next Documentation](https://react.i18next.com/)
