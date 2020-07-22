/* eslint-env mocha */
/* global Documents, Books */

import { Meteor } from 'meteor/meteor';
import { assert } from 'chai';
import sinon from 'sinon';
import { Mongo } from 'meteor/mongo';

import './tests/publications';

// Under test
import { PublicationCollector } from './publication-collector';

describe('PublicationCollector', () => {

  afterEach(() => {
    Documents.remove({});
    Documents.find().fetch();
    _.times(10, () => Documents.insert({foo: 'bar'}));
  });

  it('should be able to instantiate', () => {
    const instance = new PublicationCollector();
    assert.ok(instance);
  });

  describe('collect', () => {

    it('should collect documents from a publication', (done) => {
      const collector = new PublicationCollector();

      collector.collect('publication', collections => {
        assert.typeOf(collections.documents, 'array');
        assert.equal(collections.documents.length, 10, 'collects 10 documents');
        done();
      });
    });

    it('should throw error if one is trying to subscribe to non-existing publication', () => {
      const collector = new PublicationCollector();

      assert.throws(() =>
        collector.collect('foo')
        , /Couldn't find publication/);

    });

    it('should be able to return a Promise which resolves to the collections', (done) => {
      const collector = new PublicationCollector();

      const promise = collector.collect('publication');

      assert.ok(promise);
      assert.isFunction(promise.then);
      assert.isFunction(promise.catch);

      promise.then(collections => {
        assert.typeOf(collections.documents, 'array');
        assert.equal(collections.documents.length, 10, 'collects 10 documents');
        done();
      });
    });

    it('should collect documents from a publication using low-level added/changed/removed interface', (done) => {
      const collector = new PublicationCollector();

      collector.collect('publicationUsingLowLevelACRInterface', collections => {
        assert.typeOf(collections.counts, 'array');
        assert.equal(collections.counts.length, 1, 'collects 1 document');
        assert.sameDeepMembers(collections.counts, [{ _id: 'Documents', count: 10 }]);
        done();
      });
    });

    it("should collect documents from a publication that makes changes after it's ready", (done) => {
      const collector = new PublicationCollector({ delayInMs: 200 }); // add happens after 100ms

      collector.collect('publicationWithPostReadyChanges', collections => {
        assert.typeOf(collections.counts, 'array');
        assert.equal(collections.counts.length, 1, 'collects 1 document');
        assert.sameDeepMembers(collections.counts, [{ _id: 'Documents', count: 10 }]);
        done();
      });
    });

    it('should allow a ObjectID as _id', (done) => {
      Documents.remove({});
      Documents.insert({_id: new Mongo.ObjectID()});

      const collector = new PublicationCollector();

      collector.collect('publication', collections => {
        assert.typeOf(collections.documents, 'array');
        assert.equal(collections.documents.length, 1);
        done();
      });
    });

    it('should return cursor results as a dictionary, with collection names as keys', (done) => {
      Books.remove({});
      Meteor.users.remove({});

      _.times(5, () => Books.insert({foo: 'bar'}));
      _.times(2, () => Meteor.users.insert({foo: 'bar'}));

      const collector = new PublicationCollector();

      collector.collect('publicationWithSeveralCursors', collections => {
        assert.typeOf(collections.documents, 'array');
        assert.typeOf(collections.books, 'array');
        assert.typeOf(collections.users, 'array');
        assert.equal(collections.documents.length, 10);
        assert.equal(collections.books.length, 5);
        assert.equal(collections.users.length, 2);

        done();
      });
    });

    it('should return an empty array for when there are no documents', (done) => {
      Documents.remove({});
      assert.equal(Documents.find().fetch().length, 0);

      const collector = new PublicationCollector();

      collector.collect('publication', collections => {
        assert.typeOf(collections.documents, 'array');
        assert.equal(collections.documents.length, 0);
        done();
      });
    });

    it('should pass the correct scope to the publication', (done) => {
      const collector = new PublicationCollector({userId: 'foo'});

      collector.collect('publicationWithUser', collections => {
        assert.ok(collections.documents);
        assert.equal(collections.documents.length, 10, 'collects 10 documents');
        done();
      });
    });

    it('should emit ready event', () => {
      const collector = new PublicationCollector();
      const spy = sinon.spy();
      collector.on('ready', spy);

      collector.collect('publication');
      assert.ok(spy.calledOnce, 'ready was called');
    });

    it('should pass arguments to publication', (done) => {
      Meteor.publish('publicationWithArgs', function(arg1, arg2) {
        assert.equal(arg1, 'foo');
        assert.equal(arg2, 'bar');
        this.ready();
        done();
      });

      const collector = new PublicationCollector();

      collector.collect('publicationWithArgs', 'foo', 'bar');
    });

    it('should support optional publication arguments', (done) => {
      Meteor.publish('publicationWithOptionalArg', function(arg1 = 'foo') {
        assert.equal(arg1, 'foo');
        this.ready();
        done();
      });

      const collector = new PublicationCollector();

      collector.collect('publicationWithOptionalArg');
    });

    it('should support publications that are returning nothing', (done) => {
      Meteor.publish('publicationReturningNothing', () => {
        return [];
      });

      const readyCallback = sinon.spy();
      const collector = new PublicationCollector();

      collector.collect('publicationReturningNothing', readyCallback);
      assert.isTrue(readyCallback.calledOnce);

      done();
    });

    it('throws an error if a publication returns truthy values other than cursors or arrays', async () => {
      Meteor.publish('publicationReturningTruthyValue', () => {
        return true;
      });

      const collector = new PublicationCollector();

      try {
        await collector.collect('publicationReturningTruthyValue');
      } catch (ex) {
        assert.instanceOf(ex, Error);
        assert.match(ex.message, /Publish function can only return a Cursor or an array of Cursors/);
      }
    });

    it('stops the publication if an error is thrown in the callback', async () => {
      const collector = new PublicationCollector();

      let stopMethodCalled = false;
      collector.onStop(() => {
        stopMethodCalled = true;
      });

      let exception;
      try {
        await collector.collect('publication', collections => {
          throw new Error('Test');
        });
      } catch (e) {
        exception = e;
      }

      assert.isTrue(stopMethodCalled);
      assert.instanceOf(exception, Error);
    });
  });

  describe('Added', () => {

    it('should add a document to the local data store', () => {
      const collector = new PublicationCollector();

      const id = Random.id();
      const doc = {_id: id, foo: 'bar'};
      collector.added('documents', doc._id, doc);

      assert.deepEqual(collector._documents.documents[id], doc);
    });
  });

  describe('Removed', () => {

    it('should remove a document to the local data store', () => {
      const collector = new PublicationCollector();

      const doc = Documents.findOne();
      collector.collect('publication');
      collector.removed('documents', doc._id);

      assert.notOk(collector._documents.documents[doc._id]);
      assert.equal(Object.keys(collector._documents.documents).length, 9);
    });
  });

  describe('Error', () => {

    it('should throw error when .error() is called in publication', async () => {
      // We're not passing a user context here to trigger error.
      const collector = new PublicationCollector();

      try {
        await collector.collect('publicationError');
      } catch (ex) {
        assert.instanceOf(ex, Meteor.Error);
        assert.match(ex.error, /not-authorized/);
      }
    });
  });

  describe('_generateResponse', () => {

    it('should generate a response with collection names as keys', (done) => {
      const collector = new PublicationCollector();

      collector.collect('publication', collections => {
        assert.equal(Object.keys(collections).length, 1);
        assert.equal(Object.keys(collections)[0], 'documents');
        done();
      });
    });
  });
});
