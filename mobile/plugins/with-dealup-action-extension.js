const fs = require('fs');
const path = require('path');

const { withDangerousMod, withXcodeProject } = require('@expo/config-plugins');
const plist = require('@expo/plist').default;

const EXTENSION_DIRECTORY = 'expo-sharing-extension';
const EXTENSION_TARGET = 'expo-sharing-extension';
const ACTION_ICON_CATALOG = 'ActionIcon.xcassets';
const ACTION_ICON_IMAGESET = 'DealUpActionIcon.imageset';
const ACTION_ICON_FILES = [
  ['dealup-action-icon-40.png', 'dealup-action-icon-40.png', '1x'],
  ['dealup-action-icon-80.png', 'dealup-action-icon-80.png', '2x'],
  ['dealup-action-icon-120.png', 'dealup-action-icon-120.png', '3x'],
];

function writeActionIconFiles(extensionRoot) {
  const sourceRoot = path.resolve(__dirname, '..', 'assets', 'brands');
  const catalogRoot = path.join(extensionRoot, ACTION_ICON_CATALOG);
  const imageSetRoot = path.join(catalogRoot, ACTION_ICON_IMAGESET);

  // This must remain a regular template imageset, not an appiconset: App Store
  // distribution flattens app icons and would turn the glyph into a solid box.
  fs.rmSync(catalogRoot, { recursive: true, force: true });
  fs.mkdirSync(imageSetRoot, { recursive: true });

  fs.writeFileSync(
    path.join(catalogRoot, 'Contents.json'),
    `${JSON.stringify({ info: { author: 'xcode', version: 1 } }, null, 2)}\n`,
  );

  for (const [sourceFilename, outputFilename] of ACTION_ICON_FILES) {
    const source = path.join(sourceRoot, sourceFilename);
    if (!fs.existsSync(source)) {
      throw new Error(`DealUp action icon asset not found at ${source}`);
    }
    fs.copyFileSync(source, path.join(imageSetRoot, outputFilename));
  }

  fs.writeFileSync(
    path.join(imageSetRoot, 'Contents.json'),
    `${JSON.stringify(
      {
        images: ACTION_ICON_FILES.map(([, filename, scale]) => ({
          filename,
          idiom: 'universal',
          scale,
        })),
        info: { author: 'xcode', version: 1 },
        properties: { 'template-rendering-intent': 'template' },
      },
      null,
      2,
    )}\n`,
  );
}

function addResourceFileToTarget(project, filePath, groupKey, targetKey) {
  const file = project.addFile(filePath, groupKey);
  if (!file) return;

  file.uuid = project.generateUuid();
  file.target = targetKey;
  project.addToPbxBuildFileSection(file);
  project.addToPbxResourcesBuildPhase(file);
}

function findTargetKey(project, name) {
  return project.findTargetKey(name) || project.findTargetKey(`"${name}"`);
}

function findGroupKey(project, name) {
  return (
    project.findPBXGroupKey({ name }) ||
    project.findPBXGroupKey({ name: `"${name}"` }) ||
    project.findPBXGroupKey({ path: name }) ||
    project.findPBXGroupKey({ path: `"${name}"` })
  );
}

/**
 * Expo Sharing generates a standard Share Extension. DealUp intentionally
 * presents the same native hand-off as an iOS Action Extension so Leboncoin
 * shows "Analyser avec DealUp" in the actions list instead of the apps row.
 */
module.exports = function withDealUpActionExtension(config) {
  config = withDangerousMod(config, [
    'ios',
    async (modConfig) => {
      const extensionRoot = path.join(
        modConfig.modRequest.platformProjectRoot,
        EXTENSION_DIRECTORY,
      );
      const infoPlistPath = path.join(
        extensionRoot,
        'Info.plist',
      );

      if (!fs.existsSync(infoPlistPath)) {
        throw new Error(`DealUp action extension Info.plist not found at ${infoPlistPath}`);
      }

      writeActionIconFiles(extensionRoot);

      const info = plist.parse(fs.readFileSync(infoPlistPath, 'utf8'));
      info.CFBundleDisplayName = 'Analyser avec DealUp';
      delete info.CFBundleIconFile;
      info.CFBundleIconFiles = ['DealUpActionIcon'];
      info.CFBundleIcons = {
        CFBundlePrimaryIcon: {
          CFBundleIconFiles: ['DealUpActionIcon'],
          UIPrerenderedIcon: true,
        },
      };
      info.NSExtension = info.NSExtension || {};
      info.NSExtension.NSExtensionPointIdentifier = 'com.apple.ui-services';
      info.NSExtension.NSExtensionAttributes = {
        ...(info.NSExtension.NSExtensionAttributes || {}),
        NSExtensionActionWantsFullScreenPresentation: false,
      };
      delete info.NSExtension.NSExtensionAttributes.NSExtensionServiceToolbarIconName;

      fs.writeFileSync(infoPlistPath, plist.build(info));

      return modConfig;
    },
  ]);

  return withXcodeProject(config, (modConfig) => {
    const project = modConfig.modResults;
    const targetKey = findTargetKey(project, EXTENSION_TARGET);
    if (!targetKey) throw new Error('DealUp action extension Xcode target not found');

    const extensionGroupKey = findGroupKey(project, EXTENSION_DIRECTORY);
    if (!extensionGroupKey) throw new Error('DealUp action extension Xcode group not found');

    if (!project.hasFile(ACTION_ICON_CATALOG)) {
      addResourceFileToTarget(
        project,
        ACTION_ICON_CATALOG,
        extensionGroupKey,
        targetKey,
      );
    }
    return modConfig;
  });
};
