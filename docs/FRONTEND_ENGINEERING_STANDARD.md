# MarketFit frontend engineering standard

This standard is derived from the architecture strategy in **Architecting Interactive 3D Web Applications**. It is the default review lens for MarketFit web, Kompas and future native-facing interactive experiences.

## 1. Static correctness before spectacle

A rich interface starts from a trustworthy static application.

Before animation or 3D:
- TypeScript and ESLint must pass.
- Design values come from semantic tokens rather than one-off colors and measurements.
- The document must remain useful with JavaScript-delayed visuals removed.
- Critical actions, copy and navigation stay in normal DOM flow.
- Rich visuals may enhance a workflow; they may not become the only way to complete it.

The goal is the same principle described in the source: a rigid static foundation gives the dynamic layer freedom without turning the codebase into inconsistent one-off behavior.

## 2. Use the smallest motion engine that matches the physics

Use CSS transitions for simple state changes: hover, color, opacity, small transforms.

Use Framer Motion for React-owned component transitions and gesture/state animation already inside the application.

Only introduce GSAP when a feature truly needs centralized choreography, timeline control, scroll-linked sequencing or another behavior that is materially harder to express safely with the existing tools. Do not add it merely because an animation exists.

Motion must have one owner. Do not split the same transition between CSS, React state and an animation library.

## 3. 3D is progressive enhancement

React Three Fiber is the preferred React integration if MarketFit adds production WebGL scenes because it preserves declarative component ownership while exposing the Three.js scene model.

Before implementation, the engineer must be able to explain:
- scene coordinates and transforms;
- camera choice;
- lighting;
- geometry versus material;
- asset loading;
- the render loop;
- controls and camera constraints.

A 3D scene is never mounted in the critical initial route bundle. Use the shared `ProgressiveVisual` boundary so the DOM fallback is present immediately and the rich bundle is requested only near the viewport on a capable device.

Controls are intentionally constrained by default. MarketFit should give the user the *feeling* of inspecting an object without allowing pan/zoom/camera states that destroy the presentation.

## 4. Performance is a product requirement

Target 60fps interaction, but do not chase 60fps by hiding slow loading behind a spinner.

The default budgets in `src/experience/performance.ts` are guardrails, not permission to fill every budget:
- keep initial rich-media transfer below 1.5 MB;
- defer larger optional media;
- clamp device pixel ratio;
- compress textures;
- pause optional rendering when the page is hidden;
- respect Save Data and reduced-motion preferences.

Large GLTF/GLB, image and texture assets need an explicit compression pass before production. A ten-megabyte model is a bug until proven otherwise.

Test on physical phones. Desktop responsive emulation is not sufficient for battery, GPU, memory, touch and browser-behavior validation.

## 5. Responsive layout stays in document flow

Do not use fixed pixel coordinates as the primary layout system.

Absolute positioning is acceptable for local decorative layers whose containing block is explicit. It is not acceptable for primary page structure or controls that need to survive narrow screens, font scaling and dynamic copy.

Mobile menus must deliberately control their relationship to the document. In MarketFit, navigation expands in page flow instead of allowing the background to drift or placing a desktop rail over phone content.

## 6. Accessibility cannot depend on color

Status, separation and hierarchy need structural signals:
- text labels;
- borders;
- spacing;
- icons with accessible names where needed;
- focus states;
- contrast.

Never use red versus green as the only distinction. This applies equally to light and dark themes.

All optional motion obeys `prefers-reduced-motion`. Forced-colors mode must retain understandable borders and controls.

## 7. Understand the primitive before using the abstraction

Industrial-grade component systems are encouraged once the underlying behavior is understood.

Vendored source-owned components are preferable to opaque visual black boxes when the component is central to the product. Copying a component into the repository makes MarketFit responsible for its accessibility, performance and future maintenance.

A senior review should be able to explain why each dependency exists and what would break if it were removed.

## 8. Deployment and observability are part of implementation

A localhost feature is not complete.

For production:
- preview build first;
- production build after validation;
- Core Web Vitals are emitted with the active experience tier;
- client failures need a reproducible path;
- real-device behavior is part of acceptance.

The source specifically emphasizes the value of production telemetry and session replay for bugs that cannot be reproduced locally. MarketFit now establishes a privacy-light Web Vitals channel. Session replay is **not** silently enabled: it requires an explicit provider, privacy review, masking rules and retention decision before adoption.

## 9. Richness adapts to the device

The shared `ExperienceProvider` classifies the client as `static`, `balanced` or `rich` using:
- explicit user preference;
- reduced-motion preference;
- Save Data / slow network hints;
- available memory and CPU hints when exposed;
- WebGL2 capability;
- page visibility.

The tier is a delivery decision, not a statement about the user. Core functionality is identical at every tier.

## 10. Definition of done for an interactive feature

An interactive feature is not done until all of these are true:

1. The static/DOM experience works first.
2. Mobile layout works on a physical phone.
3. Keyboard/focus behavior is usable.
4. Meaning is not color-only.
5. Reduced motion has a valid path.
6. Rich assets are lazy and compressed.
7. Hidden tabs stop optional continuous work.
8. Failure falls back to the core action.
9. Typecheck/lint/tests pass.
10. Preview is validated before production.
11. Web-vital or feature telemetry can show whether the change damaged real users.
12. The team can explain the underlying mechanics instead of only naming the library.
