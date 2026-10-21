# Autodidact

Animated, step-by-step study pages for computer science. Learn on your own terms: pick a subject and work through it one step at a time.

## Open the site

Open `index.html` in a web browser. You need no build step, no server, and no network.
The fonts are in `assets/fonts`, so the pages look the same when you are offline.

## Folder layout

- `manifest.json` - the one list of subjects, chapters, and traces. Edit this file to add or change a card or a row.
- `index.html` - the main page. **Generated** from `manifest.json`. Do not edit it by hand.
- `subjects/<subject>/index.html` - the page of one subject. **Generated** from `manifest.json`.
- `subjects/<subject>/<trace>.html` - one file for each trace. You write these by hand.
- `assets/base.css` - the fonts, the page reset, and the style of the theme button. Every page loads it first.
- `assets/favicon.svg`, `assets/favicon.ico`, `assets/apple-touch-icon.png` - the site icon. Every page links all three in its `<head>`.
- `assets/theme.css` - **all colors of the site**, in light and dark. See "Colors and night mode".
- `assets/theme.js` - the theme button (Auto, Light, Dark). It loads in the `<head>` of every page.
- `assets/hub.css` - the styles of the main page and the subject pages.
- `assets/trace.css` - the shared styles of the trace pages. A trace page can add its own styles in a `<style>` block after the link.
- `assets/player.js` - the shared player of the trace pages (the buttons, the scrub bar, the keys, the code panel, and the Complexity card).
- `assets/fuzzy.js` - the fuzzy match, which tolerates typos. `assets/search.js` - the search bar of the main page and of every subject page.
- `assets/hub-data.js` - the data for the main search. **Generated.**
- `scripts/build.mjs` - the build script. `scripts/complexity-pending.json` - the trace pages that have no `COMPLEXITY` yet. `tests/` - the tests.

## Change the generated files

You need Node 18 or newer. Run these commands in the project folder.

    npm install        # one time. It installs jsdom, which the tests use.
    npm run build      # write index.html, the subject pages, and assets/hub-data.js
    npm run check      # check that the generated files are up to date and that the rules below hold
    npm test           # run the check and all the tests

## Colors and night mode

Every page has a round button in the top right corner. It switches between **Auto** (follows your system), **Light**, and **Dark**. The page remembers your choice in the browser.

- All colors are in `assets/theme.css`. Each color is one line: `--name: light-dark(LIGHT, DARK);`.
- Other CSS files and the trace pages use `var(--name)`. They must not write a color of their own. `npm test` fails if they do.
- To add a color for a new trace, add one line to `theme.css`, and use the name with `var()`.
- The browser needs to support `light-dark()`. This means Chrome and Edge 123, Firefox 120, and Safari 17.5 or newer.
- When you open the pages by double-click (`file://`), some browsers do not share the saved choice between pages. A local server fixes this: `python3 -m http.server 8000`.

## Search

Every page has one large search bar at the top. It works like Spotlight on macOS or the search of GNOME:

- Type, and a panel opens under the bar. The sections of the page stay below it and fade while the panel is open.
- `Up` and `Down` move the selection. `Enter` opens it. `Esc` clears the text. A second `Esc` leaves the bar.
- `/` and `Ctrl+K` (or `Cmd+K` on a Mac) move the focus to the bar from anywhere on the page.
- The main page puts the focus in the bar when it opens, on a computer. It does not do this on a phone, to keep the keyboard closed.
- On a subject page, the search covers the whole site. The traces of that subject come first.

The data for the search comes from `manifest.json` through `assets/hub-data.js`. You do not edit it.

## Add a trace

1. Copy an existing trace file into the subject folder. Keep the tags in the `<head>` (the three icon links, `base.css`, `theme.css`, `trace.css`, and the `theme.js` script), and keep the `player.js` script at the end.
2. Change the code and the steps in the copy. Keep the `//SIM-START` and `//SIM-END` markers around the simulation. Write `COMPLEXITY` after it (see "The Complexity card").
3. Add the trace to `manifest.json` (file, chapter, name, description, tags, keywords).
4. Run `npm run build`. The build writes the counts, the rows, and the search data. It stops with a message if a rule is broken.

## How a trace page works

The page defines `window.TRACE` and then loads `assets/player.js`. The first lines of `player.js` list what `TRACE` must have:

- `code` (or `getCode()`) and `hl(line)` - the source lines and their colors.
- `simulate()` - returns the steps. A step has `lines` (the lines to mark), `title`, and `note`.
- `render(step, i)` - draws the diagram, the tables, and the formulas for step `i`.
- Optional: `init()`, `onParam(el)`, and `bind(rebuild)`, for pages with their own inputs.

Any `<select class="param">` in the page rebuilds the steps when it changes.

## The Complexity card

Every trace page shows one Complexity card under the title and above the controls. It shows the time and the space in large type, a meter that fills as you press Next, and three short parts: why, the best and worst case, and a growth table for n = 8, 16, and 32. A code line that repeats can have a small tag, such as "runs n times".

The page defines one `COMPLEXITY` object. It goes after `//SIM-END`, between `//COMPLEXITY-START` and `//COMPLEXITY-END`, so that the tests can run it in Node. It can use the functions of the simulation. The player draws the card from it. The colors come from `theme.css`, so night mode works.

| Field | Meaning |
| --- | --- |
| `time` | A list of `{ when, o, words }`. `when` is `all`, or `best`, `average`, `worst`. `o` is written `O(...)`. `words` is one short plain sentence. List best, average, and worst only when they differ. |
| `main` | The `when` of the case that matters most. It gets the accent color. |
| `space` | `{ o, words }`. The extra memory. |
| `why` | 2 to 4 short sentences: which loop or call repeats, and how many times. |
| `unit` | The word that counts the cost in `cases`, for example `comparisons`. |
| `cases` | `[best, worst]`, or one `{ when: 'all', ... }` when the cost does not depend on the input (`caseOf` then returns `all`). Each is `{ when, input, at(step), bound? }`. `input` says which input causes the case. `at(step)` is the count. `bound: true` means the count is a limit and not always reached. |
| `caseOf(lastStep)` | Returns `best`, `worst`, or `between` for the chosen input. The card marks that case. |
| `measured(lastStep)` | The count of the chosen input, in `unit`. |
| `meters` | One or two `{ label, value(step), limit(step) }`. The bar shows `value` of at most `limit`. The simulation already counts these. |
| `growth` | `{ label, f(n, lastStep), note }`. `f` is the cost for n = 8, 16, and 32. `label` and `note` can be functions of the last step, for a page with another input such as k. |
| `loops` | `{ lineNumber: 'short tag' }` for the code lines that repeat. |

The rule that keeps it complete:

- `npm run build` stops if a trace page has no `COMPLEXITY`. The pages that are not done yet are in `scripts/complexity-pending.json`. When you add `COMPLEXITY` to a page, remove its file name from that list. When the list is empty, the rule has no exception.
- `tests/complexity.test.mjs` checks the shape, runs every input of the page, and compares the claims with the counts of the simulation and with references that the test writes itself (a brute-force search over all inputs, or a known worst-case input). Add a driver for the page in that file.

## Add a subject or a chapter

Add it to `manifest.json`, make the folder `subjects/<id>/`, and run `npm run build`.

## Fonts

Bricolage Grotesque, Instrument Sans, and JetBrains Mono are in `assets/fonts` under the SIL Open Font License. The license text is in `assets/fonts/LICENSES.txt`.
