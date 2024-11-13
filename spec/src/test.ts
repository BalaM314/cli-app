/* eslint-disable */
import { Application, arg } from "../../build/index.js";



const myApp = new Application("test-app", "A test application for testing cli-app.");
myApp.command("doStuff").description("does stuff").args({
	namedArgs: {
		sus: arg().optional(),
		option: arg().optional(),
	}
}).impl((opts) => {
	if(opts.namedArgs["sus"]){
		process.stdout.write("sussy ");
	}
	if(opts.namedArgs["option"]){
		console.log(`Option: "${opts.namedArgs["option"]}"`);
	}
	console.log("test command");
});
myApp.command("doOtherStuff")
	.description("does other stuff")
	.aliases("alias1", "alias2", "alias3")
	.args({
		namedArgs: {
			required: arg()
				.description("You must specify this")
				.required(),
			optional: arg()
				.description("This is optional")
				.optional(),
			defaultVal: arg()
				.description("this has a default value of SussyAmogus")
				.default("sussyAmogus"),
			noValue: arg()
				.description("this has no value")
				.valueless(),
		},
		aliases: {},
		positionalArgs: []
	})
	.impl((opts, app) => {
		console.log(`named arg required: ${opts.namedArgs["required"]}`);
		console.log(`named arg optional: ${opts.namedArgs["optional"]}`);
		console.log(`named arg defaultVal: ${opts.namedArgs["defaultVal"]}`);
		console.log(`named arg noValue: ${opts.namedArgs["noValue"]} (in operator: ${"noValue" in opts.namedArgs})`);
		console.log(`positional arg required: ${opts.positionalArgs[0]}`);
		console.log(`positional arg defaultVal: ${opts.positionalArgs[1]}`);
		console.log(`positional arg optional: ${opts.positionalArgs[2]}`);
	});
myApp.command("a").description("tests default values for positional args").args({
	positionalArgs: [
		{
			name: "arg1",
			description: "required",
		}
	]
}).impl((opts, app) => {

});
myApp.command("dashdash").description("tests '--'").args({
	namedArgs: {
		sussyBaka: arg().description("sussy baka").default("imposter")
	}
}).impl((opts, app) => {
	console.log(opts.namedArgs.sussyBaka);
	console.log(opts.positionalArgs);
});


myApp.category("subcategory1", "Description for subcategory 1", category => {
	category.command("doStuff").description("does stuff").args({
		namedArgs: {
			sus: arg().valueless(),
			option: arg().optional(),
		}
	}).impl((opts) => {
		if(opts.namedArgs["sus"]){
			process.stdout.write("sussy ");
		}
		if(opts.namedArgs["option"]){
			console.log(`Option: "${opts.namedArgs["option"]}"`);
		}
		console.log("test command");
	});
});

void myApp.run(process.argv);

