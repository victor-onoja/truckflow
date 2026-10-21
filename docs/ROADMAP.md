# TruckFlow: road to zero-input

The goal: people stop *recording* the yard and only *handle exceptions*. Every
timestamp should come from something that already happens (a scan, a plate
read, a weight change, a pump starting), not from someone remembering to tap.

## Where V1 stands now (shipped)

| Was | Now |
| --- | --- |
| Gate officer picks visit type every time | Pre-selected from the truck's history (offload-only last time → load-only now), with the reason shown |
| QR code only; "plate number" in the placeholder didn't work | QR, typed code, or loosely typed plate (`kja 482xa`) all resolve |
| Open truck → find row → START → END → confirm END | One button with the server-decided next step, from the queue row or a scan |
| Unlatch→Offload and Load→Latch = 4 taps | Chained: "Finish unlatching, start offloading" = 1 tap, one shared timestamp |
| Confirmation dialogs on every END | Act immediately, 10 s Undo (gate out keeps a 2-tap confirm because it notifies people) |
| Supervisors spot delays by staring at the queue | Automatic delay alerts at the red limit, once per truck per stage |
| Login: type phone + PIN + press Sign in | Phone remembered, signs in on the 4th digit |

Rough count for a full-cycle truck: **~22 taps/fields → 9 taps** (1 scan + gate in, 6 yard/fuel taps, 2 gate out).

## Next: software only (no new hardware)

1. **Driver self check-in (WhatsApp/SMS).** The driver texts the plate on arrival
   at the truckyard; the visit is pre-created as *arriving*. The gate officer's
   scan becomes a confirmation. The driver gets "Proceed to bay 3" messages back.
   Termii/Twilio plug into the existing `NotificationProvider` interface.
2. **ERP/dispatch integration (SAP or whatever issues loading orders).** If the
   truck has an open shipment it is loading; if it carries empties it is
   offloading. Visit type stops being a question at all. Order size also
   predicts loading time.
3. **Bay assignment and call-forward.** Turn the queue into dispatch: the system
   knows which bays are free and who's been waiting longest, and tells the yard
   "Bay 2: call KJA-482-XA". Queuing time becomes something you can control, not
   just something you measure.
4. **Predictive delays, not reactive ones.** Per-stage durations by product, crew,
   hour and carrier → predicted exit time per truck. Alert at "will breach in
   15 min", not "breached".
5. **Offline-first PWA.** Yards have dead spots. Queue actions locally with their
   *device* time plus an offline flag, then sync and reconcile (PRD FR-15).
6. **Push updates instead of polling.** Swap `useLiveQueue` to SSE/WebSocket; it
   is the only file that changes.
7. **Data-quality guardrails.** Flag implausibly short stages (someone tapped
   start and end together after the fact), and show each operator their own
   "late taps" so the data stays honest.
8. **Automatic shift reports.** End-of-shift email/WhatsApp to
   supervisors: trucks in/out, average turnaround, worst bottleneck, carriers over SLA.

## Then: sensors replace taps

Each of these feeds the **same stage machine**. Nothing about the rules changes;
only where events come from.

| Source | Replaces | Notes |
| --- | --- | --- |
| **ANPR cameras** at gate in/out | QR scan, gate in, gate out | Plate read → auto gate in with suggested type; exit read → gate out if ready. Officer handles only mismatches. |
| **Boom barrier interlock** | Trust | Exit barrier opens only when every stage is closed, so nobody leaves with an open stage. |
| **Weighbridge** | Offload/load end taps | Weight drop = empties off; reaching target gross = loaded. Also catches short-loading. |
| **Fuel dispenser controller** | Fueling taps | Pump on/off plus litres per truck; fuel reconciliation for free. |
| **UHF RFID / BLE tags on trucks + bay readers** | Unlatch/offload/load start | Arrival at a bay starts the stage; dwell time is measured, not reported. |
| **Bay cameras + computer vision** | Latch/unlatch, crate counts | Later stage; detects activity and counts crates. |
| **Driver phone geofence** | Arrival ETA | Know trucks are 20 min out; pre-plan bays. |

### The architecture change that makes this safe

Today: `UI tap → advance() → StageEvent`.

Target: every source posts an **event** (`{truck, signal, at, source, confidence}`)
into one `ingest()` in the stage machine, which already enforces order, roles and
idempotency (`expect` guards). Add `source` and `confidence` to `StageEvent`:

- High-confidence, in-order events are applied automatically.
- Conflicting or low-confidence events become a one-tap **"Confirm?"** card for
  the right role, using the same button UI shipped now.
- The existing `isOverride` audit field covers corrections.

That way the hardware rollout is gradual: one bay at a time, with taps as the
fallback, and no flag day.

## Analytics that become possible

- Yard heat map: where trucks wait, by hour of day and day of week.
- Capacity simulation: "what if we open bay 5 from 06:00?" replayed against real history.
- Carrier and driver scorecards; SLA reporting for distribution.
- Turnaround cost: idle truck-hours × day rate, the number that funds the sensors.
