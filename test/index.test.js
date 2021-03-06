
const should = require('chai').should();

import { Node } from '../build/Node';
import { PriorityQueue } from '../build/Queue';

describe('Queue', () => {

  let queue;
  const toRemove = new Node('c');

  it('should initialize queue properly', (done) => {
    queue = new PriorityQueue();
    queue.should.not.equal(undefined);
    queue.getSize().should.equal(0);
    should.not.exist(queue.head.val);
    should.not.exist(queue.tail.val);
    done();
  });

  it('should enqueue a node to queue', (done) => {
    queue.enqueue(new Node('a'));
    queue.enqueue(new Node('b'));
    queue.enqueue(toRemove);
    queue.enqueue(new Node('d'));
    queue.getSize().should.equal(4);
    queue.print().should.equal('d->c->b->a->');
    done();
  });

  it('should dequeue a node from queue', (done) => {
    const node = queue.dequeue();
    queue.getSize().should.equal(3);
    node.val.should.equal('a')
    queue.print().should.equal('d->c->b->');
    done();
  });

  it('should remove a node from a queue', (done) => {
    queue.remove(toRemove);
    queue.getSize().should.equal(2);
    queue.print().should.equal('d->b->');
    done();
  });
});

describe('Cache', () => {

  let ImageCache;
  const mock = require('mock-require');
  const mockRNBlob = require('../test/rnBlob.js').rnBlob

  //delete our singleton object after each test
  const deleteCacheInstance = () => {
    delete ImageCache.instance;
  }

  it('should initialize cache properly when file not available', (done) => {
    mockRNBlob.default.fs.readFile = () => (
      new Promise((resolve, reject) => reject({ code: 'RNFetchBlob failed to read file' }))
    )
    mockRNBlob.default.fs.writeFile = () => (
      new Promise((resolve, reject) => resolve('file Saved'))
    )
    mockRNBlob.default.fs.exists = () => (
      new Promise((resolve, reject) => resolve(true))
    )
    mock('react-native-fetch-blob', mockRNBlob);
    ImageCache = require('../build/Cache').ImageCache;
    ImageCache
    .get()
    .then((cacheInstance) => {
      const cache = cacheInstance;
      cache.should.not.equal(null);
      console.log('policy', cache.policy)
      cache.policy.queue.getSize().should.equal(0);
      Object.keys(cache.policy.map).length.should.equal(0);
      cache.policy.queue.print().should.equal('')
      deleteCacheInstance();
      done();
    })
    .catch((err) => console.log('err', err))
  });

  it('should initialize cache properly when file available', (done) => {
    mockRNBlob.default.fs.readFile = () => (
      new Promise((resolve, reject) => resolve('["patha", "pathb", "pathc"]'))
    )
    mock('react-native-fetch-blob', mockRNBlob);
    ImageCache = require('../build/Cache').ImageCache;
    ImageCache
    .get()
    .then((cacheInstance) => {
      const cache = cacheInstance
      cache.should.not.equal(null)
      cache.policy.queue.getSize().should.equal(3);
      Object.keys(cache.policy.map).length.should.equal(3);
      cache.policy.queue.print().should.equal('pathc->pathb->patha->')
      done();
    })
    .catch((err) => console.log('err', err))
  });

  it('should update cache instance with right order', (done) => {
    ImageCache = require('../build/Cache').ImageCache;
    ImageCache
    .get()
    .then((cacheInstance) => {
      const cache = cacheInstance
      cache.update('pathd');
      cache.update('pathe');
      cache.should.not.equal(null)
      cache.policy.queue.getSize().should.equal(5);
      Object.keys(cache.policy.map).length.should.equal(5);
      cache.policy.queue.print().should.equal('pathe->pathd->pathc->pathb->patha->')
      done();
    })
    .catch((err) => console.log('err', err))
  });

  it('should update order with pathb access', (done) => {
    ImageCache = require('../build/Cache').ImageCache;
    ImageCache
    .get()
    .then((cacheInstance) => {
      const cache = cacheInstance
      cache.update('pathb');
      cache.should.not.equal(null)
      cache.policy.queue.getSize().should.equal(5);
      Object.keys(cache.policy.map).length.should.equal(5);
      cache.policy.queue.print().should.equal('pathb->pathe->pathd->pathc->patha->')
      done();
    })
    .catch((err) => console.log('err', err))
  });

  it('should update order with double (pathe & patha) access', (done) => {
    ImageCache = require('../build/Cache').ImageCache;
    ImageCache
    .get()
    .then((cacheInstance) => {
      const cache = cacheInstance
      cache.update('pathd');
      cache.update('patha');
      cache.should.not.equal(null)
      cache.policy.queue.getSize().should.equal(5);
      Object.keys(cache.policy.map).length.should.equal(5);
      cache.policy.queue.print().should.equal('patha->pathd->pathb->pathe->pathc->')
      done();
    })
    .catch((err) => console.log('err', err))
  });

  it('should evict pathc with new access pathf', (done) => {
    mockRNBlob.default.fs.unlink = () => (
      new Promise((resolve, reject) => resolve('success'))
    )
    mock('react-native-fetch-blob', mockRNBlob);
    ImageCache = require('../build/Cache').ImageCache;
    ImageCache
    .get()
    .then((cacheInstance) => {
      const cache = cacheInstance

      //mock this.cache
      cache.cache = {
        'patha' : {
          path : 'patha'
        },
        'pathb' : {
          path : 'pathb'
        },
        'pathc' : {
          path : 'pathc'
        },
        'pathd' : {
          path : 'pathd'
        },
        'pathe' : {
          path : 'pathe'
        },
        'pathf' : {
          path : 'pathf'
        }
      }

      cache.update('pathf');
      cache.should.not.equal(null)
      cache.policy.queue.getSize().should.equal(5);
      Object.keys(cache.policy.map).length.should.equal(5);
      cache.policy.queue.print().should.equal('pathf->patha->pathd->pathb->pathe->')
      done();
    })
    .catch((err) => console.log('err', err))
  });

  it('should evict pathe with new access pathg, update pathd and bring back in pathe, evicting pathb', (done) => {
    mockRNBlob.default.fs.unlink = () => (
      new Promise((resolve, reject) => resolve('success'))
    )
    mock('react-native-fetch-blob', mockRNBlob);
    ImageCache = require('../build/Cache').ImageCache;
    ImageCache
    .get()
    .then((cacheInstance) => {
      const cache = cacheInstance

      //mock this.cache
      cache.cache['pathg'] = {
          path : 'pathg'
        }

      cache.update('pathg');
      cache.update('pathd');
      cache.update('pathe');
      cache.should.not.equal(null)
      cache.policy.queue.getSize().should.equal(5);
      Object.keys(cache.policy.map).length.should.equal(5);
      cache.policy.queue.print().should.equal('pathe->pathd->pathg->pathf->patha->')
      deleteCacheInstance();
      done();
    })
    .catch((err) => console.log('err', err))
  });

  it('should initialize cache testing agains race conditions', (done) => {
    mockRNBlob.default.fs.readFile = () => (
      new Promise((resolve, reject) => {
        setTimeout(() => {
          resolve('["patha", "pathb", "pathc"]')
        }, 1000);
      })
    )
    mock('react-native-fetch-blob', mockRNBlob);
    ImageCache = require('../build/Cache').ImageCache;
    let cache1;
    let cache2;
    let cache3;

    ImageCache
    .get()
    .then((cacheInstance) => {
      cache1 = cacheInstance;
    })
    .catch((err) => console.log('err', err))

    ImageCache
    .get()
    .then((cacheInstance) => {
      cache2 = cacheInstance;
    })
    .catch((err) => console.log('err', err))

    ImageCache
    .get()
    .then((cacheInstance) => {
      cache3 = cacheInstance;

      cache1.should.not.equal(null)
      cache2.should.not.equal(null)
      cache3.should.not.equal(null)

      cache1.policy.queue.getSize().should.equal(3);
      Object.keys(cache1.policy.map).length.should.equal(3);
      cache1.policy.queue.print().should.equal('pathc->pathb->patha->')

      cache2.policy.queue.getSize().should.equal(3);
      Object.keys(cache2.policy.map).length.should.equal(3);
      cache2.policy.queue.print().should.equal('pathc->pathb->patha->')

      cache3.policy.queue.getSize().should.equal(3);
      Object.keys(cache3.policy.map).length.should.equal(3);
      cache3.policy.queue.print().should.equal('pathc->pathb->patha->')

      cache3.requestQueue.length.should.equal(0);
      done();
    })
    .catch((err) => console.log('err', err))


  });
});
