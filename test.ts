import { Application } from "./Application.js";


let myApp = new Application("test-app", "A test application for testing cli-app.");
myApp.command("doStuff", "does stuff", (opts) => {
	if(opts.namedArgs["sus"]){
		process.stdout.write("sussy ");
	}
	if(opts.namedArgs["option"]){
		console.log(`Option: "${opts.namedArgs["option"]}"`);
	}
	console.log("test command");
})
.command("doOtherStuff", "does other stuff", (opts, app) => {
	console.log(`Did ${opts.positionalArgs[0]} to ${opts.namedArgs["thing"]}`);

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
	},
	positionalArgs: [
		{
			name: "required",
			description: "You must pass this",
			required: true
		},
		{
			name: "optional",
			description: "This is not required",
			required: false
		}
	]
});


myApp.run(process.argv);
