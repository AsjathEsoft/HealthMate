// Beginner-friendly patch script to make expo-notifications and expo-application compatible with Expo Go on Android
const fs = require('fs');
const path = require('path');

const topicSubscriptionFile = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-notifications',
  'build',
  'TopicSubscriptionModule.android.js'
);

if (fs.existsSync(topicSubscriptionFile)) {
  let content = fs.readFileSync(topicSubscriptionFile, 'utf8');
  if (!content.includes('requireOptionalNativeModule')) {
    const patched = `import { requireOptionalNativeModule } from 'expo';
const nativeModule = requireOptionalNativeModule('ExpoTopicSubscriptionModule');
export default nativeModule ?? {
    addListener: () => {},
    removeListeners: () => {},
    subscribeToTopicAsync: () => Promise.resolve(null),
    unsubscribeFromTopicAsync: () => Promise.resolve(null)
};
//# sourceMappingURL=TopicSubscriptionModule.android.js.map
`;
    fs.writeFileSync(topicSubscriptionFile, patched, 'utf8');
    console.log('[HealthMate] Patched TopicSubscriptionModule.android.js for Expo Go compatibility.');
  }
}

const expoApplicationFile = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-application',
  'build',
  'ExpoApplication.js'
);

if (fs.existsSync(expoApplicationFile)) {
  let appContent = fs.readFileSync(expoApplicationFile, 'utf8');
  if (!appContent.includes('requireOptionalNativeModule')) {
    const patchedApp = `import { requireOptionalNativeModule } from 'expo';
export default requireOptionalNativeModule('ExpoApplication') ?? {};
//# sourceMappingURL=ExpoApplication.js.map
`;
    fs.writeFileSync(expoApplicationFile, patchedApp, 'utf8');
    console.log('[HealthMate] Patched ExpoApplication.js for Expo Go compatibility.');
  }
}

