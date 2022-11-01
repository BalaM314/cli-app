export class ApplicationError extends Error {
    constructor(message) {
        super(message);
        this.name = "ApplicationError";
    }
}
/**Useful for building very long strings. */
export class StringBuilder {
    constructor() {
        this.buffer = "";
        return this;
    }
    add(arg1, arg2) {
        if (typeof arg1 == "string") {
            this.buffer += arg1;
        }
        else if (arg1) {
            this.buffer += arg2;
        }
        return this;
    }
    addWord(arg1, arg2) {
        if (typeof arg1 == "string" && arg1.length != 0) {
            this.buffer += " ";
            this.buffer += arg1;
        }
        else if (arg1) {
            this.buffer += " ";
            this.buffer += arg2;
        }
        return this;
    }
    addLine(arg1, arg2) {
        if (arg1 == undefined) {
            this.buffer += "\n";
        }
        else if (typeof arg1 == "string") {
            this.buffer += arg1;
            this.buffer += "\n";
        }
        else if (arg1) {
            this.buffer += arg2;
            this.buffer += "\n";
        }
        return this;
    }
    text() { return this.buffer; }
}
