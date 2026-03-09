# Karpfen Observatory

A web-based dashboard for observing state machine execution in real time within a running Karpfen runtime environment.

## Requirements

- A running **karpfen-runtime** server (default: `127.0.0.1:8080`)
- At least one active environment with a state machine loaded on the server
- A modern web browser (Chrome, Firefox, Edge)

## Getting Started

1. Open `index.html` in your browser.
2. Enter the **Server IP** and **Port** of the running karpfen-runtime, then click **Connect**.
3. Select an **Environment** and the **Model Element** whose state machine you want to observe.
4. Click **Start Observing**.

## Using the Dashboard

- **Trace Console** (left panel) — Shows a live log of engine events: state entries, transitions, tick cycles, errors, etc. Use the filter checkboxes to show/hide specific event categories.
- **State Machine Diagram** (right panel) — Displays the state machine structure with the currently active state(s) highlighted in green. The diagram updates automatically as transitions fire.
- **Disconnect** — Click the button in the toolbar to stop observing and return to the connection dialog.

## Notes

- Each observatory session observes one model element at a time. To watch a different element, disconnect and reconnect.
- The trace console keeps the most recent 100 entries and automatically discards older ones.

---

Large parts of this dashboard are LLM generated based on a detaill service specifications and usecase descriptions of the *karpfen toolkit*.