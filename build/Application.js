/*
Copyright © <BalaM314>, 2024.
This file is part of cli-app.
cli-app is free software: you can redistribute it and/or modify it under the terms of the GNU Lesser General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
cli-app is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Lesser General Public License for more details.
You should have received a copy of the GNU Lesser General Public License along with cli-app. If not, see <https://www.gnu.org/licenses/>.

Contains the code for the Application class, which represents a command-line application.
*/
import path from "node:path";
import fs from "node:fs";
import { ApplicationError, StringBuilder } from "./classes.js";
import { crash, invalidConfig } from "./funcs.js";
/** Helper function to define a named argument. Uses the builder pattern. */
export const arg = (() => {
    const ArgBuilderPrototype = {
        description(description) {
            return { ...this, _description: description, __proto__: ArgBuilderPrototype };
        },
        optional() {
            return { ...this, _optional: true, __proto__: ArgBuilderPrototype };
        },
        required() {
            return { ...this, _optional: false, __proto__: ArgBuilderPrototype };
        },
        valueless() {
            return { ...this, _valueless: true, _optional: true, __proto__: ArgBuilderPrototype };
        },
        default(value) {
            return { ...this, _default: value, _optional: true, __proto__: ArgBuilderPrototype };
        },
        aliases(...aliases) {
            return { ...this, _aliases: aliases, __proto__: ArgBuilderPrototype };
        },
    };
    return () => ({
        __proto__: ArgBuilderPrototype,
        _default: undefined,
        _description: undefined,
        _optional: false,
        _valueless: false,
        _aliases: [],
    });
})();
/**
 * Represents an entire application, with multiple subcommands and various functionality.
 */
