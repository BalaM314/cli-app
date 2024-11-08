export declare class ApplicationError extends Error {
    constructor(message?: string);
}
/**Useful for building very long strings. */
export declare class StringBuilder {
    buffer: string;
    constructor();
    add(message: string): StringBuilder;
    add(condition: boolean, message: string): StringBuilder;
    addWord(message: string): StringBuilder;
    addWord(condition: boolean, message: string): StringBuilder;
    addLine(): StringBuilder;
    addLine(message: string): StringBuilder;
    addLine(condition: boolean, message: string): StringBuilder;
    text(): string;
}
