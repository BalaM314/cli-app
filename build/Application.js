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
import { crash, fail, invalidConfig } from "./funcs.js";
/** Helper function to define a named argument. Uses the builder pattern. */
export const arg = (() => {
    const ArgBuilderPrototype = {
        description(description) {
            return { ...this, "~description": description, __proto__: ArgBuilderPrototype };
        },
        optional() {
            return { ...this, "~optional": true, __proto__: ArgBuilderPrototype };
        },
        required() {
            return { ...this, "~optional": false, __proto__: ArgBuilderPrototype };
        },
        valueless() {
            //Assertion: the required() function is still on the prototype chain
            return { ...this, "~valueless": true, "~optional": true, __proto__: ArgBuilderPrototype };
        },
        default(value) {
            return { ...this, "~default": value, "~optional": true, __proto__: ArgBuilderPrototype };
        },
        aliases(...aliases) {
            return { ...this, "~aliases": aliases, __proto__: ArgBuilderPrototype };
        },
    };
    return () => ({
        __proto__: ArgBuilderPrototype,
        "~default": undefined,
        "~description": undefined,
        "~optional": false,
        "~valueless": false,
        "~aliases": [],
    });
})();
//#endregion
//#region Main logic
/**
 * Represents an entire application, with multiple subcommands and various functionality.
 */
