# Safari responsive and PWA verification matrix

Run against an HTTPS production build. Test with a trip containing no places,
several places, a route, and at least one pending social import. This matrix does
not imply offline maps, geocoding, routing, or imports.

| Surface            | Viewport / device                     | Checks                                                                                                                                                                                                                    |
| ------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| iPhone Safari      | 320 × 568 and iPhone SE               | Map opens first; Map/Places switcher is keyboard and VoiceOver operable; no horizontal scroll at 200% page zoom; buttons are at least 44 × 44 CSS pixels; bottom controls clear browser chrome in portrait and landscape. |
| iPhone Safari      | Current small and large iPhones       | Safe-area padding clears the notch, Dynamic Island, and home indicator; address search exposes loading, empty, error, and retry text; route failure remains actionable.                                                   |
| iPad Safari        | 768 × 1024 portrait and landscape     | Dedicated Map/Places views remain usable; rotation preserves the draft; hardware-keyboard focus order follows visual order and focus is visible.                                                                          |
| macOS Safari       | 1024, 1280, and 1440 px wide          | Tablet and desktop columns do not overlap; sidebar scrolls independently; map controls and point cards are keyboard reachable.                                                                                            |
| Installed app      | Add to Home Screen on iPhone and iPad | Icon, name, theme color, and standalone launch are correct; controls clear all safe areas; relaunch shows the public app shell.                                                                                           |
| Brief network loss | Safari and installed app              | Start a new-place draft, disable networking, edit fields, reload, and confirm the draft returns; the offline notice explicitly says maps and routes require a network; reconnect and save normally.                       |
| Provider failures  | Safari responsive modes               | Block tile, geocoding, routing, and social-import requests in Web Inspector; confirm visible error/retry or empty states and useful VoiceOver announcements for each.                                                     |
| Google map controls | Current small and large iPhones       | Tap Show all points, My location, and Back to route; verify permission is requested only after tapping My location, denial is recoverable, selected markers remain visible, and Google attribution is not covered.       |
| Location sheet      | Current small and large iPhones       | Select from search, itinerary, marker, social import, and route stop; verify the same details/actions appear, the sheet clears the home indicator, selection survives map/list toggles, and the map is not recreated.      |
| External website   | Current small and large iPhones       | Open a selected place website, return with Safari's back control, and verify the trip, route order, map camera, selected marker, and details sheet remain intact.                                                          |

For every row, also run VoiceOver rotor navigation through headings, landmarks,
forms, and buttons; verify labels are announced without relying on placeholder
text or color. Check normal and increased-contrast modes, light appearance,
text-only zoom through 200%, and reduced motion. Record the Safari/iOS version,
device, orientation, result, and a screenshot for failures.
