# Kompas 30-fold regression evidence

Owner requested 30-fold unit testing with improvements each iteration, 23 October 2026. Each iteration adds one cumulative input-form case across all three audiences, retaining earlier cases plus Hitachi reference, safe renderer and book-navigation tests. Five question intents are crossed with six forms: ordinary, uppercase, surrounding spaces, repeated spaces, newlines and tabs. This improves coverage each iteration; it is not a claim of 30 independent product fixes.

Before repair, the new 30-case suite passed 21 and failed 9. Whitespace changed experience/definition classification. Normalize whitespace only for classification; preserve the original question elsewhere. After repair all 30 iterations pass; final iteration 68/68. Machine-readable per-iteration results are in kompas-30-fold-results.json. No model calls, native Windows runtime, real audio or idle-session acceptance occurred.