export class Application {
    constructor(
    /** The name used to run this application. Will be used in error suggestions. */
    name, 
    /** A description for this application. Will be used in help messages. */
    description) {
        this.name = name;
        this.description = description;
        /** Stores all subcommands. */
        this.commands = {};
        /** Stores all command aliases. */
        this.aliases = {};
        this.currentRunOptions = null;
        const helpCommand = new Subcommand("help", this.runHelpCommand.bind(this), "Displays help information about all subcommands or a specific subcommand.", {
            positionalArgs: [{
                    name: "subcommand",
                    description: "The subcommand to get information about.",
                    optional: true
                }],
            namedArgs: {},
            positionalArgCountCheck: "ignore",
            unexpectedNamedArgCheck: "warn",
        });
        this.commands["help"] = helpCommand;
        this.defaultSubcommand = helpCommand;
        this.sourceDirectory = "null";
    }
    command(name, description) {
        const app = this;
        const CommandBuilderPrototype = {
            description(description) {
                return { ...this, "~description": description, __proto__: CommandBuilderPrototype };
            },
            aliases(...aliases) {
                return { ...this, "~aliases": aliases, __proto__: CommandBuilderPrototype };
            },
            default() {
                return { ...this, "~default": true, __proto__: CommandBuilderPrototype };
            },
            args(argOptions) {
                return {
                    ...this,
                    impl(impl) {
                        if (app.commands[name])
                            invalidConfig(`Cannot register a subcommand with name "${name}" because there is already a subcommand with that name`);
                        const subcommand = new Subcommand(this["~name"], impl, this["~description"], argOptions, this["~default"]);
                        app.commands[name] = subcommand;
                        if (this["~default"])
                            app.defaultSubcommand = subcommand;
                        this["~aliases"].forEach(alias => app.aliases[alias] = name);
                    }
                };
            },
        };
        const builder = {
            __proto__: CommandBuilderPrototype,
            "~name": name,
            "~default": false,
            "~description": description,
            "~aliases": [],
        };
        return builder;
    }
    /**
     * Same as {@link command()}, but for applications with only one subcommand.
     *
     * The name and description will be the same as the application's name and description, and the command will be set as default.
     *
     * This will slightly change the display of help messages, to make them more applicable for an application with only one subcommand.
     *
     * Example usage:
     * ```
     * myApp.onlyCommand()
     * 	.args({
     * 		namedArgs: {
     * 			arg1: arg(),
     * 		}
     * 	})
     * 	.impl((args) => {
     * 		console.log(`Hello ${args.arg1}`);
     * 	})
     * ```
     *
     * Without onlyCommand:
     * ```sh
     * $ my-app help
     * my-app: Description for my-app
     * Usage: my-app [subcommand] [options]
     * 	List of all subcommands:
     *
     * 	my-app: Description for my-app
     * $ my-app help my-app
     * Help for subcommand my-app:
     * Description for my-app
     * Usage: my-app my-app [--arg <arg>]
     *
     * <arg>: No description provided
     * ```
     * This is confusing.
     *
     * With onlyCommand:
     * ```sh
     * $ my-app help
     * Help for command my-app:
     * Description for my-app.
     * Usage: my-app [--arg <arg>]
     *
     * <arg>: No description provided
     * ```
     */
    onlyCommand() {
        if (Object.keys(this.commands).length > 1)
            invalidConfig(`onlyCommand() is not valid here: there are already other commands defined`);
        return this.command(this.name, this.description).default().aliases();
    }
    /**
     * Creates a new category of commands, which can be invoked by passing the category name before the command name.
     *
     * Example usage:
     * ```
     * myApp.category("category1", "For category1 related commands.", cat => {
     * 	cat.command("subcommand1")
     * 		.description("Does subcommand1 things.")
     * 		.args({})
     * 		.impl(() => {});
     * 	cat.command("subcommand2")
     * 		.description("Does subcommand2 things.")
     * 		.args({})
     * 		.impl(() => {});
     * });
     * ```
     * At the command line:
     * - `myApp category1 subcommand1`
     * - `myApp category1 --help`
     * - `myApp help category1`
     * - `myApp category1 help subcommand2`
     */
    category(name, description, callback) {
        const category = new Application(`${this.name} ${name}`, description);
        this.command(name).description(description).args({
            unexpectedNamedArgCheck: "ignore",
            positionalArgCountCheck: "ignore",
            allowHelpNamedArg: false,
        }).impl((opts, app) => {
            return category.run(opts.nodeArgs.concat(opts.unparsedArgs), this.currentRunOptions);
        });
        this.commands[name].subcategoryApp = category;
        callback(category);
        return this;
    }
    /** Creates an alias for a subcommand. */
    alias(alias, target) {
        this.aliases[alias] = target;
        return this;
    }
    /** Returns the name of this application's only command, if it exists. If there are zero or multiple commands, returns undefined. */
    getOnlyCommand() {
        const commands = Object.entries(this.commands).filter(([name, command]) => name != "help");
        if (commands.length == 1) {
            const [name, command] = commands[0];
            if (name == this.name)
                return name;
        }
        return undefined;
    }
    /** Runs the help command for this application. Do not call directly. */
    runHelpCommand(opts) {
        const firstPositionalArg = opts.positionalArgs[0] ?? this.getOnlyCommand();
        if (firstPositionalArg) {
            const commandName = this.commands[firstPositionalArg] ? firstPositionalArg : this.aliases[firstPositionalArg] ?? firstPositionalArg;
            const command = this.commands[commandName];
            if (command) {
                if (command.subcategoryApp) {
                    return command.subcategoryApp.runHelpCommand({
                        commandName: "help",
                        namedArgs: opts.namedArgs,
                        nodeArgs: opts.nodeArgs,
                        unparsedArgs: opts.unparsedArgs,
                        positionalArgs: opts.positionalArgs.slice(1),
                    });
                }
                const aliases = Object.entries(this.aliases).filter(([alias, name]) => name == commandName).map(([alias, name]) => alias);
                const positionalArgsFragment = command.argOptions.positionalArgs.map(opt => opt.optional ? `[<${opt.name}>]` : `<${opt.name}>`).join(" ");
                const namedArgsFragment = Object.entries(command.argOptions.namedArgs)
                    .map(([name, opt]) => opt["~optional"] ?
                    `[--${name}${opt["~valueless"] ? `` : ` <${name}>`}]`
                    : `--${name}${opt["~valueless"] ? `` : ` <${name}>`}`).join(" ");
                const outputText = new StringBuilder()
                    .addLine()
                    .addLine(`Help for ${this.getOnlyCommand() ? "command" : "subcommand"} ${command.name}:`)
                    .addLine(command.description)
                    .add((this.name == command.name && command.defaultCommand) ? `Usage: ${this.name}` : `Usage: ${this.name} ${command.name}`)
                    .addWord(positionalArgsFragment)
                    .addWord(namedArgsFragment)
                    .addLine()
                    .addLine();
                if (Object.entries(command.argOptions.namedArgs).length != 0) {
                    Object.entries(command.argOptions.namedArgs)
                        .map(([name, opt]) => opt["~description"] ? `<${name}>: ${opt["~description"]}` : `<${name}>`).forEach(line => outputText.addLine(line));
                    outputText.addLine();
                }
                if (command.argOptions.positionalArgs.length != 0) {
                    command.argOptions.positionalArgs
                        .map((opt) => opt.description ? `<${opt.name}>: ${opt.description}` : `<${opt.name}>`).forEach(line => outputText.addLine(line));
                    outputText.addLine();
                }
                outputText.addLine(aliases.length != 0, `Aliases: ${aliases.join(", ")}`);
                process.stdout.write(outputText.text());
            }
            else {
                console.log(`Unknown subcommand ${firstPositionalArg}. Run ${this.name} help for a list of all commands.`);
            }
        }
        else {
            console.log(`${this.name}: ${this.description}

Usage: ${this.name} [subcommand] [options]
	List of all subcommands:
`);
            for (const command of Object.values(this.commands)) {
                console.log(`\t${command.name}: ${command.description ?? "No description provided."}`);
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
     * @param valuelessOptions List of named arguments that do not have a corresponding value.
     *
     * If an argument follows one of these named arguments, it will be interpreted as a positional argument.
     *
     * Example: `--arg1 value1` will normally be parsed as `{arg1: "value1"}`,
     *
     * but if valuelessOptions includes arg1, then it will be parsed as `{arg1: true}, ["value1"]`
     * @returns Formatted args.
     */
    static parseArgs(providedArgs, valuelessOptions = []) {
        const __nameEqualsValue = /^--([\s\S]+?)=([\s\S]*?)$/;
        const __name = /^--([\s\S]+)/;
        const _name = /^-(\w+)/;
        const namedArgs = {};
        const positionalArgs = [];
        const args = providedArgs.slice();
        let firstPositionalArg = undefined;
        for (let i = 1;; i++) {
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
    async run(rawArgs, runOptions = {}) {
        //This function does as little work as possible, and calls Subcommand.run()
        if (rawArgs.length < 2)
            crash(`Application.run() received invalid argv: process.argv should start with "node path/to/filename.js"`);
        const nodeArgs = rawArgs.slice(0, 2);
        const { setProcessExitCodeOnHandlerReturn = true, throwOnError = false, } = runOptions;
        this.currentRunOptions = runOptions;
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
        let [newArgs, command] = (() => {
            if (firstPositionalArg && this.commands[firstPositionalArg]) {
                return [args.slice(1), this.commands[firstPositionalArg]];
            }
            else if (firstPositionalArg && this.aliases[firstPositionalArg]) {
                return [args.slice(1), this.commands[this.aliases[firstPositionalArg]]
                        ?? invalidConfig(`Subcommand "${firstPositionalArg}" was aliased to ${this.aliases[firstPositionalArg]}, which is not a valid subcommand`)];
            }
            else
                return [args, this.defaultSubcommand];
        })();
        if (command.argOptions.allowHelpNamedArg) {
            if ("help" in namedArgs || "?" in namedArgs) {
                command = this.commands["help"];
                //Revert removal of the first arg, the help command needs that
                newArgs = args;
            }
        }
        try {
            const result = await command.run(newArgs, nodeArgs, this);
            if (typeof result == "number") {
                if (setProcessExitCodeOnHandlerReturn)
                    process.exitCode = result;
                else if (result != 0)
                    throw new Error(`Non-zero exit code: ${result}`);
            }
        }
        catch (err) {
            if (throwOnError)
                throw err;
            if (err instanceof ApplicationError) {
                console.error(`Error: ${err.message}`);
                if (setProcessExitCodeOnHandlerReturn)
                    process.exitCode = err.exitCode;
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
    constructor(name, handler, //use any to avoid contravariance
    description, argOptions = { namedArgs: {}, positionalArgs: [] }, defaultCommand = false) {
        this.name = name;
        this.handler = handler;
        this.description = description;
        this.defaultCommand = defaultCommand;
        /**
         * Set to an {@link Application} if this subcommand is a category.
         */
        this.subcategoryApp = null;
        //Fill in the provided arg options
        this.argOptions = {
            namedArgs: Object.fromEntries(Object.entries(argOptions.namedArgs ?? {}).map(([key, value]) => [key, {
                    "~description": value["~description"] ?? "No description provided",
                    "~optional": value["~optional"],
                    "~default": value["~default"],
                    "~valueless": value["~valueless"],
                    "~aliases": value["~aliases"].concat(Object.entries(argOptions.aliases ?? {}).filter(([from, to]) => from == key).map(([from, to]) => to)),
                }])),
            aliases: Object.fromEntries([
                ...Object.entries(argOptions.aliases ?? []),
                ...Object.entries(argOptions.namedArgs ?? {}).map(([name, opts]) => opts["~aliases"]?.map(alias => [alias, name]) ?? []).flat(),
            ]),
            positionalArgs: (argOptions.positionalArgs ?? []).map((a, i) => ({
                ...a,
                default: a.default ?? null,
                optional: a.default ? ("optional" in a && invalidConfig(`in subcommand ${name}: positional argument ${i} has a default value, therefore it is optional, but "optional" was specified again. Please delete the redundant property.`),
                    true) : a.optional ?? false,
            })) ?? [],
            positionalArgCountCheck: argOptions.positionalArgCountCheck ?? "ignore",
            unexpectedNamedArgCheck: argOptions.unexpectedNamedArgCheck ?? "error",
            allowHelpNamedArg: argOptions.allowHelpNamedArg ?? true,
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
    run(args, nodeArgs, application) {
        if (application.sourceDirectory == "null")
            crash("application.sourceDirectory is null. Don't call subcommand.run() directly.");
        const usageInstructionsMessage = application.getOnlyCommand() != null ?
            `for usage instructions, run ${application.name} --help`
            : `for usage instructions, run ${application.name} help ${this.name}`;
        const valuelessOptions = Object.entries(this.argOptions.namedArgs)
            .filter(([k, v]) => v["~valueless"])
            .map(([k, v]) => v["~aliases"].concat(k)).flat();
        const { namedArgs, positionalArgs } = Application.parseArgs(args, valuelessOptions);
        //Handle positional args
        if (positionalArgs.length > this.argOptions.positionalArgs.length) {
            //Count check
            const message = `this subcommand expects at most ${this.argOptions.positionalArgs.length} positional arguments, but ${positionalArgs.length} arguments were passed`;
            if (this.argOptions.positionalArgCountCheck == "error")
                fail(message + `\n` + usageInstructionsMessage);
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
                    fail(`Missing required positional argument "${arg.name}"
this subcommand expects at least ${this.argOptions.positionalArgs.filter(o => !o.optional).length} positional arguments, but ${positionalArgs.length} arguments were passed
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
                        fail(message + "\n" + usageInstructionsMessage);
                }
            });
        }
        Object.entries(this.argOptions.namedArgs).forEach(([name, opt]) => {
            if (namedArgs[name] == null) { //If the named arg was not specified or was left blank
                if (opt["~default"] != null) { //If it has a default value, set it to that
                    namedArgs[name] = opt["~default"];
                }
                else if (opt["~optional"]) {
                    if (!opt["~valueless"]) {
                        namedArgs[name] = name in namedArgs ? null : undefined;
                    }
                }
                else
                    fail(
                    //If it's required, fail with an error
                    `No value specified for required named argument "${name}".
To specify it, run the command with --${name}${opt["~valueless"] ? "" : " <value>"}
${usageInstructionsMessage}`);
            }
            if (opt["~valueless"]) {
                //Convert valueless named args to booleans
                namedArgs[name] = (namedArgs[name] === null);
            }
        });
        return this.handler({
            commandName: this.name,
            positionalArgs: positionalArgs,
            namedArgs,
            unparsedArgs: args,
            nodeArgs,
        }, application);
    }
}
//#endregion
