/* eslint-disable prefer-arrow-callback */

Package.describe({
  name: "johanbrook:publication-collector",
  version: "1.2.0",
  summary: "Test a Meteor publication by collecting its output.",
  documentation: "README.md",
  git: "https://github.com/johanbrook/meteor-publication-collector.git",
  debugOnly: true,
});

Npm.depends({
  chai: "4.1.2",
  sinon: "4.2.2",
});

Package.onUse(function (api) {
  api.versionsFrom("1.3");

  api.use(["ecmascript", "underscore", "mongo", "check"], "server");

  api.mainModule("publication-collector.js", "server");
});

Package.onTest(function (api) {
  api.use(
    [
      "ecmascript",
      "mongo",
      "random",
      "meteortesting:mocha",
      "accounts-password",
      "underscore",
    ],
    "server"
  );

  api.addFiles("./tests/collections.js", "server");

  api.mainModule("publication-collector.test.js", "server");
});
