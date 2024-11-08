import type { Script } from "./Script.js";
import type { ArgOptions, CommandHandler, FilledArgOptions, SpecificOptions } from "./types.js";
/**
 * Represents an entire application, with multiple subcommands and various functionality.
 */
export declare class Application {
    name: string;
    description: string;
    /** Stores all subcommands. */
    commands: {
        [name: string]: Subcommand<Application, ArgOptions> | undefined;
    };
    /** Stores all command aliases. */
    aliases: {
        [alias: string]: string;
    };
    /** Used for tests. */
    private fs_realpathSync;
    /** The directory containing this application's main file. Uses slash or backslash dependent on platform. */
    sourceDirectory: string;
    constructor(name: string, description: string);
    /**
     * Adds a subcommand to this application.
     * @param handler The function that is called when this subcommand is run.
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
    static splitLineIntoArguments(line: string): string[];
    /**
     * Parses command line arguments into an object.
     * @param providedArgs Pass process.argv without modifying it.
     * @returns Formatted args.
     */
    static parseArgs(providedArgs: string[], valuelessOptions?: string[]): Omit<SpecificOptions<ArgOptions>, "commandName">;
    /**
     * Runs an application.
     * @param args Pass process.argv without modifying it.
     * @param options Used for testing.
     */
    run(args: string[], options?: {
        throwOnError?: boolean;
    }): void;
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
    /**
     * Runs this subcommand.
     */
    run(options: SpecificOptions<ArgOptions>, application: App): void;
}
