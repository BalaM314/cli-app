import path from "path";
import { Application, Subcommand } from "./Application.js";
import { ApplicationError, StringBuilder } from "./classes.js";
export class Script {
    constructor(name, description, handler, argOptions) {
        this.aliases = {};
        this.helpCommand = new Subcommand("help", this.runHelpCommand.bind(this), "Displays help on all commands or a specific subcommand.", {
            positionalArgs: [{
                    name: "command",
                    description: "The command to get help on.",
                    required: false
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
    runHelpCommand(opts) {
        const positionalArgsFragment = this.defaultCommand.argOptions.positionalArgs.map(opt => opt.required ? `<${opt.name}>` : `[<${opt.name}>]`).join(" ");
        const namedArgsFragment = Object.entries(this.defaultCommand.argOptions.namedArgs)
            .map(([name, opt]) => opt.required ? `--${name}${opt.needsValue ? ` <${name}>` : ""}` : `[--${name}${opt.needsValue ? ` <${name}>` : ``}]`).join(" ");
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
    run(args, options) {
        this.sourceDirectory = path.join(process.argv[1], "..");
        let parsedArgs = Application.parseArgs(args);
        let command;
        if ("help" in parsedArgs.namedArgs || "?" in parsedArgs.namedArgs) {
            command = this.helpCommand;
        }
        else {
            command = this.defaultCommand;
        }
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
                positionalArgs: parsedArgs.positionalArgs,
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
}
