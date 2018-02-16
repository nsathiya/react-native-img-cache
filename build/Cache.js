
import { LRUPolicy } from './policies/lru';

const RNFetchBlob = require("react-native-fetch-blob").default;
const SHA1 = require("crypto-js/sha1");
const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
const BASE_DIR = RNFetchBlob.fs.dirs.DocumentDir + "/imageFiles";
const QUEUE_DIR = RNFetchBlob.fs.dirs.DocumentDir + "/";
const CACHE_LIMIT_FILE_COUNT = 10;

export class ImageCache {

    static readQueue(file) {
      return new Promise((resolve, reject) => {
        RNFetchBlob.fs.readFile(QUEUE_DIR + file, 'utf8')
        .then((data) => resolve(JSON.parse(data)))
        .catch((err) => {
          console.log('No Queue File Found: ', err);
          RNFetchBlob.fs.exists(QUEUE_DIR + file).then((exists) => {
             if (exists) {
               RNFetchBlob.fs.writeFile(QUEUE_DIR + file, '[]', 'utf8')
               .then((result) => resolve([]))
               .catch((err) => reject(err))
             }
             else {
               RNFetchBlob.fs.createFile(QUEUE_DIR + file, '[]', 'utf8')
               .then((result) => resolve([]))
               .catch((err) => reject(err))
             }
         });
        });
      })
    }

    static constructPolicy(data, type){
      if (type === 'lru'){
        return new LRUPolicy(data);
      }
    }

    static readQueueAndResolve(file) {
      ImageCache.instance.loading = true;
      ImageCache.readQueue(file)
      .then((data) => {
        ImageCache.instance.policy = ImageCache.constructPolicy(data, 'lru');
        ImageCache.instance.loading = false;

        //process and remove requests
        ImageCache.instance.requestQueue.forEach((resolve) => {
          resolve(ImageCache.instance);
        });
        ImageCache.instance.requestQueue = [];
      })
      .catch((err) => console.log('Error reading queue and resolvings- ', err))
    }

    static save(file, queueData) {
      const data = JSON.stringify(queueData)
      RNFetchBlob.fs.writeFile(QUEUE_DIR + file, data, 'utf8')
      .then((result) => {
        if (process.env.NODE_ENV !== "TEST") {
          console.log('Queue successfully saved!');
        }
      })
      .catch((err) => console.log('Error saving queue', err))
    }

    constructor() {
      //TODO: move cache to LRU
        this.cache = {};
        this.policy = null;
        this.loading = false;
        this.requestQueue = [];
    }

    getPath(dbPath, isLocal) {
        if (isLocal){
          return dbPath
        } else {
          const ext = dbPath.indexOf(".") === -1 ? ".jpg" : dbPath.substring(dbPath.lastIndexOf("."));
          return BASE_DIR + "/" + SHA1(dbPath) + ext;
        }
    }

    static get() {
      return new Promise((resolve, reject) => {
        if (!ImageCache.instance) {
          ImageCache.instance = new ImageCache();
          ImageCache.instance.requestQueue.push(resolve);
          ImageCache.readQueueAndResolve('queue.txt');
        } else if (ImageCache.instance.loading === true) {
          ImageCache.instance.requestQueue.push(resolve);
        } else {
          resolve(ImageCache.instance);
        }
      })
    }

    clear() {
        this.cache = {};
        return RNFetchBlob.fs.unlink(BASE_DIR);
    }

    on(source, handler, immutable) {
        console.log('ImageCache Operations on...');
        const { dbPath, dbProvider, isLocal } = source;
        if (!this.cache[dbPath]) {
            console.log('Entry not in application cache');
            this.cache[dbPath] = {
                source: source,
                downloading: false,
                handlers: [handler],
                immutable: immutable === true,
                path: this.getPath(dbPath, isLocal)
            };
            this.get(dbPath, isLocal);
        }
        else {

            this.cache[dbPath].handlers.push(handler);
            this.get(dbPath, isLocal);
        }
    }

    dispose(dbPath, handler) {
        const cache = this.cache[dbPath];
        if (cache) {
            cache.handlers.forEach((h, index) => {
                if (h === handler) {
                    cache.handlers.splice(index, 1);
                }
            });
        }
    }

    download(cache) {
        const { source } = cache;
        const { dbPath, dbProvider } = source;
        dbProvider.getInstance().firebase.storage()
            .ref(dbPath)
            .getDownloadURL().then((uri) => {
            if (!cache.downloading) {
                console.log('downloading...');
                const path = this.getPath(dbPath);
                cache.downloading = true;
                const method = source.method ? source.method : "GET";
                cache.task = RNFetchBlob.config({ path }).fetch(method, uri, source.headers);
                cache.task.then(() => {
                    console.log('download finished...');
                    cache.downloading = false;
                    cache.path = path;
                    this.notify(source.dbPath, false);
                }).catch(() => {
                    cache.downloading = false;
                    // Parts of the image may have been downloaded already, (see https://github.com/wkh237/react-native-fetch-blob/issues/331)
                    RNFetchBlob.fs.unlink(path);
                });
            }
        }).catch(err => {
            console.log('Error retriveing download URL : ', err);
        });
    }
    get(dbPath, isLocal) {
        const cache = this.cache[dbPath];
        if (cache.path) {
            // We check here if IOS didn't delete the cache content
            RNFetchBlob.fs.exists(cache.path).then((exists) => {
                if (exists) {
                    this.notify(dbPath, isLocal);
                }
                else {
                    this.download(cache);
                }
            });
        }
        else {
            this.download(cache);
        }
    }
    notify(dbPath, isLocal) {

        const handlers = this.cache[dbPath].handlers;
        handlers.forEach(handler => {
            handler(this.cache[dbPath].path);
        });
        //Cache eviction update
        if (!isLocal){
         //only update if photo is stored on our memory space
         this.update(dbPath)
        }
    }

    isFull(){
      //return Object.keys(this.cache).length > CACHE_LIMIT_FILE_COUNT;
      return this.policy.queue.getSize() >= CACHE_LIMIT_FILE_COUNT;
    }

    update(key){
      if (this.policy.hasVal(key)){
        this.policy.updatePriority(key);
      } else {
        if (this.isFull()){
	        //console.log('cache is Full!');
          const lowestPriority = this.policy.lowestPriority();
          this.policy.remove(lowestPriority);
          const path = this.getPath(lowestPriority);
          RNFetchBlob.fs.unlink(path);
          delete this.cache[lowestPriority];
        }
        this.policy.add(key);
      }
      ImageCache.save('queue.txt', this.policy.save());
    }
}
