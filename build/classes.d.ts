export declare class ApplicationError extends Error {
    exitCode: number;
    constructor(message?: string, exitCode?: number);
}
/**Useful for building very long strings. */
export declare class StringBuilder {
    buffer: string;
    constructor();
    add(message: string): StringBuilder;
    add(condition: boolean, message: string): StringBuilder;
    addWord(message: string): StringBuilder;
    addWord(condition: boolean, message: string): StringBuilder;
    /** Adds a newline. */
    addLine(): StringBuilder;
    /** Adds a string followed by a newline. If the string is empty or undefined, does nothing. */
    addLine(message: string | undefined): StringBuilder;
    /** Adds `message` followed by a newline if `condition` is true. */
    addLine(condition: boolean, message: string): StringBuilder;
    text(): string;
}
