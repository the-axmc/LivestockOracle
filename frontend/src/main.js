import { jsx as _jsx } from "react/jsx-runtime";
import React from "react";
import ReactDOM from "react-dom/client";
import { PrivyProvider } from "@privy-io/react-auth";
import App from "./App";
import "./styles/global.css";
import { chainConfig } from "./config/contracts";
const privyAppId = import.meta.env.VITE_PRIVY_APP_ID;
if (!privyAppId) {
    throw new Error("VITE_PRIVY_APP_ID is not configured");
}
ReactDOM.createRoot(document.getElementById("root")).render(_jsx(React.StrictMode, { children: _jsx(PrivyProvider, { appId: privyAppId, config: {
            loginMethods: ["wallet"],
            embeddedWallets: {
                createOnLogin: "users-without-wallets"
            },
            defaultChain: {
                id: chainConfig.id,
                name: chainConfig.name,
                rpcUrl: chainConfig.rpcUrl
            },
            supportedChains: [
                {
                    id: chainConfig.id,
                    name: chainConfig.name,
                    rpcUrl: chainConfig.rpcUrl
                }
            ]
        }, children: _jsx(App, {}) }) }));
