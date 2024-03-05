class CustomErrors extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message
    };
  }
}

export class ValidationError extends CustomErrors {}
