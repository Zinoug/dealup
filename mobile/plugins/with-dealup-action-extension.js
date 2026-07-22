const fs = require('fs');
const path = require('path');

const { withDangerousMod, withXcodeProject } = require('@expo/config-plugins');
const plist = require('@expo/plist').default;

const EXTENSION_DIRECTORY = 'expo-sharing-extension';
const EXTENSION_TARGET = 'expo-sharing-extension';
const ACTION_ICON_CATALOG = 'ActionIcon.xcassets';
const ACTION_ICON_NAME = 'ActionExtensionIcon';
const ACTION_ICON_FILES = [
  ['dealup-action-app-icon-40.png', 'icon-20@2x.png'],
  ['dealup-action-app-icon-60.png', 'icon-20@3x.png'],
  ['dealup-action-app-icon-58.png', 'icon-29@2x.png'],
  ['dealup-action-app-icon-87.png', 'icon-29@3x.png'],
  ['dealup-action-app-icon-80.png', 'icon-40@2x.png'],
  ['dealup-action-app-icon-120.png', 'icon-40@3x.png'],
  ['dealup-action-app-icon-120.png', 'icon-60@2x.png'],
  ['dealup-action-app-icon-180.png', 'icon-60@3x.png'],
];

const ACTION_ICON_CONTENTS = {
  images: [
    { idiom: 'iphone', size: '20x20', scale: '2x', filename: 'icon-20@2x.png' },
    { idiom: 'iphone', size: '20x20', scale: '3x', filename: 'icon-20@3x.png' },
    { idiom: 'iphone', size: '29x29', scale: '2x', filename: 'icon-29@2x.png' },
    { idiom: 'iphone', size: '29x29', scale: '3x', filename: 'icon-29@3x.png' },
    { idiom: 'iphone', size: '40x40', scale: '2x', filename: 'icon-40@2x.png' },
    { idiom: 'iphone', size: '40x40', scale: '3x', filename: 'icon-40@3x.png' },
    { idiom: 'iphone', size: '60x60', scale: '2x', filename: 'icon-60@2x.png' },
    { idiom: 'iphone', size: '60x60', scale: '3x', filename: 'icon-60@3x.png' },
  ],
  info: { author: 'xcode', version: 1 },
};

function writeActionIconFiles(extensionRoot) {
  const sourceRoot = path.resolve(__dirname, '..', 'assets', 'brands');
  const catalogRoot = path.join(extensionRoot, ACTION_ICON_CATALOG);
  const appIconRoot = path.join(catalogRoot, `${ACTION_ICON_NAME}.appiconset`);

  fs.rmSync(catalogRoot, { recursive: true, force: true });
  fs.mkdirSync(appIconRoot, { recursive: true });
  fs.writeFileSync(
    path.join(catalogRoot, 'Contents.json'),
    `${JSON.stringify({ info: { author: 'xcode', version: 1 } }, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(appIconRoot, 'Contents.json'),
    `${JSON.stringify(ACTION_ICON_CONTENTS, null, 2)}\n`,
  );

  for (const [sourceFilename, bundleFilename] of ACTION_ICON_FILES) {
    const source = path.join(sourceRoot, sourceFilename);
    if (!fs.existsSync(source)) {
      throw new Error(`DealUp action icon asset not found at ${source}`);
    }
    fs.copyFileSync(source, path.join(appIconRoot, bundleFilename));
  }
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
      delete info.CFBundleIcons;
      delete info.CFBundleIconFile;
      delete info.CFBundleIconFiles;
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

    for (const legacyIcon of ['DealUpActionIcon.png', 'DealUpActionIcon@2x.png', 'DealUpActionIcon@3x.png']) {
      if (!project.hasFile(legacyIcon)) continue;
      project.removeResourceFile(legacyIcon, { target: targetKey }, extensionGroupKey);
    }

    if (!project.hasFile(ACTION_ICON_CATALOG)) {
      // xcode.addResourceFile() assumes that a PBX group named "Resources"
      // exists. Clean EAS prebuilds do not create that group, so the helper
      // crashes before it can attach the catalog to the extension target.
      addResourceFileToTarget(project, ACTION_ICON_CATALOG, extensionGroupKey, targetKey);
    }

    project.updateBuildProperty(
      'ASSETCATALOG_COMPILER_APPICON_NAME',
      ACTION_ICON_NAME,
      undefined,
      EXTENSION_TARGET,
    );
    return modConfig;
  });
};
