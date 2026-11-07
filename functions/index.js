// Exports only. Every callable is built from a {spec, handler} in src/commands through one wrapper.

const {setGlobalOptions} = require("firebase-functions/v2");
const {command} = require("./src/lib/command");

setGlobalOptions({region: "asia-south1"});

for (const mod of ["orders", "artists", "trust", "admin", "payouts", "instagram"]) {
  for (const [name, c] of Object.entries(require(`./src/commands/${mod}`).commands)) {
    exports[name] = command(name, c.spec, c.handler);
  }
}

Object.assign(exports, require("./src/webhook"), require("./src/triggers"));
