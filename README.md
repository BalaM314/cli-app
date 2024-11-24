# cli-app
A framework for creating TypeScript or JavaScript CLI applications.

## Feature list
* Type safety
	* Uses the builder pattern
	* Arguments passed to the handler will be typed as `string`, `string | null | undefined`, `boolean`, or `true` depending on the argument configuration
* JSDoc comments
* Named arguments (passed with `--name value`)
	* Optional named arguments
	* Valueless named arguments (`--name`, without a value)
	* Aliases for argument names
	* Supports `--name=value`
	* Specifying single-character options together, like `app -xzvf value_for_f`
* Positional arguments (passed with `value`)
	* Optional and required positional arguments
* Automatic generation of help commands
	* `app help command` or `app command --help`
* Subcommands
	* Aliases for subcommand names
	* Default subcommands
	* Apps with only one subcommand
* Categories (such as `gh repo clone`)
* Test support
	* the App.run() method can be configured to reject instead of printing an error message

## Examples

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
			"extra-message": arg().optional(),
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
	.impl(async ({positionalArgs}) => {
		const files = await fs.readdir(positionalArgs[0])
			.catch(() => fail(`Directory ${positionalArgs[0]} does not exist or is not accessible.`), 1);
		console.log(`Counting lines in ${files.length} files...`);
		const fileData = await Promise.all(files.map(file =>
			fs.readFile(file, "utf-8")
				.catch(() => fail(`Failed to read file ${file}`), 2)
		));
		const lines = fileData.map(file => file.split(/\r?\n/).length);
		const totalLines = lines.reduce((a, b) => a + b);
		console.log(`Total lines: ${totalLines}`);
	});

myApp.run(process.argv);
```

```sh
$ my-app help
my-app: Does my-app things.

Usage: my-app [subcommand] [options]
        List of all subcommands:

        help: Displays help on all subcommands or a specific subcommand.
        version: No description provided.
        hello-world: does stuff
        count-lines: Reads every file in the specified directory and outputs the total line count.
        hw: Alias for hello-world
        cl: Alias for count-lines
        lines: Alias for count-lines

$ my-app version
my-app version 1.0.0
$ my-app version --prop
Error: unexpected argument --prop
for usage instructions, run my-app help version
$ my-app help version
Help for command version:
Usage: my-app version
$ my-app hello-world
Hello, world!
$ my-app hello-world --capitalize
HELLO, WORLD!
$ my-app hw -c
HELLO, WORLD!
$ my-app count-lines
Counting lines in 5 files:
Failed to read file missing-permissions.txt
$ echo $?
2
```

To create single-command apps:

```ts
const myApp = new Application("my-app", "Does my-app things.");
myApp.onlyCommand().args({}).impl(() => {
	console.log("Handler run");
});
```
```sh
$ my-app
Handler run
$ my-app --help
Help for command my-app:
Does my-app things.
Usage: my-app
```

Large numbers of subcommands can be organized into categories:
```ts
const myApp = new Application("my-app", "Does my-app things.");
myApp.category("cat1", cat => {
	cat.command("cmd1").args({}).impl(() => {
		console.log("running cmd1");
	});
	cat.command("cmd2").args({}).impl(() => {
		console.log("running cmd2");
	});
});
```
```sh
$ my-app cat1 cmd1
running cmd1
$ my-app cat1 cmd2
running cmd2
```




