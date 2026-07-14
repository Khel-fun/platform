// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {GameRegistry} from "../src/GameRegistry.sol";

contract DeployScript is Script {
    function run() public {
        address signer = vm.envAddress("SIGNING_ADDRESS");
        vm.startBroadcast();
        GameRegistry gameRegistry = new GameRegistry(signer);
        console.log("GameRegistry deployed at:", address(gameRegistry));
        console.log("Signer:", signer);
        vm.stopBroadcast();
    }
}
