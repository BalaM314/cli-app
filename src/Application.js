import * as path from "path";
import { ApplicationError, StringBuilder } from "./classes.js";
/**
 * Represents an entire application, with multiple subcommands and various functionality.
 */
export class Application {
    constructor(name, description) {
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
                    required: false
                }],
            namedArgs: {}
        });
        this.sourceDirectory = "null";
    }
    /**
     * Adds a subcommand to this application.
     * @param handler The function that is called when this subcommand is run.
     * @param argOptions Specifies the args that can be passed to this subcommand through the command line.
     * @param aliases List of alternative names for this command.
     */
    command(name, description, handler, isDefault, argOptions, aliases) {
        this.commands[name] = new Subcommand(name, handler, description, {
            namedArgs: argOptions?.namedArgs ?? {},
            positionalArgs: argOptions?.positionalArgs ?? [],
            aliases: argOptions?.aliases ?? {}
        }, isDefault);
        if (aliases)
            aliases.forEach((alias) => this.alias(alias, name));
        return this; //For daisy chaining
    }
    /** Creates an alias for a subcommand. */
    alias(alias, target) {
        this.aliases[alias] = target;
        return this;
    }
    /** Runs the help command for this application. Do not call directly. */
    runHelpCommand(opts) {
        if (!(this instanceof Application)) {
            throw new ApplicationError("application.runHelpCommand was bound incorrectly. This is most likely an error with cli-app.");
        }
        if (opts.positionalArgs[0]) {
            let commandName = this.commands[opts.positionalArgs[0]] ? opts.positionalArgs[0] : this.aliases[opts.positionalArgs[0]] ?? opts.positionalArgs[0];
            let command = this.commands[commandName];
            if (command) {
                const aliases = Object.entries(this.aliases).filter(([alias, name]) => name == commandName).map(([alias, name]) => alias);
                const positionalArgsFragment = command.argOptions.positionalArgs.map(opt => opt.required ? `<${opt.name}>` : `[<${opt.name}>]`).join(" ");
                const namedArgsFragment = Object.entries(command.argOptions.namedArgs)
                    .map(([name, opt]) => opt.required ? `--${name}${opt.needsValue ? ` <${name}>` : ``}` : `[--${name}${opt.needsValue ? ` <${name}>` : ``}]`).join(" ");
                const outputText = new StringBuilder()
                    .addLine()
                    .addLine(`Help for command ${command.name}:`)
                    .add(`Usage: ${this.name} ${command.name}`)
                    .addWord(positionalArgsFragment)
                    .addWord(namedArgsFragment)
                    .add("\n")
                    .addLine();
                if (Object.entries(command.argOptions.namedArgs).length != 0) {
                    Object.entries(command.argOptions.namedArgs)
                        .map(([name, opt]) => `<${name}>: ${opt.description}`).forEach(line => outputText.addLine(line));
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
                console.log(`Unknown command ${opts.positionalArgs[0]}. Run ${this.name} help for a list of all commands.`);
            }
        }
        else {
            console.log(`${this.name}: ${this.description}

Usage: ${this.name} [command] [options]
	List of all commands:
`);
            for (let command of Object.values(this.commands)) {
                console.log(`\t${command?.name}: ${command?.description}`);
            }
        }
        return 0;
    }
    static splitLineIntoArguments(line) {
        if (line.includes(`"`)) {
            //aaaaaaaaaaaaaaaaa
            let replacementLine = [];
            let isInString = false;
            for (let char of line) {
                if (char == `"`) {
                    isInString = !isInString;
                }
                if (isInString && char == " ") {
                    replacementLine.push("\u{F4321}");
                }
                else {
                    replacementLine.push(char);
                }
            }
            return replacementLine.join("").split(" ").map(arg => arg.replaceAll("\u{F4321}", " "));
            //smort logic so `"amogus sus"` is parsed as one arg
        }
        else {
            return line.split(" ");
        }
    }
    /**
     * Parses command line arguments into an object.
     * @param providedArgs Pass process.argv without modifying it.
     * @returns Formatted args.
     */
    static parseArgs(providedArgs, valuelessOptions = []) {
        let parameters = {};
        let commands = [];
        let i = 0;
        if (!providedArgs[0]?.includes("node")) {
            throw new ApplicationError("Attempted to parse invalid args. Unless you are running this application in a strange way, this is likely an error with the application.");
        }
        let args = providedArgs.slice(2);
        while (true) {
            i++;
            if (i > 1000)
                throw new ApplicationError("Too many arguments!");
            let arg = args.shift(); //Grab the first arg
            if (arg == undefined)
                break; //If it doesn't exist, return
            if (arg == "--") { //Arg separator
                //Everything else should be considered a positional argument
                commands.push(arg, ...args);
                break;
            }
            else if (arg.match(/^--?([\s\S]+?)=([\s\S]+?)$/)) { //--name=value form
                const [, name, value] = arg.match(/^--?([\s\S]+?)=([\s\S]+?)$/);
                parameters[name] = value;
            }
            else if (arg.match(/^--?([\s\S]+)/)) { //Starts with one or two hyphes
                const argName = arg.match(/^--?([\s\S]+)/)[1];
                if (args[0]?.startsWith("-") || valuelessOptions.includes(argName)) {
                    //If the next arg also starts with a hyphen, or the arg name is valueless, set it to null
                    parameters[argName] = null;
                }
                else {
                    //Otherwise, pop off the first arg and set it to that
                    parameters[argName] = args.shift() ?? null;
                }
            }
            else {
                //It's a positional arg
                commands.push(arg);
            }
        }
        return {
            positionalArgs: commands,
            namedArgs: parameters
        };
    }
    /**
     * Runs an application.
     * @param args Pass process.argv without modifying it.
     * @param options Used for testing.
     */
    run(args, options) {
        this.sourceDirectory = path.join(args[1], "..");
        let parsedArgs = Application.parseArgs(args);
        let command;
        let { positionalArgs } = parsedArgs;
        if ("help" in parsedArgs.namedArgs) {
            command = this.commands["help"];
        }
        else if (this.commands[parsedArgs.positionalArgs[0]]) {
            command = this.commands[parsedArgs.positionalArgs[0]];
            positionalArgs.shift();
        }
        else if (this.aliases[parsedArgs.positionalArgs[0]]) {
            command = this.commands[this.aliases[parsedArgs.positionalArgs[0]]];
            positionalArgs.shift();
        }
        else {
            command = Object.values(this.commands).filter(command => command?.defaultCommand)[0] ?? this.commands["help"];
        }
        if (command) {
            //Loop through each named argument passed
            Object.keys(parsedArgs.namedArgs).forEach(arg => {
                //If the arg is not in the named arguments or the aliases
                if (!(arg in command.argOptions.namedArgs || arg in command.argOptions.aliases || arg == "help" || arg == "?"))
                    //Display a warning
                    console.warn(`Unknown argument ${arg}`);
            });
            try {
                command.run({
                    namedArgs: {
                        ...Object.fromEntries(Object.entries(parsedArgs.namedArgs)
                            .map(([name, value]) => [command?.argOptions.aliases?.[name] ?? name, value]))
                    },
                    positionalArgs: positionalArgs,
                    commandName: command.name
                }, this);
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
        else {
            console.error(`Unknown command: ${parsedArgs.positionalArgs[0]}\nRun "${this.name} help" for a list of all commands.`);
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
            namedArgs: Object.fromEntries(Object.entries(argOptions.namedArgs).map(([key, value]) => [key, {
                    description: value.description ?? "No description provided",
                    required: value.default ? false : value.required ?? false,
                    default: value.default ?? null,
                    needsValue: value.needsValue ?? true
                }])),
            aliases: Object.fromEntries([
                ...Object.entries(argOptions.aliases ?? []),
                ...([].concat(...Object.entries(argOptions.namedArgs).map(([name, opts]) => opts.aliases?.map(alias => [alias, name]) ?? [])))
            ]),
            positionalArgs: argOptions.positionalArgs.map(a => ({
                ...a,
                default: a.default ?? null,
                required: a.default ? false : a.required ?? true,
            })) ?? [],
            positionalArgCountCheck: argOptions.positionalArgCountCheck ?? "ignore"
        };
        //Make sure positional arg options are valid
        let optionalArgsStarted = false;
        for (let arg of this.argOptions.positionalArgs) {
            if (optionalArgsStarted && (arg.required || arg.default))
                throw new Error("Required positional arguments, or ones with a default value, cannot follow optional ones.\nThis is an error with the application.");
            if (!(arg.required || arg.default))
                optionalArgsStarted = true;
        }
    }
    /**
     * Runs this subcommand.
     */
    run(options, application) {
        //TODO put the logic in Application.run and Subcommand.run into one function
        if (application.sourceDirectory == "null")
            throw new Error("application.sourceDirectory is null. Don't call subcommand.run() directly.\nThis is an error with cli-app or the application.");
        const requiredPositionalArgs = this.argOptions.positionalArgs.filter(arg => arg.required);
        const valuedPositionalArgs = this.argOptions.positionalArgs
            .filter(arg => arg.required || arg.default);
        //Handle named args
        Object.entries(this.argOptions.namedArgs).forEach(([name, opt]) => {
            if (!options.namedArgs[name]) { //If the named arg was not specified
                if (opt.default) { //If it has a default value, set it to that
                    options.namedArgs[name] = opt.default;
                }
                else if (opt.required) { //If it's required, throw an error
                    throw new ApplicationError(`No value specified for required named argument "${name}".`);
                }
            }
            else {
                if (!opt.needsValue) {
                    options.namedArgs[name] = options.namedArgs[name] == undefined ? undefined : "true";
                }
            }
        });
        //If not enough args were provided, throw an error
        if (options.positionalArgs.length < requiredPositionalArgs.length) {
            const missingPositionalArgs = requiredPositionalArgs.slice(options.positionalArgs.length).map(arg => arg.name);
            throw new ApplicationError(`Missing required positional argument${missingPositionalArgs.length == 1 ? "" : "s"} "${missingPositionalArgs.join(", ")}"`);
        }
        //If too many args were provided, warn
        if (this.argOptions.positionalArgCountCheck == "warn" && options.positionalArgs.length > this.argOptions.positionalArgs.length) {
            console.warn(`Warning: Too many positional arguments (required ${this.argOptions.positionalArgs.length}, provided ${options.positionalArgs.length})`);
        }
        //Fill in default values for positional args
        if (options.positionalArgs.length < valuedPositionalArgs.length) {
            for (let i = options.positionalArgs.length; i < valuedPositionalArgs.length; i++) {
                if (!valuedPositionalArgs[i].default)
                    throw new ApplicationError(`valuedPositionalArgs[${i}].default is not defined. This is an error with cli-app.`);
                options.positionalArgs[i] = valuedPositionalArgs[i].default;
            }
        }
        this.handler({
            ...options
        }, application);
    }
}
