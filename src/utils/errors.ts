class CustomErrors extends Error {
    constructor(message: string){
        super(message);
        this.name = this.constructor.name;
    }
}

export class ValidationError extends CustomErrors {}