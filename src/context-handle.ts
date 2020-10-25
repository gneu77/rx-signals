export class ContextHandle {
  private active = false;

  get isInContext(): boolean {
    return this.active;
  }

  withContext(cb: () => void): void {
    const wasActive = this.active;
    this.active = true;
    try {
      cb();
    } finally {
      this.active = wasActive;
    }
  }
}
export default ContextHandle;
