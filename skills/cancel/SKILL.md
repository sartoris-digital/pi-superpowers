---
name: cancel
description: Cancel active execution mode (ralph, autopilot) and clean up state
---

# Cancel

Unified cancellation for active execution modes.

## When to Use

- When all work is complete and you need to exit a persistence loop
- When the user says "cancel", "stop", or invokes `/cancel`
- When a mode is stuck and needs manual termination

## Process

1. **Detect active modes:**
   ```
   state list
   ```

2. **Write cancel signal:**
   ```
   state write cancel-signal { "active": true, "reason": "user requested" }
   ```

3. **Deactivate modes in dependency order:**
   - If autopilot active: `state write autopilot { "active": false, "reason": "cancelled" }`
   - If ralph active: `state write ralph { "active": false, "reason": "cancelled" }`
   - Clear cancel signal: `state clear cancel-signal`

4. **Report:**
   ```
   Cancelled: [mode name]
   Iteration: [N]
   ```

## Notes

- The persistence-engine checks for the cancel-signal on each `agent_end` event
- Writing the cancel signal is sufficient — the engine will see it and stop injecting continuations
- Always deactivate the mode state AND write the cancel signal for reliable cancellation
