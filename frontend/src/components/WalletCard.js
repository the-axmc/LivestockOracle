import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { truncateAddress } from "../utils/format";
export function WalletCard({ address, chainId, connect, disconnect, connecting }) {
    return (_jsxs("div", { className: "card", children: [_jsx("div", { className: "section-title", children: _jsx("h3", { children: "Wallet" }) }), address ? (_jsxs(_Fragment, { children: [_jsxs("p", { children: ["Connected as ", _jsx("strong", { children: truncateAddress(address) })] }), _jsxs("p", { children: ["Chain ID: ", _jsx("strong", { children: chainId })] }), _jsx("button", { onClick: disconnect, children: "Disconnect" })] })) : (_jsx("button", { onClick: connect, disabled: connecting, children: connecting ? "Connecting…" : "Connect Wallet" }))] }));
}
