import { registerVk } from "../src";
import { CircuitKind } from "../src";

async function main() {
  console.log("Registering VK");
  await registerVk(CircuitKind.SHUFFLE);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
