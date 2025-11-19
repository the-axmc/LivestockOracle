import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { formatTimestamp, truncateAddress } from "../utils/format";
const accentByType = {
    livestock: "#0ea5e9",
    cooperative: "#f59e0b",
    bank: "#16a34a"
};
export function AuthLog({ title, type, entries }) {
    return (_jsxs("div", { className: "card", children: [_jsxs("div", { className: "section-title", children: [_jsx("span", { className: "badge", style: { color: accentByType[type] }, children: title }), _jsx("h3", { children: "Auth Log" })] }), _jsx("small", { className: "help", children: "Latest on-chain interactions recorded from the dashboard." }), _jsxs("div", { className: "auth-log-entries", children: [entries.length === 0 && (_jsx("p", { style: { color: "#94a3b8" }, children: "No activity yet." })), entries.map((entry) => (_jsxs("div", { className: "auth-entry", children: [_jsxs("div", { className: "meta", children: [formatTimestamp(entry.timestamp), " \u2013 ", truncateAddress(entry.actor)] }), _jsx("strong", { children: entry.action }), entry.details && _jsx("div", { children: entry.details }), entry.txHash && (_jsxs("small", { className: "help", children: ["tx: ", truncateAddress(entry.txHash)] }))] }, `${entry.timestamp}-${entry.actor}-${entry.action}`)))] })] }));
}
