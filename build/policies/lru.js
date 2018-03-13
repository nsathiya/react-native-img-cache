
import { Node } from '../Node';
import { PriorityQueue } from '../Queue';

export class LRUPolicy {

    prepare(data){
      let queue = new PriorityQueue();
      const map = {};
      data.forEach((dbPath) => {
        let n = new Node(dbPath)
        queue.enqueue(n)
        map[dbPath] = n;
      })
      return {queue, map}
    }

    constructor(data) {
        const { queue, map } = this.prepare(data)
        this.queue = queue;
        this.map = map;
    }

    add(val){
      if (!this.map[val]){
        let newNode = new Node(val);
        this.map[val] = newNode;
        this.queue.enqueue(newNode);
      }
    }

    remove(val){
      let nodeRemove = this.map[val];
      if (nodeRemove){
        this.queue.remove(nodeRemove);
        delete this.map[val]
      }
    }

    highestPriority(){
      if (this.queue.getSize() > 0){
        return this.queue.back();
      }
    }

    lowestPriority(){
      if (this.queue.getSize() > 0){
        const currentValue = this.queue.peek()
        let currentNode = this.map[currentValue]
        let hasHandlers = this.hasHandlers(currentValue, cache)
        while(hasHandlers && currentNode){
          currentNode = currentNode.prev
          hasHandlers = this.hasHandlers(currentNode.val, cache)
        }
        return currentNode.val
      }
    }

    updatePriority(val){
      const updateNode = this.map[val]
      if (updateNode){
        this.queue.remove(updateNode)
        this.queue.enqueue(updateNode)
      }
    }

    hasHandlers(val, cache){
      return cache[val] && cache[val].handlers.length > 0
    }

    hasVal(val){
      return this.map[val];
    }

    save(){
      return this.queue.save();
    }
}
