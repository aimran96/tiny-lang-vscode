"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const run_1 = require("./commands/run");
function activate(context) {
    (0, run_1.registerRunCommands)(context);
}
function deactivate() {
    // No persistent state to clean up (terminals are owned by VS Code).
}
//# sourceMappingURL=extension.js.map