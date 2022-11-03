import path from "path";
import { ApplicationError, StringBuilder } from "./classes.js";
export class Application {
    constructor(name, description) {
        this.name = name;
        this.description = description;
        this.commands = {};
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
    alias(name, target) {
        this.aliases[name] = target;
        return this;
    }
    runHelpCommand(opts) {
        if (!(this instanceof Application)) {
            throw new ApplicationError("application.runHelpCommand was bound incorrectly. This is most likely an error with cli-app.");
        }
        if (opts.positionalArgs[0]) {
            let commandName = this.commands[opts.positionalArgs[0]] ? opts.positionalArgs[0] : this.aliases[opts.positionalArgs[0]] ?? opts.positionalArgs[0];
            let command = this.commands[commandName];
            if (command) {
                const aliases = Object.entries(this.aliases).filter(([alias, name]) => name == commandName).map(([alias, name]) => alias);
                const positionalArgsFragment = command.argOptions.positionalArgs.map(opt => opt.required ? `<${opt.name}> ` : `[<${opt.name}>] `).join("");
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
    static parseArgs(providedArgs) {
        let parameters = {};
        let commands = [];
        let i = 0;
        if (!providedArgs[0]?.includes("node")) {
            throw new ApplicationError("Attempted to parse invalid args. Unless you are running this application in a strange way, this is likely an error with the application itself.");
        }
        let args = providedArgs.slice(2);
        while (true) {
            i++;
            if (i > 1000) {
                throw new ApplicationError("Too many arguments!");
            }
            let arg = args.splice(0, 1)[0];
            if (arg == undefined)
                break;
            if (arg.startsWith("--")) {
                if (args[0]?.startsWith("-"))
                    parameters[arg.substring(2)] = null;
                else
                    parameters[arg.substring(2)] = args.splice(0, 1)[0] ?? null;
            }
            else if (arg.startsWith("-")) {
                if (args[0]?.startsWith("-"))
                    parameters[arg.substring(1)] = null;
                else
                    parameters[arg.substring(1)] = args.splice(0, 1)[0] ?? null;
            }
            else {
                commands.push(arg);
            }
        }
        return {
            positionalArgs: commands,
            namedArgs: parameters
        };
    }
    run(args, options) {
        this.sourceDirectory = path.join(process.argv[1], "..");
        let parsedArgs = Application.parseArgs(args);
        let command;
        let { positionalArgs } = parsedArgs;
        if ("help" in parsedArgs.namedArgs) {
            command = this.commands["help"];
        }
        else if (this.commands[parsedArgs.positionalArgs[0]]) {
            command = this.commands[parsedArgs.positionalArgs[0]];
            positionalArgs.splice(0, 1);
        }
        else if (this.aliases[parsedArgs.positionalArgs[0]]) {
            command = this.commands[this.aliases[parsedArgs.positionalArgs[0]]];
            positionalArgs.splice(0, 1);
        }
        else {
            command = Object.values(this.commands).filter(command => command?.defaultCommand)[0] ?? this.commands["help"];
        }
        if (command) {
            //Loop through each named argument passed
            Object.keys(parsedArgs.namedArgs).forEach(arg => 
            //If the arg is not in the named arguments or the aliases
            (arg in command.argOptions.namedArgs || arg in (command.argOptions.aliases ?? {})) ? "" :
                //Display a warning
                console.warn(`Unknown argument ${arg}`));
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
export class Subcommand {
    constructor(name, handler, description = "No description provided", argOptions = { namedArgs: {}, positionalArgs: [] }, defaultCommand = false) {
        this.name = name;
        this.handler = handler;
        this.description = description;
        this.defaultCommand = defaultCommand;
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
            })) ?? []
        };
        //Validate positional args
        let optionalArgsStarted = false;
        for (let arg of this.argOptions.positionalArgs) {
            if (optionalArgsStarted && (arg.required || arg.default))
                throw new Error("Required positional arguments, or ones with a default value, cannot follow optional ones.\nThis is an error with the application.");
            if (!(arg.required || arg.default))
                optionalArgsStarted = true;
        }
    }
    run(options, application) {
        if (application.sourceDirectory == "null")
            throw new Error("application.sourceDirectory is null. Don't call subcommand.run() directly.\nThis is an error with cli-app or the application.");
        const requiredPositionalArgs = this.argOptions.positionalArgs.filter(arg => arg.required);
        const valuedPositionalArgs = this.argOptions.positionalArgs
            .filter(arg => arg.required || arg.default);
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
        if (options.positionalArgs.length < requiredPositionalArgs.length) {
            const missingPositionalArgs = requiredPositionalArgs.slice(options.positionalArgs.length).map(arg => arg.name);
            throw new ApplicationError(`Missing required positional argument${missingPositionalArgs.length == 1 ? "" : "s"} "${missingPositionalArgs.join(", ")}"`);
        }
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
