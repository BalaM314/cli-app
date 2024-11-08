import { Subcommand } from "./Application.js";
import { ArgOptions, CommandHandler, SpecificOptions } from "./types.js";
/**
 * Represents an application that does one thing only.
 */
export declare class Script<A extends Partial<ArgOptions>> {
    defaultCommand: Subcommand<this, ArgOptions>;
    helpCommand: Subcommand<this, ArgOptions>;
    name: string;
    sourceDirectory: string;
    constructor(name: string, description: string, handler: CommandHandler<Script<A>, A>, argOptions?: A);
    /**
     * Runs the help command for this application. Do not call directly.
     */
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
     * Runs an application.
     * @param args Pass process.argv without modifying it.
     * @param options Used for testing.
     */
    run(args: string[], options?: {
        throwOnError?: boolean;
    }): void;
}
