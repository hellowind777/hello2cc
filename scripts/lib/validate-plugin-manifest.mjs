const JSON_FILES = [
  'package.json',
  '.claude-plugin/plugin.json',
  '.claude-plugin/marketplace.json',
  'hooks/hooks.json',
];

function findInvalidUserConfigEntries(userConfig = {}) {
  return Object.entries(userConfig).filter(([, option]) => {
    return !option || typeof option !== 'object' || !option.title || !option.type || !option.description;
  });
}

/**
 * Validates required JSON files exist and can be parsed.
 */
export function validateJsonFiles(context) {
  for (const relativePath of JSON_FILES) {
    if (!context.exists(relativePath)) {
      context.fail(`missing ${relativePath}`);
      continue;
    }

    const data = context.readJson(relativePath);
    if (data) {
      context.ok(relativePath);
    }
  }
}

/**
 * Validates plugin.json and marketplace metadata stay aligned with the package version.
 */
export function validatePluginManifest(context) {
  const plugin = context.readJson('.claude-plugin/plugin.json');
  if (!plugin) return;

  const pkg = context.readJson('package.json');
  const marketplace = context.readJson('.claude-plugin/marketplace.json');

  if (plugin.hooks === './hooks/hooks.json') {
    context.fail('plugin.json must not reference standard hooks/hooks.json; that file is auto-loaded');
  } else {
    context.ok('plugin manifest hook reference');
  }

  if (!plugin.userConfig || typeof plugin.userConfig !== 'object') {
    context.fail('plugin.json should define userConfig for model injection strategy');
    return;
  }

  const invalidEntries = findInvalidUserConfigEntries(plugin.userConfig);
  if (invalidEntries.length > 0) {
    context.fail(`plugin.json userConfig entries missing required fields: ${invalidEntries.map(([key]) => key).join(', ')}`);
  } else {
    context.ok('plugin manifest userConfig');
  }

  if (plugin.outputStyles !== './output-styles') {
    context.fail('plugin.json should expose outputStyles as ./output-styles');
  } else {
    context.ok('plugin manifest outputStyles');
  }

  if ('skills' in plugin) {
    context.fail('plugin.json must not expose skills in the skill-free core release');
  } else {
    context.ok('plugin manifest skill-free');
  }

  if (pkg && plugin.version !== pkg.version) {
    context.fail('plugin.json version should match package.json');
  } else if (pkg) {
    context.ok('plugin manifest version sync');
  }

  const marketplaceEntry = marketplace?.plugins?.find?.((entry) => entry?.name === plugin.name);
  if (!marketplaceEntry) {
    context.fail('marketplace.json should expose the hello2cc plugin entry');
  } else if (pkg && marketplaceEntry.version !== pkg.version) {
    context.fail('marketplace.json plugin version should match package.json');
  } else {
    context.ok('marketplace version sync');
  }
}
