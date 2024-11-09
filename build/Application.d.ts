import type { Script } from "./Script.js";
import type { ApplicationRunOptions, ArgOptions, CommandHandler, FilledArgOptions, SpecificOptions } from "./types.js";
/**
 * Represents an entire application, with multiple subcommands and various functionality.
 */
export declare class Application {
    /** The name used to run this application. Will be used in error suggestions. */
    name: string;
    description: string;
    /** Stores all subcommands. */
    commands: Record<string, Subcommand<Application, any> | undefined>;
    /** Stores all command aliases. */
    aliases: {
        [alias: string]: string;
    };
    /** The directory containing this application's main file. Uses slash or backslash dependent on platform. */
    sourceDirectory: string;
    constructor(
    /** The name used to run this application. Will be used in error suggestions. */
    name: string, description: string);
    /**
     * Adds a subcommand to this application.
     * @param handler The function that is called when this subcommand is run.
     * Return value handling:
     * - If the function returns an exit code (sync or async), the app will be closed immediately with that exit code.
     * - If the function returns undefined (sync or async), cli-app will do nothing, and NodeJS's standard behavior will occur.
     * @param argOptions Specifies the args that can be passed to this subcommand through the command line.
     * @param aliases List of alternative names for this command.
     */
    command<A extends Partial<ArgOptions>>(name: string, description: string, handler: CommandHandler<Application, A>, isDefault?: boolean, argOptions?: A, aliases?: string[]): this;
    /** Creates an alias for a subcommand. */
    alias(alias: string, target: string): this;
    /** Runs the help command for this application. Do not call directly. */
    runHelpCommand(opts: SpecificOptions<{
        positionalArgs: [
            {
                name: "command";
                description: "The command to get help on.";
                required: false;
            }
        ];
        namedArgs: {};
    }>): number;
    /**
     * Parses command line arguments into an object.
     * @param providedArgs Remove JS runtime options from process.argv.
     * @returns Formatted args.
     */
    static parseArgs(providedArgs: readonly string[], valuelessOptions?: readonly string[]): {
        namedArgs: Record<string, string | boolean | undefined | null>;
        positionalArgs: string[];
        /** Set if the first argument passed is a positional argument. */
        firstPositionalArg: string | undefined;
    };
    /**
     * Runs an application.
     * @param args Pass process.argv without modifying it.
     * @param options Used for testing.
     */
    run(rawArgs: string[], { exitProcessOnHandlerReturn, throwOnError, }?: ApplicationRunOptions): Promise<void>;
}
/**
 * Represents one subcommand of an application or script.
 */
export declare class Subcommand<App extends Application | Script<ArgOptions>, A extends Partial<ArgOptions>> {
    name: string;
    handler: CommandHandler<App, A>;
    description: string;
    defaultCommand: boolean;
    /**
     * Information describing the command-line options that this subcommand accepts.
     */
    argOptions: FilledArgOptions;
    constructor(name: string, handler: CommandHandler<App, A>, description?: string, argOptions?: ArgOptions, defaultCommand?: boolean);
    /** Runs this subcommand. Do not call directly, call the application's run method instead. */
    run(args: string[], application: App): number | void | Promise<number | void>;
}
