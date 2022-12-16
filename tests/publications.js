/* eslint-disable prefer-arrow-callback */

Meteor.publish("publication", function () {
  return Documents.find();
});

Meteor.publish("publicationWithSeveralCursors", function () {
  return [Documents.find(), Books.find(), Meteor.users.find()];
});

Meteor.publish("publicationUsingLowLevelACRInterface", function () {
  const count = Documents.find().count();

  Meteor.setTimeout(() => {
    this.added("counts", "Documents", { count });
    this.ready();
  }, 100);
});

Meteor.publish("publicationWithPostReadyChanges", function () {
  const count = Documents.find().count();

  this.ready();

  Meteor.setTimeout(() => {
    this.added("counts", "Documents", { count });
  }, 100);
});

Meteor.publish("publicationWithUser", function () {
  if (!this.userId || this.userId !== "foo") {
    return this.ready();
  }

  return Documents.find();
});

Meteor.publish("publicationError", function () {
  if (!this.userId) {
    this.error(new Meteor.Error("not-authorized", "Not authorized"));
  }

  return Documents.find();
});

Meteor.publish("async.publication", async function () {
  return Documents.find();
});
