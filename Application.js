export class Application {
    constructor(name, description) {
        this.name = name;
        this.description = description;
        this.commands = {};
        this.commands["help"] = new Subcommand("help", this.runHelpCommand.bind(this), "Displays help on all commands or a specific subcommand.", {
            positionalArgs: [{
                    name: "command",
                    description: "The command to get help on.",
                    required: false
                }],
            namedArgs: {}
        });
    }
    command(name, description, handler, isDefault, optionsoptions) {
        this.commands[name] = new Subcommand(name, handler, description, optionsoptions, isDefault);
        return this; //For daisy chaining
    }
    runHelpCommand(opts) {
        if (!(this instanceof Application)) {
            throw new Error("application.runHelpCommand was bound incorrectly. This is most likely an error with cli-app.");
        }
        if (opts.positionalArgs[0]) {
            let command = this.commands[opts.positionalArgs[0]];
            if (command) {
                console.log(`Help for command ${command.name}:

Usage: ${this.name} ${command.name} ${Object.entries(command.optionsoptions.namedArgs)
                    .map(([name, opt]) => opt.required ? `--${name} <${name}> ` : `[--${name} <${name}>] `).join("")} ${command.optionsoptions.positionalArgs.map(opt => opt.required ? `<${opt.name}> ` : `[<${opt.name}>] `).join("")}

${Object.entries(command.optionsoptions.namedArgs)
                    .map(([name, opt]) => `${opt.required ? name : `[${name}]`}: ${opt.description}`).join("\n")}
${command.optionsoptions.positionalArgs
                    .map((opt) => `${opt.required ? opt.name : `[${opt.name}]`}: ${opt.description}`).join("\n")}
`);
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
        if (!providedArgs[0].includes("node")) {
            throw new Error("Attempted to parse invalid args. Unless you are running this application in a strange way, this is likely an error with the application itself.");
        }
        let args = this.splitLineIntoArguments(providedArgs.slice(2).join(" "));
        while (true) {
            i++;
            if (i > 1000) {
                throw new Error("Too many arguments!");
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
        let parsedArgs = Application.parseArgs(args);
        let command;
        if ("help" in parsedArgs.namedArgs) {
            command = this.commands["help"];
        }
        else if (parsedArgs.positionalArgs[0]) {
            command = this.commands[parsedArgs.positionalArgs[0]];
        }
        else {
            command = Object.values(this.commands).filter(command => command?.defaultCommand)[0] ?? this.commands["help"];
        }
        if (command) {
            command.run({
                namedArgs: parsedArgs.namedArgs,
                positionalArgs: parsedArgs.positionalArgs.slice(1)
            }, this);
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
                    throw new Error(`No value specified for required named argument "${name}".`);
                }
            }
        });
        if (requiredPositionalArgs.length > options.positionalArgs.length) {
            throw new Error(`Missing required positional arguments.\n(default values for positional args are not yet implemented)`);
            //TODO the whole positional args thing needs to be fixed.
        }
        //TODO there are so many issues with checking if args exist.
        this.handler({
            positionalArgs: options.positionalArgs,
            namedArgs: options.namedArgs
        }, application);
    }
}
