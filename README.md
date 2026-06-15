# CodeTyper

**Muscle memory for developers.** A minimal, distraction-free typing speed test built around real code — not lorem ipsum.

## What it is

CodeTyper is a browser-based typing trainer that surfaces actual functions from popular open-source repositories. Instead of practicing on English prose, you build fluency with the syntax, symbols, and patterns you type every day.

## Features

- **Real code snippets** — curated blocks from React, Lodash, Django, Flask, Kubernetes, Go stdlib, Rust compiler, and more
- **Live GitHub integration** — pull a random snippet from any public repo (`owner/repo` format)
- **Live HUD** — WPM, accuracy, and elapsed time update every second while you type
- **Results screen** — final WPM, raw WPM, accuracy, error count, and an SVG line chart of your speed over time
- **Lightweight syntax highlighting** — keywords, strings, comments, numbers, operators, and punctuation colored in-editor
- **Synthesized keystroke audio** — Web Audio API generates distinct sounds for normal keys, space, enter, and backspace
- **Auto-skip indentation** — optionally jump over leading whitespace so you focus on logic, not spaces
- **6 themes** — Retro Dark, Dracula, Nordic Frost, One Dark, Cyberpunk, Retro Light
- **Tab to reset** — instantly reload a new snippet at any point
- **Persistent settings** — theme, language, sound, indent preference, and GitHub token saved to `localStorage`

## Supported Languages

| Language   | Example sources                         |
|------------|-----------------------------------------|
| JavaScript | `facebook/react`, `lodash/lodash`       |
| Python     | `django/django`, `pallets/flask`        |
| Go         | `kubernetes/kubernetes`, `golang/go`    |
| Rust       | `rust-lang/rust`, `rust-lang/cargo`     |
| C++        | `google/flatbuffers`, `v8/v8`           |

## Getting Started

No build step, no dependencies. Just open the file:

```
open index.html
```

Or serve it locally if your browser blocks ES modules from `file://`:

```
npx serve .
# then visit http://localhost:3000
```

## Usage

| Action | How |
|---|---|
| Start typing | Click the code area or press any key |
| Reset snippet | Press `Tab` or click the reset button |
| Change language | Language dropdown in the header |
| Load a GitHub repo | Click **GitHub Repo** and enter `owner/repo` |
| Change theme | Theme dropdown in the header |
| Toggle sound / indent | Settings gear icon |

## GitHub API Rate Limits

The GitHub integration uses the public API, which allows 60 unauthenticated requests per hour. To increase this, add a personal access token in **Settings → GitHub Access Token**. The token is stored only in your browser's `localStorage` and never sent anywhere except the GitHub API.

## Project Structure

```
code-typer/
├── index.html      # App shell, layout, and all UI markup
├── app.js          # Game logic, audio synth, GitHub fetcher, event wiring
├── snippets.js     # Curated local code snippets per language
└── style.css       # Theming, layout, and all visual styles
```

## License

MIT
