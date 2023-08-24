# cli-app
A Node.JS framework for creating CLI applications.

Example code:
```ts
const app = new Application("TODO...");
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


