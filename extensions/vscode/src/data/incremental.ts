/**
 * Incremental updates system.
 * 
 * Provides capabilities to update data incrementally instead of reloading everything.
 */

import { EventEmitter } from 'events';

/**
 * Update operation.
 */
export interface UpdateOperation<T> {
  /** Operation type */
  type: 'add' | 'update' | 'delete' | 'replace';
  /** Item data */
  item?: T;
  /** Item index (for add/update/delete) */
  index?: number;
  /** Items (for replace) */
  items?: T[];
  /** Item ID */
  id?: string;
}

/**
 * Incremental update manager.
 */
export class IncrementalUpdateManager<T extends { id?: string }> extends EventEmitter {
  private items: T[] = [];
  private itemMap: Map<string, T> = new Map();

  /**
   * Initializes with items.
   */
  initialize(items: T[]): void {
    this.items = [...items];
    this.itemMap.clear();
    items.forEach((item) => {
      if (item.id) {
        this.itemMap.set(item.id, item);
      }
    });
    this.emit('initialized', this.items);
  }

  /**
   * Applies an update operation.
   */
  applyUpdate(operation: UpdateOperation<T>): void {
    switch (operation.type) {
      case 'add':
        if (operation.item) {
          this.items.push(operation.item);
          if (operation.item.id) {
            this.itemMap.set(operation.item.id, operation.item);
          }
          this.emit('added', operation.item, this.items.length - 1);
        }
        break;

      case 'update':
        if (operation.item && operation.id) {
          const index = this.items.findIndex((item) => item.id === operation.id);
          if (index > -1) {
            this.items[index] = operation.item;
            this.itemMap.set(operation.id, operation.item);
            this.emit('updated', operation.item, index);
          }
        }
        break;

      case 'delete':
        if (operation.id) {
          const index = this.items.findIndex((item) => item.id === operation.id);
          if (index > -1) {
            const deleted = this.items.splice(index, 1)[0];
            this.itemMap.delete(operation.id);
            this.emit('deleted', deleted, index);
          }
        } else if (operation.index !== undefined) {
          const deleted = this.items.splice(operation.index, 1)[0];
          if (deleted.id) {
            this.itemMap.delete(deleted.id);
          }
          this.emit('deleted', deleted, operation.index);
        }
        break;

      case 'replace':
        if (operation.items) {
          this.items = [...operation.items];
          this.itemMap.clear();
          operation.items.forEach((item) => {
            if (item.id) {
              this.itemMap.set(item.id, item);
            }
          });
          this.emit('replaced', this.items);
        }
        break;
    }

    this.emit('updated', this.items);
  }

  /**
   * Gets all items.
   */
  getItems(): T[] {
    return [...this.items];
  }

  /**
   * Gets item by ID.
   */
  getItemById(id: string): T | undefined {
    return this.itemMap.get(id);
  }

  /**
   * Gets item count.
   */
  getCount(): number {
    return this.items.length;
  }

  /**
   * Clears all items.
   */
  clear(): void {
    this.items = [];
    this.itemMap.clear();
    this.emit('cleared');
  }
}

