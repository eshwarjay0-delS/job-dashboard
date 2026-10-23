# Parakeet homepage, REA 6.7.0

Date: 23 October 2026.

Tool: `npx -y rea-agents` version 6.7.0, command `capture-browser-scenario`.

Target: the public homepage only, `https://www.parakeet-ai.com/`. Headless Chrome, owned by the tool, then closed. No account, no sign-in, no dashboard.

Evidence id: `ev_85913011cfea07c2bf72d118295c19c30d0937a36e478ee875727a558d06800c`.

Result: completeness `complete`. Events retained 0, events dropped 0. The page accessibility tree is in `rea-parakeet-home-a11y.txt`.

What the page itself shows:

- Real-time interview assistant, question bank, mock interview, resume maker, headshots.
- Coding support that listens and reads code on the screen.
- Claims of fast transcription, 100 percent accurate answers, 1.5 million people, and being invisible on a screen share.

Those counts and the invisible claim are their marketing. This run did not measure them.

What Kompas already took from the public complaints, not from their code: spoken answers, words kept if the stream drops, and a note after the call made only from questions that were answered.

Not taken: stealth, joining a meeting, headshots, or their price page.
