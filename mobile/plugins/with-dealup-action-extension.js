const fs = require('fs');
const path = require('path');

const { withDangerousMod, withXcodeProject } = require('@expo/config-plugins');
const plist = require('@expo/plist').default;

const EXTENSION_DIRECTORY = 'expo-sharing-extension';
const EXTENSION_TARGET = 'expo-sharing-extension';
const ACTION_ICON_CATALOG = 'ActionIcon.xcassets';
const ACTION_ICON_COPY_PHASE = 'Copy DealUp Action Icon';
const ACTION_ICON_FILES = [
  ['dealup-action-icon-40.png', 'DealUpActionIcon.png'],
  ['dealup-action-icon-80.png', 'DealUpActionIcon@2x.png'],
  ['dealup-action-icon-120.png', 'DealUpActionIcon@3x.png'],
];

function writeActionIconFiles(extensionRoot) {
  const sourceRoot = path.resolve(__dirname, '..', 'assets', 'brands');

  // Do not pass this icon through an app icon catalog. App Store processing
  // flattens app icons and makes iOS display a shaded copy of the main icon.
  // Loose bundle resources preserve the monochrome alpha mask exactly.
  fs.rmSync(path.join(extensionRoot, ACTION_ICON_CATALOG), {
    recursive: true,
    force: true,
  });

  for (const [sourceFilename, bundleFilename] of ACTION_ICON_FILES) {
    const source = path.join(sourceRoot, sourceFilename);
    if (!fs.existsSync(source)) {
      throw new Error(`DealUp action icon asset not found at ${source}`);
    }
    fs.copyFileSync(source, path.join(extensionRoot, bundleFilename));
  }
}

function unquote(value) {
  return typeof value === 'string' ? value.replace(/^"|"$/g, '') : value;
}

function findFileReference(project, filePath) {
  const references = project.pbxFileReferenceSection();
  for (const [key, reference] of Object.entries(references)) {
    if (key.endsWith('_comment')) continue;
    if (
      unquote(reference.path) === filePath ||
      unquote(reference.name) === filePath
    ) {
      return { key, reference };
    }
  }
  return null;
}

function ensureResourceFileInTarget(project, filePath, groupKey, targetKey) {
  let fileReference = findFileReference(project, filePath);
  if (!fileReference) {
    const file = project.addFile(filePath, groupKey);
    if (!file) {
      throw new Error(`Unable to add ${filePath} to the action extension group`);
    }
    fileReference = { key: file.fileRef };
  }

  const resourcesPhase = project.pbxResourcesBuildPhaseObj(targetKey);
  if (!resourcesPhase) {
    throw new Error('DealUp action extension Resources build phase not found');
  }

  const buildFiles = project.pbxBuildFileSection();
  const isAlreadyInResources = resourcesPhase.files.some(({ value }) => {
    const buildFile = buildFiles[value];
    return buildFile?.fileRef === fileReference.key;
  });
  if (isAlreadyInResources) return;

  const buildFileKey = project.generateUuid();
  buildFiles[buildFileKey] = {
    isa: 'PBXBuildFile',
    fileRef: fileReference.key,
    fileRef_comment: filePath,
  };
  buildFiles[`${buildFileKey}_comment`] = `${filePath} in Resources`;
  resourcesPhase.files.push({
    value: buildFileKey,
    comment: `${filePath} in Resources`,
  });
}

function ensureActionIconCopyPhase(project, targetKey) {
  const shellPhases = project.hash.project.objects.PBXShellScriptBuildPhase || {};
  const existingPhase = Object.entries(shellPhases).find(([key, phase]) => (
    !key.endsWith('_comment') && unquote(phase.name) === ACTION_ICON_COPY_PHASE
  ));
  if (existingPhase) return;

  const inputPaths = ACTION_ICON_FILES.map(([sourceFilename]) => (
    `"$(PROJECT_DIR)/../assets/brands/${sourceFilename}"`
  ));
  const outputPaths = ACTION_ICON_FILES.map(([, bundleFilename]) => (
    `"$(TARGET_BUILD_DIR)/$(UNLOCALIZED_RESOURCES_FOLDER_PATH)/${bundleFilename}"`
  ));
  const copyCommands = ACTION_ICON_FILES.map((_file, index) => (
    `/bin/cp -f \"$SCRIPT_INPUT_FILE_${index}\" \"$SCRIPT_OUTPUT_FILE_${index}\"`
  ));

  project.addBuildPhase(
    [],
    'PBXShellScriptBuildPhase',
    ACTION_ICON_COPY_PHASE,
    targetKey,
    {
      shellPath: '/bin/sh',
      inputPaths,
      outputPaths,
      shellScript: [
        'set -e',
        ...copyCommands,
      ].join('\n'),
    },
  );
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
      info.CFBundleIconFile = 'DealUpActionIcon.png';
      info.CFBundleIconFiles = ['DealUpActionIcon'];
      info.UIPrerenderedIcon = true;
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

    for (const [, bundleFilename] of ACTION_ICON_FILES) {
      ensureResourceFileInTarget(
        project,
        bundleFilename,
        extensionGroupKey,
        targetKey,
      );
    }
    ensureActionIconCopyPhase(project, targetKey);
    return modConfig;
  });
};
