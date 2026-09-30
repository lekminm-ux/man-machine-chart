# Layout Man Map symbols

The layout editor uses a top-view workstation map to make the operator, machines, material points, and connections easy to distinguish. The symbols below are application drawings, not a claim of certification to a universal automotive icon set. Site or customer drawing rules should take priority if supplied.

| Symbol | Drawing in this app | Meaning |
| --- | --- | --- |
| Worker | Head, torso, arms, legs, plus a separately coloured label | A person and their working position; it replaces the ambiguous solid circle. |
| Injection Molding | Feed hopper and screw/barrel pointing toward a two-platen mold clamp | Injection unit feeding the clamping/mold unit. |
| Blow Molding | Extruder feeding a hanging parison between mold halves and blow pin | **Extrusion** blow molding configuration. Confirm the exact machine subtype for sites using injection blow or stretch blow molding. |
| Other circle | Plain geometric circle | A user-defined marker; it is not silently interpreted as a person. |

The visual emphasis on operator movement, machine placement, work sequence, and standard work in process follows the [Lean Enterprise Institute's standardized work chart explanation](https://email.lean.org/hubfs/ebook%20files/Standardized-work-ebook-final.pdf) and its [workstation chart description](https://www.lean.org/the-lean-post/articles/standards-at-workstations/). The injection glyph reflects ENGEL's [injection and clamping units](https://www.engelglobal.com/en/ca/products/injection-molding-machines/toggle-clamp-injection-molding-machine). The extrusion blow glyph reflects BEKUM's [extruder, extrusion head, parison handling, mold, and blow pin](https://www.bekum.com/media/nleos1jg/eblow508-messeflyer_en-neu-screen.pdf).

For an existing generic `Machine` element, the editor chooses a process glyph when its label or the chart process name contains Injection/ฉีด or Blow/เป่า. The dedicated palette buttons set the symbol explicitly. Each element keeps its original geometry and can be resized, rotated, connected, grouped, and saved with the chart.
