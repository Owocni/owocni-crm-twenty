export declare class BirError extends Error {
    response?: any;
    constructor(message: string);
    static assert(response: any): void;
}
