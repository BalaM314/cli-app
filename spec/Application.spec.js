import path from "path";
import { Application } from "../src/Application.js";
import { ApplicationError } from "../src/classes.js";
describe("Application", () => {
    it("should run an application without crashing", () => {
        const app = new Application("test-app", "Autogenerated test app");
        app.command("cmd1", "test command", () => { });
        spyOn(app.commands["cmd1"], "handler").and.callThrough();
        app.run(["node", `${process.cwd()}${path.sep}index.js`, `cmd1`], { throwOnError: true });
        expect(app.commands["cmd1"].handler).toHaveBeenCalled();
    });
    it("should accept named arguments", () => {
        const app = new Application("test-app", "Autogenerated test app");
        app.command("cmd1", "test command", (opts, app) => {
            expect(opts.namedArgs["namedarg1"]).toEqual("namedvalue1");
            expect(opts.namedArgs["namedarg2"]).toEqual(undefined);
        }, false, {
            namedArgs: {
                namedarg1: {
                    description: "test arg",
                    required: true
                },
                namedarg2: {
                    description: "test arg"
                },
            }
        });
        spyOn(app.commands["cmd1"], "handler").and.callThrough();
        app.run(["node", `${process.cwd()}${path.sep}index.js`, `cmd1`, `--namedarg1`, `namedvalue1`], { throwOnError: true });
        expect(app.commands["cmd1"].handler).toHaveBeenCalled();
    });
    it("should accept positional arguments", () => {
        const app = new Application("test-app", "Autogenerated test app");
        app.command("cmd1", "test command", (opts, app) => {
            expect(opts.positionalArgs[0]).toEqual("namedvalue1");
            expect(opts.positionalArgs[1]).toEqual(undefined);
        }, false, {
            positionalArgs: [
                {
                    name: "arg1",
                    description: "test arg",
                },
                {
                    name: "arg2",
                    description: "test arg",
                    required: false
                },
            ]
        });
        spyOn(app.commands["cmd1"], "handler").and.callThrough();
        app.run(["node", `${process.cwd()}${path.sep}index.js`, `cmd1`, `namedvalue1`], { throwOnError: true });
        expect(app.commands["cmd1"].handler).toHaveBeenCalled();
    });
    it("should fail if a required named argument is not passed", () => {
        const app = new Application("test-app", "Autogenerated test app");
        app.command("cmd1", "test command", (opts, app) => {
        }, false, {
            namedArgs: {
                namedarg1: {
                    description: "test arg",
                    required: true
                },
            }
        });
        expect(() => {
            app.run(["node", `${process.cwd()}${path.sep}index.js`, `cmd1`], { throwOnError: true });
        }).toThrowMatching((err) => err instanceof ApplicationError && err.message.includes("required named arg"));
    });
    it("should fail if a required positional argument is not passed", () => {
        const app = new Application("test-app", "Autogenerated test app");
        app.command("cmd1", "test command", (opts, app) => {
        }, false, {
            positionalArgs: [
                {
                    name: "positionalArg1",
                    description: "test arg"
                },
            ]
        });
        expect(() => {
            app.run(["node", `${process.cwd()}${path.sep}index.js`, `cmd1`], { throwOnError: true });
        }).toThrowMatching((err) => err instanceof ApplicationError && err.message.includes("required positional arg"));
    });
    it("should fill in default values for named arguments", () => {
        const app = new Application("test-app", "Autogenerated test app");
        app.command("cmd1", "test command", (opts, app) => {
            expect(opts.namedArgs["optional1"]).toEqual("defaultValue1");
            expect(opts.namedArgs["optional2"]).toEqual("defaultValue2");
        }, false, {
            namedArgs: {
                optional1: {
                    description: "test arg",
                    default: "defaultValue1"
                },
                optional2: {
                    description: "test arg",
                    default: "defaultValue2"
                },
            }
        });
        spyOn(app.commands["cmd1"], "handler").and.callThrough();
        app.run(["node", `${process.cwd()}${path.sep}index.js`, `cmd1`, `--optional2`], { throwOnError: true });
        expect(app.commands["cmd1"].handler).toHaveBeenCalled();
    });
    it("should fill in default values for positional arguments", () => {
        const app = new Application("test-app", "Autogenerated test app");
        app.command("cmd1", "test command", (opts, app) => {
            expect(opts.positionalArgs[0]).toEqual("value1");
            expect(opts.positionalArgs[1]).toEqual("defaultValue2");
        }, false, {
            positionalArgs: [
                {
                    name: "arg1",
                    description: "test arg"
                },
                {
                    name: "arg2",
                    description: "test arg",
                    default: "defaultValue2"
                },
            ]
        });
        spyOn(app.commands["cmd1"], "handler").and.callThrough();
        app.run(["node", `${process.cwd()}${path.sep}index.js`, `cmd1`, `value1`], { throwOnError: true });
        expect(app.commands["cmd1"].handler).toHaveBeenCalled();
    });
    it("should not allow required positional arguments to follow optional ones", () => {
        const app = new Application("test-app", "Autogenerated test app");
        expect(() => {
            app.command("cmd1", "test command", (opts, app) => {
                expect(opts.positionalArgs[0]).toEqual("value1");
                expect(opts.positionalArgs[1]).toEqual("defaultValue2");
            }, false, {
                positionalArgs: [
                    {
                        name: "arg1",
                        description: "test arg",
                        required: false
                    },
                    {
                        name: "arg2",
                        description: "test arg",
                        default: "defaultValue2"
                    },
                ]
            });
        }).toThrowMatching((err) => !(err instanceof ApplicationError) && err.message.includes("cannot follow optional ones"));
    });
    it("should run a command through aliases", () => {
        const app = new Application("test-app", "Autogenerated test app");
        app.command("cmd1", "test command", () => { }, false, {}, ["alias1"]);
        spyOn(app.commands["cmd1"], "handler").and.callThrough();
        app.run(["node", `${process.cwd()}${path.sep}index.js`, `alias1`], { throwOnError: true });
        expect(app.commands["cmd1"].handler).toHaveBeenCalled();
    });
    it("should accept aliases for named arguments", () => {
        const app = new Application("test-app", "Autogenerated test app");
        app.command("cmd1", "test command", (opts, app) => {
            expect(opts.namedArgs["namedarg1"]).toEqual("namedvalue1");
            expect(opts.namedArgs["namedarg2"]).toEqual("namedvalue2");
        }, false, {
            namedArgs: {
                namedarg1: {
                    description: "test arg",
                    aliases: ["alias1"]
                },
                namedarg2: {
                    description: "test arg"
                },
            },
            aliases: {
                alias2: "namedarg2"
            }
        });
        spyOn(app.commands["cmd1"], "handler").and.callThrough();
        app.run(["node", `${process.cwd()}${path.sep}index.js`, `cmd1`, `--alias1`, `namedvalue1`, `--alias2`, `namedvalue2`], { throwOnError: true });
        expect(app.commands["cmd1"].handler).toHaveBeenCalled();
    });
});
describe("Application.parseArgs", () => {
    function runWith(args, programName = "sus.js") {
        return ["node", programName, ...args];
    }
    it("should crash on no args", () => {
        expect(() => Application.parseArgs([])).toThrow();
    });
    it("should return empty args if application run with no args", () => {
        expect(Application.parseArgs(runWith([]))).toEqual({
            namedArgs: {},
            positionalArgs: [],
        });
    });
    it("should parse positional args", () => {
        expect(Application.parseArgs(runWith(["sussy", "baka"]))).toEqual({
            namedArgs: {},
            positionalArgs: ["sussy", "baka"],
        });
    });
    it("should parse named args", () => {
        expect(Application.parseArgs(runWith(["--sussy", "baka", "--amogus", "sus"]))).toEqual({
            namedArgs: {
                sussy: "baka",
                amogus: "sus",
            },
            positionalArgs: [],
        });
    });
    it("should parse named args of the form --name=value", () => {
        expect(Application.parseArgs(runWith(["--sussy", "baka", "--amogus=sus"]))).toEqual({
            namedArgs: {
                sussy: "baka",
                amogus: "sus",
            },
            positionalArgs: [],
        });
    });
    it("should set named args to null if a value is not specified", () => {
        expect(Application.parseArgs(runWith(["--sussy", "baka", "--amogus", "--amoma"]))).toEqual({
            namedArgs: {
                sussy: "baka",
                amogus: null,
                amoma: null,
            },
            positionalArgs: [],
        });
    });
    it("should parse named args and positional args", () => {
        expect(Application.parseArgs(runWith(["sus", "--sussy", "baka", "amogus", "--amoma"]))).toEqual({
            namedArgs: {
                sussy: "baka",
                amoma: null,
            },
            positionalArgs: ["sus", "amogus"],
        });
    });
    it("should correctly handle valuelessOptions", () => {
        expect(Application.parseArgs(runWith(["--sus", "--sussy", "baka", "--amogus", "amoma"]), ["sussy"])).toEqual({
            namedArgs: {
                sus: null,
                sussy: null,
                amogus: "amoma",
            },
            positionalArgs: ["baka"],
        });
    });
    it("should accept named arguments with one hyphen", () => {
        expect(Application.parseArgs(runWith(["-s", "baka", "-amogus", "sus"]))).toEqual({
            namedArgs: {
                s: "baka",
                amogus: "sus",
            },
            positionalArgs: [],
        });
    });
    it("should handle the -- arg separator", () => {
        expect(Application.parseArgs(runWith(["pos", "-s", "baka", "--", "sus", "--amogus"]))).toEqual({
            namedArgs: {
                s: "baka",
            },
            positionalArgs: ["pos", "--", "sus", "--amogus"],
        });
    });
    it("should do all of the above", () => {
        expect(Application.parseArgs(runWith(["p1", "--n1", "v1", "p2", "p3", "-n2", "p4", "--n-3", "v-2", "--n4", "--n5", "v3", "p5"]), ["sussy", "n2"])).toEqual({
            namedArgs: {
                n1: "v1",
                n2: null,
                "n-3": "v-2",
                n4: null,
                n5: "v3",
            },
            positionalArgs: ["p1", "p2", "p3", "p4", "p5"],
        });
    });
});
