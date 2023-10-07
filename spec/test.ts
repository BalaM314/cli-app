import { Application, Script } from "../src/index.js";



let myApp = new Application("test-app", "A test application for testing cli-app.");
myApp.command("doStuff", "does stuff", (opts) => {
	if((opts.namedArgs as any)["sus"]){
		process.stdout.write("sussy ");
	}
	if((opts.namedArgs as any)["option"]){
		console.log(`Option: "${(opts.namedArgs as any)["option"]}"`);
	}
	console.log("test command");
})
.command("doOtherStuff", "does other stuff", (opts, app) => {
	console.log(`named arg required: ${opts.namedArgs["required"]}`);
	console.log(`named arg optional: ${opts.namedArgs["optional"]}`);
	console.log(`named arg defaultVal: ${opts.namedArgs["defaultVal"]}`);
	console.log(`named arg noValue: ${opts.namedArgs["noValue"]} (in operator: ${"noValue" in opts.namedArgs})`);
	console.log(`positional arg required: ${opts.positionalArgs[0]}`);
	console.log(`positional arg defaultVal: ${opts.positionalArgs[1]}`);
	console.log(`positional arg optional: ${opts.positionalArgs[2]}`);
}, false, {
	namedArgs: {
		required: {
			description: "You must specify this",
			required: true
		},
		optional: {
			description: "This is optional",
			required: false
		},
		defaultVal: {
			description: "this has a default value of SussyAmogus",
			default: "sussyAmogus"
		},
		noValue: {
			description: "this has no value",
			needsValue: false
		}
	},
	aliases: {
		flarogus: "required"
	},
	positionalArgs: [
		{
			name: "required",
			description: "You must pass this",
			required: true
		},
		{
			name: "default",
			description: "this has a default value of sussyPositionus",
			default: "sussyPositionus"
		},
		{
			name: "optional",
			description: "This is not required",
			required: false
		},
	]
}, ["alias1", "alias2", "alias3"])
.command("a", "tests default values for positional args", (opts, app) => {

}, false, {
	positionalArgs: [
		{
			name: "arg1",
			description: "required",

		}
	]
})
.command("dashdash", "tests '--'", (opts, app) => {
	console.log(opts.namedArgs.sussyBaka);
	console.log(opts.positionalArgs);
}, false, {
	namedArgs: {
		sussyBaka: {
			default: "imposter",
			description: "sussy baka"
		}
	}
});

const script = new Script("test-script", "A testing script", (opts, app) => {
	console.log(opts.namedArgs.named1);
}, {
	namedArgs: {
		named1: {
			required: true,
			description: "test arg",
		}
	}
});

myApp.run(process.argv);
// script.run(process.argv);
