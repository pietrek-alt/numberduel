// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {NumberDuel} from "../src/NumberDuel.sol";

/// @notice Deploys NumberDuel wired to the USDFC token.
/// @dev USDFC address is read from the USDFC_ADDRESS env var. Defaults to the
///      Filecoin Calibration testnet USDFC token.
///
/// Usage:
///   forge script script/Deploy.s.sol:Deploy \
///     --rpc-url $CALIBRATION_RPC \
///     --private-key $PRIVATE_KEY \
///     --broadcast
contract Deploy is Script {
    // USDFC on Filecoin Calibration testnet (18 decimals).
    address constant CALIBRATION_USDFC = 0xb3042734b608a1B16e9e86B374A3f3e389B4cDf0;

    function run() external returns (NumberDuel duel) {
        address usdfc = vm.envOr("USDFC_ADDRESS", CALIBRATION_USDFC);

        vm.startBroadcast();
        duel = new NumberDuel(usdfc);
        vm.stopBroadcast();

        console.log("NumberDuel deployed at:", address(duel));
        console.log("Wired to USDFC:", usdfc);
    }
}
