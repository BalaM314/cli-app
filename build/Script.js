/*
Copyright © <BalaM314>, 2024.
This file is part of cli-app.
cli-app is free software: you can redistribute it and/or modify it under the terms of the GNU Lesser General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
cli-app is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Lesser General Public License for more details.
You should have received a copy of the GNU Lesser General Public License along with cli-app. If not, see <https://www.gnu.org/licenses/>.

Contains the code for the Script class, which represents an application that does one thing only.
*/
import path from "node:path";
import fs from "node:fs";
import { Application, Subcommand } from "./Application.js";
import { ApplicationError, StringBuilder } from "./classes.js";
/**
 * Represents an application that does one thing only.
 */
export class Script {
    constructor(name, description, handler, argOptions) {
        this.helpCommand = new Subcommand("help", this.runHelpCommand.bind(this), "Displays help on all commands or a specific subcommand.", {
            positionalArgs: [{
                    name: "command",
                    description: "The command to get help on.",
                    optional: true
                }],
            namedArgs: {}
        });
        this.name = name;
        this.sourceDirectory = "null";
        this.defaultCommand = new Subcommand(name, handler, description, {
            namedArgs: argOptions?.namedArgs ?? {},
            positionalArgs: argOptions?.positionalArgs ?? [],
            aliases: argOptions?.aliases ?? {}
        }, true);
    }
    /**
     * Runs the help command for this application. Do not call directly.
     */
    runHelpCommand(opts) {
        const positionalArgsFragment = this.defaultCommand.argOptions.positionalArgs.map(opt => opt.optional ? `[<${opt.name}>]` : `<${opt.name}>`).join(" ");
        const namedArgsFragment = Object.entries(this.defaultCommand.argOptions.namedArgs)
            .map(([name, opt]) => opt.optional ?
            `[--${name}${opt.valueless ? `` : ` <${name}>`}]`
            : `--${name}${opt.valueless ? "" : ` <${name}>`}`).join(" ");
        const outputText = new StringBuilder()
            .addLine()
            .addLine(`Help for ${this.name}:`)
            .add(`Usage: ${this.name}`)
            .addWord(positionalArgsFragment)
            .addWord(namedArgsFragment)
            .add("\n")
            .addLine();
        if (Object.entries(this.defaultCommand.argOptions.namedArgs).length != 0) {
            Object.entries(this.defaultCommand.argOptions.namedArgs)
                .map(([name, opt]) => `<${name}>: ${opt.description}`).forEach(line => outputText.addLine(line));
            outputText.addLine();
        }
        if (this.defaultCommand.argOptions.positionalArgs.length != 0) {
            this.defaultCommand.argOptions.positionalArgs
                .map((opt) => `<${opt.name}>: ${opt.description}`).forEach(line => outputText.addLine(line));
            outputText.addLine();
        }
        process.stdout.write(outputText.text());
        return 0;
    }
    /**
     * Runs an application.
     * @param rawArgs Pass process.argv without modifying it.
     * @param options Used for testing.
     */
    async run(rawArgs, options) {
        this.sourceDirectory = path.join(fs.realpathSync(rawArgs[1]), "..");
        const args = rawArgs.slice(2);
        const parsedArgs = Application.parseArgs(args);
        let command;
        if ("help" in parsedArgs.namedArgs || "?" in parsedArgs.namedArgs) {
            command = this.helpCommand;
        }
        else {
            command = this.defaultCommand;
        }
        try {
            const result = await command.run(args, this);
            if (typeof result == "number") {
                if (options?.exitProcessOnHandlerReturn)
                    process.exit(result);
                else if (result != 0)
                    throw new Error(`Non-zero exit code: ${result}`);
            }
        }
        catch (err) {
            if (options?.throwOnError)
                throw err;
            if (err instanceof ApplicationError) {
                console.error(`Error: ${err.message}`);
            }
            else {
                console.error("The command encountered an unhandled runtime error.");
                console.error(err);
            }
        }
    }
}
