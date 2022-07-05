import path from "path";
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
    command(name, description, handler, isDefault, optionsoptions) {
        this.commands[name] = new Subcommand(name, handler, description, {
            namedArgs: optionsoptions?.namedArgs ?? {},
            positionalArgs: optionsoptions?.positionalArgs ?? [],
            aliases: optionsoptions?.aliases ?? {}
        }, isDefault);
        return this; //For daisy chaining
    }
    alias(name, target) {
        this.aliases[name] = target;
    }
    runHelpCommand(opts) {
        if (!(this instanceof Application)) {
            throw new ApplicationError("application.runHelpCommand was bound incorrectly. This is most likely an error with cli-app.");
        }
        if (opts.positionalArgs[0]) {
            let command = this.commands[opts.positionalArgs[0]];
            if (command) {
                console.log(`Help for command ${command.name}:

Usage: ${this.name} ${command.name} ${Object.entries(command.optionsoptions.namedArgs)
                    .map(([name, opt]) => opt.required ? `--${name} <${name}> ` : `[--${name} <${name}>] `).join("")}${command.optionsoptions.positionalArgs.map(opt => opt.required ? `<${opt.name}> ` : `[<${opt.name}>] `).join("")}
${Object.entries(command.optionsoptions.namedArgs)
                    .map(([name, opt]) => `${opt.required ? `<${name}>` : `<${name}>`}: ${opt.description}`).join("\n")}
${command.optionsoptions.positionalArgs
                    .map((opt) => `${opt.required ? `<${opt.name}>` : `<${opt.name}>`}: ${opt.description}`).join("\n")}
`);
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
                    parameters[arg.substring(2)] = "null";
                else
                    parameters[arg.substring(2)] = args.splice(0, 1)[0] ?? "null";
            }
            else if (arg.startsWith("-")) {
                if (args[0]?.startsWith("-"))
                    parameters[arg.substring(1)] = "null";
                else
                    parameters[arg.substring(1)] = args.splice(0, 1)[0] ?? "null";
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
    run(args) {
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
            try {
                command.run({
                    namedArgs: {
                        ...Object.fromEntries(Object.entries(parsedArgs.namedArgs)
                            .map(([name, value]) => [command?.optionsoptions.aliases?.[name] ?? name, value]))
                    },
                    positionalArgs: positionalArgs
                }, this);
            }
            catch (err) {
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
    constructor(name, handler, description = "No description provided", optionsoptions = { namedArgs: {}, positionalArgs: [] }, defaultCommand = false) {
        this.name = name;
        this.handler = handler;
        this.description = description;
        this.optionsoptions = optionsoptions;
        this.defaultCommand = defaultCommand;
    }
    run(options, application) {
        if (application.sourceDirectory == "null")
            throw new Error("application.sourceDirectory is null. Don't call subcommand.run() directly.\nThis is an error with cli-app or the application.");
        let requiredNamedArgs = Object.entries(this.optionsoptions.namedArgs)
            .filter(([name, opt]) => opt)
            .filter(([name, opt]) => opt.required);
        let requiredPositionalArgs = this.optionsoptions.positionalArgs
            .filter(arg => arg.required);
        requiredNamedArgs.forEach(([name, opt]) => {
            if (!options.namedArgs[name]) {
                if (opt.default) {
                    options.namedArgs[name] = opt.default;
                }
                else {
                    throw new ApplicationError(`No value specified for required named argument "${name}".`);
                }
            }
        });
        if (requiredPositionalArgs.length > options.positionalArgs.length) {
            throw new ApplicationError(`Missing required positional arguments.\n(default values for positional args are not yet implemented)`);
            //TODO the whole positional args thing needs to be fixed.
        }
        //TODO there are so many issues with checking if args exist.
        this.handler({
            positionalArgs: options.positionalArgs,
            namedArgs: options.namedArgs
        }, application);
    }
}
