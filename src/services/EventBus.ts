type EventCallback = (data?: any) => void;

class EventBus {
  private listeners: { [key: string]: EventCallback[] } = {};

  /**
   * Subscribe to a system-wide event. Returns an unsubscribe function.
   */
  on(event: string, callback: EventCallback): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    return () => this.off(event, callback);
  }

  /**
   * Unsubscribe from an event.
   */
  off(event: string, callback: EventCallback): void {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  /**
   * Emit an event to all active subscribers.
   */
  emit(event: string, data?: any): void {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(callback => {
      try {
        callback(data);
      } catch (err) {
        console.error(`[EventBus] Error executing subscriber for '${event}':`, err);
      }
    });
  }
}

export const eventBus = new EventBus();
export default eventBus;
