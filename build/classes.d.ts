export declare class ApplicationError extends Error {
    exitCode: number;
    name: string;
    constructor(message?: string, exitCode?: number);
}
/**Useful for building very long strings. */
export declare class StringBuilder {
    private buffer;
    /** Adds text to the StringBuilder. */
    add(message: string): StringBuilder;
    /** Adds text to the StringBuilder if `condition` is true. */
    add(condition: boolean, message: string): StringBuilder;
    /** Adds text to the StringBuilder, and prepends a space, but only if `message` isn't empty. */
    addWord(message: string): StringBuilder;
    /** Adds text to the StringBuilder, and prepends a space, but only if `condition` is true. */
    addWord(condition: boolean, message: string): StringBuilder;
    /** Adds a newline. */
    addLine(): StringBuilder;
    /** Adds a string followed by a newline. If the string is empty or undefined, does nothing. */
    addLine(message: string | undefined): StringBuilder;
    /** Adds `message` followed by a newline if `condition` is true. */
    addLine(condition: boolean, message: string): StringBuilder;
    text(): string;
}