export class Application {
    constructor(
    /** The name used to run this application. Will be used in error suggestions. */
    name, description) {
        this.name = name;
        this.description = description;
        /** Stores all subcommands. */
        this.commands = {};
        /** Stores all command aliases. */
        this.aliases = {};
        this.commands["help"] = new Subcommand("help", this.runHelpCommand.bind(this), "Displays help on all commands or a specific subcommand.", {
            positionalArgs: [{
                    name: "command",
                    description: "The command to get help on.",
                    optional: true
                }],
            namedArgs: {},
            positionalArgCountCheck: "ignore",
            unexpectedNamedArgCheck: "warn",
        });
        this.sourceDirectory = "null";
    }
    command(name, description) {
        const app = this;
        const CommandBuilderPrototype = {
            description(description) {
                return { ...this, _description: description, __proto__: CommandBuilderPrototype };
            },
            aliases(...aliases) {
                return { ...this, _aliases: aliases, __proto__: CommandBuilderPrototype };
            },
            default() {
                return { ...this, _default: true, __proto__: CommandBuilderPrototype };
            },
            args(argOptions) {
                return {
                    ...this,
                    impl(impl) {
                        app.commands[name] = new Subcommand(this._name, impl, this._description, argOptions, this._default);
                        this._aliases.forEach(alias => app.aliases[alias] = name);
                    }
                };
            },
        };
        const builder = {
            __proto__: CommandBuilderPrototype,
            _name: name,
            _default: false,
            _description: description,
            _aliases: [],
        };
        return builder;
    }
    /**
     * Same as {@link command()}, but for applications with only one subcommand. This will slightly change the display of help messages.
     */
    onlyCommand() {
        if (Object.keys(this.commands).length > 1)
            invalidConfig(`onlyCommand() is not valid here: there are already other commands defined`);
        return this.command(this.name, this.description).default();
    }
    /** Creates an alias for a subcommand. */
    alias(alias, target) {
        this.aliases[alias] = target;
        return this;
    }
    getOnlyCommand() {
        const commands = Object.keys(this.commands).filter(c => c != "help");
        if (commands.length == 1)
            return commands[0];
        else
            return undefined;
    }
    /** Runs the help command for this application. Do not call directly. */
    runHelpCommand(opts) {
        const firstPositionalArg = opts.positionalArgs[0] ?? this.getOnlyCommand();
        if (firstPositionalArg) {
            const commandName = this.commands[firstPositionalArg] ? firstPositionalArg : this.aliases[firstPositionalArg] ?? firstPositionalArg;
            const command = this.commands[commandName];
            if (command) {
                const aliases = Object.entries(this.aliases).filter(([alias, name]) => name == commandName).map(([alias, name]) => alias);
                const positionalArgsFragment = command.argOptions.positionalArgs.map(opt => opt.optional ? `[<${opt.name}>]` : `<${opt.name}>`).join(" ");
                const namedArgsFragment = Object.entries(command.argOptions.namedArgs)
                    .map(([name, opt]) => opt._optional ?
                    `[--${name}${opt._valueless ? `` : ` <${name}>`}]`
                    : `--${name}${opt._valueless ? `` : ` <${name}>`}`).join(" ");
                const outputText = new StringBuilder()
                    .addLine()
                    .addLine(`Help for command ${command.name}:`)
                    .add((this.name == command.name && command.defaultCommand) ? `Usage: ${this.name}` : `Usage: ${this.name} ${command.name}`)
                    .addWord(positionalArgsFragment)
                    .addWord(namedArgsFragment)
                    .add("\n")
                    .addLine();
                if (Object.entries(command.argOptions.namedArgs).length != 0) {
                    Object.entries(command.argOptions.namedArgs)
                        .map(([name, opt]) => `<${name}>: ${opt._description}`).forEach(line => outputText.addLine(line));
                    outputText.addLine();
                }
                if (command.argOptions.positionalArgs.length != 0) {
                    command.argOptions.positionalArgs
                        .map((opt) => `<${opt.name}>: ${opt.description}`).forEach(line => outputText.addLine(line));
                    outputText.addLine();
                }
                outputText.addLine(aliases.length != 0, `Aliases: ${aliases.join(", ")}`);
                process.stdout.write(outputText.text());
            }
            else {
                console.log(`Unknown command ${firstPositionalArg}. Run ${this.name} help for a list of all commands.`);
            }
        }
        else {
            console.log(`${this.name}: ${this.description}

Usage: ${this.name} [command] [options]
	List of all commands:
`);
            for (const command of Object.values(this.commands)) {
                console.log(`\t${command?.name}: ${command?.description}`);
            }
            for (const [alias, name] of Object.entries(this.aliases)) {
                console.log(`\t${alias}: alias for ${name}`);
            }
        }
        return 0;
    }
    /**
     * Parses command line arguments into an object.
     * @param providedArgs Remove JS runtime options from process.argv.
     * @returns Formatted args.
     */
    static parseArgs(providedArgs, valuelessOptions = []) {
        const __nameEqualsValue = /^--([\s\S]+?)=([\s\S]+?)$/;
        const __name = /^--([\s\S]+)/;
        const _name = /^-(\w+)/;
        const namedArgs = {};
        const positionalArgs = [];
        let i = 0;
        const args = providedArgs.slice();
        let firstPositionalArg = undefined;
        while (true) {
            i++;
            if (i > 1000)
                throw new ApplicationError("Too many arguments!");
            const arg = args.shift(); //Grab the first arg
            if (arg == undefined)
                break; //If it doesn't exist, return
            let matchResult;
            if (arg == "--") { //Arg separator
                //Everything else should be considered a positional argument
                positionalArgs.push(arg, ...args);
                break;
            }
            else if ((matchResult = arg.match(__nameEqualsValue))) { //--name=value form
                const [, name, value] = matchResult;
                namedArgs[name] = value;
            }
            else if ((matchResult = arg.match(__name))) { //Starts with two hyphens
                const argName = matchResult[1];
                if (args[0]?.startsWith("-") || valuelessOptions.includes(argName)) {
                    //If the next arg also starts with a hyphen, or the arg name is valueless, set it to null
                    namedArgs[argName] = null;
                }
                else {
                    //Otherwise, pop off the first arg and set it to that
                    namedArgs[argName] = args.shift() ?? null;
                }
            }
            else if ((matchResult = arg.match(_name))) { //Starts with one hyphen
                const argName = matchResult[1];
                //Compound arg form:
                //iftop -nPNi eth0 means
                //iftop -n -P -N -i eth0
                const shortArgs = [...argName];
                const lastShortArg = shortArgs.pop(); //\w+ means at least one character must have matched
                if (args[0]?.startsWith("-") || valuelessOptions.includes(lastShortArg)) {
                    //If the next arg also starts with a hyphen, or the arg name is valueless, set it to null
                    namedArgs[lastShortArg] = null;
                }
                else {
                    //Otherwise, pop off the first arg and set it to that
                    namedArgs[lastShortArg] = args.shift() ?? null;
                }
                for (const arg of shortArgs) {
                    namedArgs[arg] = null;
                }
            }
            else {
                //It's a positional arg
                positionalArgs.push(arg);
                if (i == 1) {
                    firstPositionalArg = arg;
                }
            }
        }
        return {
            positionalArgs,
            namedArgs,
            firstPositionalArg
        };
    }
    /**
     * Runs an application.
     * @param args Pass process.argv without modifying it.
     * @param options Used for testing.
     */
    async run(rawArgs, { exitProcessOnHandlerReturn = true, throwOnError = false, } = {}) {
        if (rawArgs.length < 2)
            crash(`Application.run() received invalid argv: process.argv should include with "node path/to/filename.js" followed`);
        //This function does as little work as possible, and calls Subcommand.run()
        this.sourceDirectory = path.join(fs.realpathSync(rawArgs[1]), "..");
        //We need to do some argument parsing to determine which subcommand to run
        //but, once the subcommand has been determined, valueless args may change the parse result
        //solution: parse args twice
        //this can lead to ambiguous commands: `command --valueless parameter subcommand`
        //solution: do not allow named arguments before the subcommand name
        const args = rawArgs.slice(2);
        const { namedArgs, firstPositionalArg } = Application.parseArgs(args);
        //Set "help" to the default command: if someone runs `command nonexistentsubcommand ...rest`,
        //it will get interpreted as `command help nonexistentsubcommand ...rest`, which will generate the correct error message.
        const defaultCommand = Object.values(this.commands).find(command => command?.defaultCommand) ?? this.commands["help"]; //TODO compute in .command()
        const [newArgs, command] = (() => {
            if ("help" in namedArgs || "?" in namedArgs) {
                return [args, this.commands["help"]];
            }
            else if (firstPositionalArg && this.commands[firstPositionalArg]) {
                return [args.slice(1), this.commands[firstPositionalArg]];
            }
            else if (firstPositionalArg && this.aliases[firstPositionalArg]) {
                return [args.slice(1), this.commands[this.aliases[firstPositionalArg]]
                        ?? invalidConfig(`Subcommand "${firstPositionalArg}" was aliased to ${this.aliases[firstPositionalArg]}, which is not a valid command`)];
            }
            else
                return [args, defaultCommand];
        })();
        try {
            const result = await command.run(newArgs, this);
            if (typeof result == "number") {
                if (exitProcessOnHandlerReturn)
                    process.exit(result);
                else if (result != 0)
                    throw new Error(`Non-zero exit code: ${result}`);
            }
        }
        catch (err) {
            if (throwOnError)
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
/**
 * Represents one subcommand of an application or script.
 */
export class Subcommand {
    constructor(name, handler, description = "No description provided", argOptions = { namedArgs: {}, positionalArgs: [] }, defaultCommand = false) {
        this.name = name;
        this.handler = handler;
        this.description = description;
        this.defaultCommand = defaultCommand;
        //Fill in the provided arg options
        this.argOptions = {
            namedArgs: Object.fromEntries(Object.entries(argOptions.namedArgs ?? {}).map(([key, value]) => [key, {
                    _description: value._description ?? "No description provided",
                    _optional: value._optional,
                    _default: value._default,
                    _valueless: value._valueless,
                    _aliases: value._aliases.concat(Object.entries(argOptions.aliases ?? {}).filter(([from, to]) => from == key).map(([from, to]) => to)),
                }])),
            aliases: Object.fromEntries([
                ...Object.entries(argOptions.aliases ?? []),
                ...Object.entries(argOptions.namedArgs ?? {}).map(([name, opts]) => opts._aliases?.map(alias => [alias, name]) ?? []).flat(),
            ]),
            positionalArgs: (argOptions.positionalArgs ?? []).map((a, i) => ({
                ...a,
                default: a.default ?? null,
                optional: a.default ? ("optional" in a && invalidConfig(`in subcommand ${name}: positional argument ${i} has a default value, therefore it is optional, but "optional" was specified again. Please delete the redundant property.`),
                    true) : a.optional ?? false,
            })) ?? [],
            positionalArgCountCheck: argOptions.positionalArgCountCheck ?? "ignore",
            unexpectedNamedArgCheck: argOptions.unexpectedNamedArgCheck ?? "error",
        };
        //Validating named args is not necessary as the command builder already does that
        //Validate positional args
        let optionalArgsStarted = false;
        for (const arg of this.argOptions.positionalArgs) {
            if (optionalArgsStarted && !arg.optional)
                invalidConfig(`in subcommand ${name}: Required positional arguments, or ones with a default value, cannot follow optional ones.`);
            if (arg.optional)
                optionalArgsStarted = true;
        }
    }
    /** Runs this subcommand. Do not call directly, call the application's run method instead. */
    run(args, application) {
        if (application.sourceDirectory == "null")
            crash("application.sourceDirectory is null. Don't call subcommand.run() directly.");
        const usageInstructionsMessage = application.getOnlyCommand() != null ?
            `for usage instructions, run ${application.name} --help`
            : `for usage instructions, run ${application.name} help ${this.name}`;
        const valuelessOptions = Object.entries(this.argOptions.namedArgs)
            .filter(([k, v]) => v._valueless)
            .map(([k, v]) => v._aliases.concat(k)).flat();
        const { namedArgs, positionalArgs } = Application.parseArgs(args, valuelessOptions);
        //Handle positional args
        if (positionalArgs.length > this.argOptions.positionalArgs.length) {
            //Count check
            const message = `this command expects at most ${this.argOptions.positionalArgs.length} positional arguments, but ${positionalArgs.length} arguments were passed`;
            if (this.argOptions.positionalArgCountCheck == "error")
                throw new ApplicationError(message + `\n` + usageInstructionsMessage);
            else if (this.argOptions.positionalArgCountCheck == "warn")
                console.warn(`Warning: ` + message);
        }
        for (const [i, arg] of this.argOptions.positionalArgs.entries()) {
            if (i >= positionalArgs.length) {
                if (arg.default != null)
                    positionalArgs[i] = arg.default;
                else if (arg.optional)
                    positionalArgs[i] = undefined;
                else
                    throw new ApplicationError(`Missing required positional argument "${arg.name}"
this command expects at least ${this.argOptions.positionalArgs.filter(o => !o.optional).length} positional arguments, but ${positionalArgs.length} arguments were passed
${usageInstructionsMessage}`);
            }
        }
        //Handle named args
        Object.entries(namedArgs).forEach(([name, value]) => {
            const aliased = this.argOptions.aliases[name];
            if (aliased) {
                namedArgs[aliased] ??= value;
                delete namedArgs[name];
            }
        });
        if (this.argOptions.unexpectedNamedArgCheck != "ignore") {
            Object.entries(namedArgs).forEach(([name, value]) => {
                //excess check
                //If the arg is not in the named arguments or the aliases
                if (!(name in this.argOptions.namedArgs || name in this.argOptions.aliases || name == "help" || name == "?")) {
                    const message = `Unexpected argument --${name}${value === null ? "" : `=${value}`}`;
                    if (this.argOptions.unexpectedNamedArgCheck == "warn")
                        console.warn(message);
                    else if (this.argOptions.unexpectedNamedArgCheck == "error")
                        throw new ApplicationError(message + "\n" + usageInstructionsMessage);
                }
            });
        }
        Object.entries(this.argOptions.namedArgs).forEach(([name, opt]) => {
            if (namedArgs[name] == null) { //If the named arg was not specified or was left blank
                if (opt._default != null) { //If it has a default value, set it to that
                    namedArgs[name] = opt._default;
                }
                else if (opt._optional) {
                    if (!opt._valueless) {
                        namedArgs[name] = name in namedArgs ? null : undefined;
                    }
                }
                else
                    throw new ApplicationError(
                    //If it's required, fail with an error
                    `No value specified for required named argument "${name}".
To specify it, run the command with --${name}${opt._valueless ? "" : " <value>"}
${usageInstructionsMessage}`);
            }
            if (opt._valueless) {
                //Convert valueless named args to booleans
                namedArgs[name] = (namedArgs[name] === null);
            }
        });
        return this.handler({
            commandName: this.name,
            positionalArgs,
            namedArgs,
        }, application);
    }
}
