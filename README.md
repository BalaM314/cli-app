# cli-app
A Node.JS framework for creating CLI applications.

```ts
const myApp = new Application("my-app", "Does my-app things.");
myApp.command("version").args({}).impl(() => {
	console.log("my-app version 1.0.0");
});
myApp.command("hello-world")
	.description("does stuff")
	.aliases("hw")
	.args({
		namedArgs: {
			"extra-message": arg().optional()
			"capitalize": arg().valueless().aliases("c")
				.description("If provided, the output will be in all CAPS.")
		}
	}).impl((opts) => {
		if(opts.namedArgs["extra-message"] != null){
			//                ^? (property) "extra-message" string | null | undefined
			console.log(opts.namedArgs["extra-message"]);
		}
		let message = "Hello, world!";
		if(opts.namedArgs.capitalize){
			//              ^? (property) capitalize: boolean
			message = message.toUpperCase();
		}
		console.log(message);
	});
myApp.command("count-lines")
	.description("Reads every file in the specified directory and outputs the total line count.")
	.aliases("cl", "lines")
	.args({
		positionalArgs: [{
			name: "directory",
			default: process.cwd()
		}]
	})
	.impl(async (opts) => {
		const files = await fs.readdirSync("").catch(TODO)
	})
```

`Script` allows you to easily create single-command apps:
```ts
const script = new Script("test-script", "Tests things", (opts, app) => {
  opts.namedarg1;
  //   ^?  string
  opts.namedarg2; //this one is not required
  //   ^?  string | null

}, false, {
  namedArgs: {
    method1: {
      description: "first test method to use",
      required: true
    },
    method2: {
      description: "second method to use",
      aliases: ["m2", "met2"]
    },
    force: {
      description: "if set, testing will be forced",
      needsValue: false,
    },
  },
  aliases: {
    f: "force" //Aliases -f to --force
  },
  positionalArgs: [{
    name: "target",
    description: "test arg",
    //required: false,
  }],
  positionalArgCountCheck: false, //if set, a warning will be printed if more positional args are provided than the application specifies
});

//script.run(["node", `${process.cwd()}${path.sep}index.js`, `cmd1`, `--namedarg1`, `namedvalue1`]);
script.run(process.argv);
```


